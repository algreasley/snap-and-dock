/* globals fin, Promise */
/**
 * The DockingWindow class is designed to wrap and openfin window
 * and is dependent on the DockingManager for its configuration and services
 * (i.e. it is not intended to be a standalone class)
 */
import DockingGroup from "./DockingGroup.js";
import {applyOptions} from "./OptionsParser.js";
import {intersect, isGroupInView, isInView, getSnapDirection} from "./DockingUtil.js";
import {GroupEventReason} from "./OpenFinWrapper.js";

const dockingDefaults = {
    // options intended for external configuration
    range: 40,
    undockOffsetX: 0,
    undockOffsetY: 0,
    movingOpacity: 0.5,
    dockableToOthers: true
};

const openDockableWindows = {};

async function regroup(persistenceService, allWindowsToRegroup, previousWindow, currentWindow, isNewGroup) {
    // console.warn(`Regroup ${currentWindow.name}`); // eslint-disable-line no-undef, no-console

    const currentWindowIndex = allWindowsToRegroup.indexOf(currentWindow);
    if (currentWindowIndex === -1) {
        return; // already traversed
    }

    // Important, get orig partnerships, before leave/join group destroys them below
    const partnerWindowNames = persistenceService.retrieveRelationshipsFor(currentWindow.name);

    // remove this window now from pending list, we should not be visiting it again
    allWindowsToRegroup.splice(currentWindowIndex, 1);

    // if this is a lone window, then leave group
    // do not trigger any additional split-checking, normal checks for off-screen etc.
    if (!previousWindow && partnerWindowNames.length === 0) {
        currentWindow.leaveDockingGroup();
        return;
    }

    if (isNewGroup) {
        await currentWindow.leaveDockingGroup(false);
        if (previousWindow) {
            // join previous partner window in new group
            currentWindow.joinDockingGroup(previousWindow);
        }
    }

    // console.warn(`handlePartners for ${currentWindow.name}: ${partnerWindowNames}`); // eslint-disable-line no-undef, no-console
    for (const partnerWindowName of partnerWindowNames) {
        const partnerWindow = DockingWindow.getWindowByName(allWindowsToRegroup, partnerWindowName);
        if (partnerWindow) {
            // we want to serialise these operations, so await in this loop is fine
            await regroup(persistenceService, allWindowsToRegroup, currentWindow, partnerWindow, isNewGroup);
        }
    }
}

async function checkForSplitGroup(persistenceService, dockingGroup) {
    if (dockingGroup.children.length < 2) {
        return;
    }

    // console.warn(`checkForSplitGroup ${dockingGroup.children.length}`);

    let existingDockingGroup = dockingGroup;
    const windowsToRegroup = existingDockingGroup.children.concat();

    // loop, until no windows left to (re)group ....

    while (windowsToRegroup.length > 0) {
        const [startWindow] = windowsToRegroup;
        // we actively want to serialise these operations, so parallelizing is _not_ what we want
        // eslint-disable-next-line no-await-in-loop
        await regroup(persistenceService, windowsToRegroup, null, startWindow, !existingDockingGroup);

        if (existingDockingGroup && startWindow.group) {
            existingDockingGroup = null;
        }
    }
}

export default class DockingWindow {
    constructor(windowOrOptions, dockingOptions) {
        this.createDelegates();
        this.name = windowOrOptions.name;
        this.allMonitorBounds = dockingOptions.allMonitorBounds;
        this.persistenceService = dockingOptions.persistenceService;
        // simple property defaults
        this.originalOpacity = 1;
        this.acceptDockingConnection = true;
        this.minimized = false;
        this.group = null;

        if (windowOrOptions instanceof fin.desktop.Window) {
            this.openfinWindow = windowOrOptions;
        } else {
            this.openfinWindow = new fin.desktop.Window(windowOrOptions);
        }

        // OpenFin Window is definitely created now, but may not be fully initialized
        this.openfinWindow.getOptions(
            this.onWindowOptions,
            () => this.openfinWindow.addEventListener('initialized', () => this.onWindowInitialized())
        );

        applyOptions(this, Object.assign({}, dockingDefaults, dockingOptions));

        this.currentRange = this.range;
    }

