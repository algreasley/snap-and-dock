/* globals fin, Promise */
import {applyOptions, intersect, isGroupInView, isInView, getSnapDirection} from "./DockingUtil.js";
import {getAppId, GroupEventReason} from "./OpenFinWrapper.js";
import LocalStoragePersistence from "./LocalStoragePersistence.js";
import DockingGroup from "./DockingGroup.js";

const DOCKING_MANAGER_NAMESPACE_PREFIX = 'dockingManager.';
const persistence = new LocalStoragePersistence(DOCKING_MANAGER_NAMESPACE_PREFIX + getAppId());

const dockingDefaults = {
    // options initended for external configuration
    range: 40,
    undockOffsetX: 0,
    undockOffsetY: 0,
    dockableToOthers: true,
};

const openDockableWindows = {};

function getWindowByName(windowList, windowName) {
    for (let i = 0; i < windowList.length; i++) {
        if (windowList[i].name === windowName) {
            return windowList[i];
        }
    }
    return null;
}

async function regroup(allWindowsToRegroup, previousWindow, currentWindow, isNewGroup) {
    // console.warn(`Regroup ${currentWindow.name}`);

    const currentWindowIndex = allWindowsToRegroup.indexOf(currentWindow);
    if (currentWindowIndex === -1) {
        return; // already traversed
    }

    // Important, get orig partnerships, before leave/join group destroys them below
    const partnerWindowNames = persistence.retrieveRelationshipsFor(currentWindow.name);

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

    // console.warn(`handlePartners ${currentWindow.name}, ${partnerWindowNames}`);
    for (let i = 0; i < partnerWindowNames.length; i++) {
        const partnerWindow = getWindowByName(allWindowsToRegroup, partnerWindowNames[i]);

        if (partnerWindow) {
            // we actively want to serialise these operations, so parallelizing is _not_ what we want
            // eslint-disable-next-line no-await-in-loop
            await regroup(allWindowsToRegroup, currentWindow, partnerWindow, isNewGroup);
        }
    }
}

async function checkForSplitGroup(dockingGroup) {
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
        await regroup(windowsToRegroup, null, startWindow, !existingDockingGroup);

        if (existingDockingGroup && startWindow.group) {
            existingDockingGroup = null;
        }
    }
}

// x = 0;
// y = 0;
// width = 0;
// height = 0;

export default class DockingWindow {
    constructor(windowOrOptions, dockingOptions, monitorBounds) {
        this.createDelegates();
        this.name = windowOrOptions.name;
        this.monitorBounds = monitorBounds;
        // simple property defaults
        this.opacity = 1;
        this.acceptDockingConnection = true;
        this.minimized = false;
        this.group = null;

        if (windowOrOptions instanceof fin.desktop.Window) {
            this.openfinWindow = windowOrOptions;
        } else {
            this.openfinWindow = new fin.desktop.Window(windowOrOptions);
        }

        // OpenFin Window is definitely created now, but may not be fully initialized
        this.openfinWindow.getInfo(
            () => this.onWindowInitialized(),
            () => this.openfinWindow.addEventListener('initialized', () => this.onWindowInitialized())
        );

        applyOptions(this, Object.assign({}, dockingDefaults, dockingOptions));

        this.currentRange = this.range;
        openDockableWindows[this.name] = this;
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
        if (this.opacity === value) {
            return;
        }
        this.opacity = value;
        this.openfinWindow.animate({
            opacity: {
                opacity: value,
                duration: 0
            }
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
    // (use arrow funcs when possible, and remove this function)
    createDelegates() {
        // this.onMove = this.onMove.bind(this);
        // this.onMoveComplete = this.onMoved.bind(this);
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

        const formerDockingPartners = persistence.retrieveRelationshipsFor(this.name);
        for (let i = 0; i < formerDockingPartners.length; i++) {
            const potentialPartnerName = formerDockingPartners[i];
            const potentialPartnerWindow = openDockableWindows[potentialPartnerName];

            /* eslint-disable */
            // TODO: push this stuff out into util class
            if (!potentialPartnerWindow ||
                !getSnapDirection(this, potentialPartnerWindow) &&
                !getSnapDirection(potentialPartnerWindow, this)) {
                /* eslint-enable */
                // garbage collection, essentially
                // note, if a former partner has not been opened yet, then re-connecting
                // that pair of windows will be handled by that window's persisted relationships
                persistence.removeRelationship(this.name, potentialPartnerName);
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
            this.setOpacity(0.5);
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
        this.setOpacity(1);
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

        persistence.createRelationshipsBetween(this.name, snappedPartnerWindow.name);
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
        else if (!isInView(this, this.monitorBounds)) {
            // if indirectly undocked e.g. last window in group
            this.moveTo(0, 0, this.width, this.height);
        }

        if (group.children.length === 1) {
            group.children[0].leaveDockingGroup();
        }

        if (group.children.length > 0 && !isGroupInView(group.children, this.monitorBounds)) {
            group.children[0].moveTo(0, 0);
        }

        persistence.removeAllRelationships(this.name);

        if (isInitiator) {
            checkForSplitGroup(group);
        }
    }
}