    static getWindowByName(windowList, windowName) {
        return windowList.find(windowInList => windowInList.name === windowName);
    }

    // DockingWindow API - external handlers
    onMove() {
    }

    onMoveComplete() {
    }

    onClose() {
    }

    onFocus() {
    }

    onRestore() {
    }

    onMinimize() {
    }

    onLeaveGroup() {
    }

    setOpacity(value) {
        this.openfinWindow.updateOptions({
            opacity: value
        });
    }

    resetOpacity() {
        this.openfinWindow.updateOptions({
            opacity: this.originalOpacity
        });
    }

    minimize() {
        if (this.minimized) {
            return;
        }
        this.openfinWindow.minimize();
    }

    restore() {
        if (!this.minimized) {
            return;
        }
        this.openfinWindow.restore();
    }

    // bound functions for openfin event handlers
    // (use class property arrow funcs when possible, and remove this function)
    createDelegates() {
        this.onWindowOptions = this.onWindowOptions.bind(this);
        this.completeInitialization = this.completeInitialization.bind(this);
        this.onBoundsChanging = this.onBoundsChanging.bind(this);
        this.onBoundsChanged = this.onBoundsChanged.bind(this);
        this.onBoundsUpdate = this.onBoundsUpdate.bind(this);
        this.onMoved = this.onMoved.bind(this);
        this.onClosed = this.onClosed.bind(this);
        this.onFocused = this.onFocused.bind(this);
        this.onMinimized = this.onMinimized.bind(this);
        this.onRestored = this.onRestored.bind(this);
        this.onGroupChanged = this.onGroupChanged.bind(this);
    }

    onWindowOptions(windowOptions) {
        // make note of opacity for this existing window, set as original
        this.originalOpacity = windowOptions.opacity;
        this.onWindowInitialized();
    }

    onWindowInitialized() {
        // OpenFin window close triggers a 'hidden' event, so do not tie minimize action to this event
        this.openfinWindow.getBounds(this.completeInitialization);
        this.openfinWindow.disableFrame();
        this.openfinWindow.addEventListener('disabled-frame-bounds-changing', this.onBoundsChanging);
        this.openfinWindow.addEventListener('disabled-frame-bounds-changed', this.onBoundsChanged);
        this.openfinWindow.addEventListener('bounds-changed', this.onBoundsUpdate);
        this.openfinWindow.addEventListener('closed', this.onClosed);
        this.openfinWindow.addEventListener('minimized', this.onMinimized);
        this.openfinWindow.addEventListener('restored', this.onRestored);
        this.openfinWindow.addEventListener('shown', this.onRestored);
        this.openfinWindow.addEventListener('focused', this.onFocused);
        this.openfinWindow.addEventListener('group-changed', this.onGroupChanged);
    }

    completeInitialization(initialWindowBounds) {
        this.onBoundsUpdate(initialWindowBounds);
        openDockableWindows[this.name] = this;

        const formerDockingPartners = this.persistenceService.retrieveRelationshipsFor(this.name);
        for (let i = 0; i < formerDockingPartners.length; i++) {
            const potentialPartnerName = formerDockingPartners[i];
            const potentialPartnerWindow = openDockableWindows[potentialPartnerName];

            // TODO: push this stuff out into util class
            if (!potentialPartnerWindow ||
                !getSnapDirection(this, potentialPartnerWindow) &&
                !getSnapDirection(potentialPartnerWindow, this)) {
                // garbage collection, essentially
                // note, if a former partner has not been opened yet, then re-connecting
                // that pair of windows will be handled by that window's persisted relationships
                this.persistenceService.removeRelationship(this.name, potentialPartnerName);
            } else {
                this.joinDockingGroup(potentialPartnerWindow);
            }
        }
    }

    onBoundsUpdate(bounds) {
        this.x = bounds.left;
        this.y = bounds.top;
        this.width = bounds.width;
        this.height = bounds.height;
    }

    onBoundsChanging(bounds) {
        const event = {
            target: this,
            preventDefault: false,
            bounds: {
                x: bounds.left,
                y: bounds.top,
                width: this.width,
                height: this.height,
                changedWidth: bounds.width,
                changedHeight: bounds.height
            }
        };

        this.onMove(event);

        if (event.preventDefault) {
            return;
        }

        if (!this.group) {
            this.setOpacity(this.movingOpacity);
        }

        this.moveTo(bounds.left, bounds.top, bounds.width, bounds.height);
    }

    moveTo(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width || this.width;
        this.height = height || this.height;

        this.openfinWindow.removeEventListener('disabled-frame-bounds-changing', this.onBoundsChanging);
        this.openfinWindow.setBounds(x, y, this.width, this.height, this.onMoved);
    }

    onBoundsChanged() {
        this.resetOpacity();
        this.onMoveComplete({target: this});
    }

    onMoved() {
        this.openfinWindow.addEventListener('disabled-frame-bounds-changing', this.onBoundsChanging);
    }

    onClosed() {
        this.onClose({target: this});
    }

    onFocused() {
        this.onFocus(this);
    }

    onMinimized() {
        this.minimized = true;
        this.onMinimize(this);
    }

    onRestored() {
        this.minimized = false;
        this.onRestore(this);
    }

    onGroupChanged(groupEvent) {
        if (groupEvent.reason === GroupEventReason.LEAVE && groupEvent.sourceWindowName === this.name) {
            this.onLeaveGroup(this.name);
        }
    }

    joinDockingGroup(snappedPartnerWindow) {
        if (!this.dockableToOthers || !snappedPartnerWindow.acceptDockingConnection) {
            return;
        }

        if (snappedPartnerWindow.group) {
            if (this.group) {
                // as we do not currently allow group to group docking, short-circuit out
                // otherwise we would need to do mergeGroup here
                // e.g. if we inserted a window between 2 groups to 'join' them
                return;
            }

            for (let i = 0; i < snappedPartnerWindow.group.children.length; i++) {
                if (intersect(this, snappedPartnerWindow.group.children[i])) {
                    return;
                }
            }
        } else {
            if (this.group) {
                snappedPartnerWindow.joinDockingGroup(this);
                return;
            }
        }

        // openfin operations: frame and grouping
        // if both ungrouped, this will set up the initial group with both windows as members
        this.openfinWindow.enableFrame();
        snappedPartnerWindow.openfinWindow.enableFrame();
        this.openfinWindow.joinGroup(snappedPartnerWindow.openfinWindow);

        if (!this.group && !snappedPartnerWindow.group) {
            // both ungrouped .. set partner up with new group
            const dockingGroup = new DockingGroup();
            dockingGroup.add(snappedPartnerWindow);
            fin.desktop.InterApplicationBus.publish('window-docked', {windowName: snappedPartnerWindow.name});
        }

        snappedPartnerWindow.group.add(this);
        fin.desktop.InterApplicationBus.publish('window-docked', {windowName: this.name});

        this.persistenceService.createRelationshipsBetween(this.name, snappedPartnerWindow.name);
    }

    async leaveDockingGroup(isInitiator) {
        const {group} = this;
        if (!group) {
            return;
        }

        // disconnect from docking group as soon as possible to avoid
        // any interference in leaveGroup handling
        group.remove(this);

        this.openfinWindow.disableFrame();
        // detach window from OpenFin runtime group
        try {
            await new Promise((resolve, reject) => this.openfinWindow.leaveGroup(
                () => resolve(),
                (err) => reject(err)
            ));
        } catch (err) {
            // do not need further action here, this is likely due to a close, and window is gone
        }

        fin.desktop.InterApplicationBus.publish('window-undocked', {windowName: this.name});

        if (isInitiator) {
            // if this window initiated the undock procedure, move apart slightly from group
            this.openfinWindow.moveBy(this.undockOffsetX, this.undockOffsetY);
        }
        else if (!isInView(this, this.allMonitorBounds)) {
            // if indirectly undocked e.g. last window in group
            this.moveTo(0, 0, this.width, this.height);
        }

        if (group.children.length === 1) {
            group.children[0].leaveDockingGroup();
        }

        if (group.children.length > 0 && !isGroupInView(group.children, this.allMonitorBounds)) {
            group.children[0].moveTo(0, 0);
        }

        this.persistenceService.removeAllRelationships(this.name);

        if (isInitiator) {
            checkForSplitGroup(this.persistenceService, group);
        }
    }
}
