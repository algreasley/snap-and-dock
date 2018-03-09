/* globals fin, localStorage, Promise, Reflect */
/**
 * Created by haseebriaz on 03/03/15.
 */

const GroupEventReason = {
    DISBAND: 'disband',
    JOIN: 'join',
    LEAVE: 'leave',
    MERGE: 'merge'
};

const GroupEventMemberOf = {
    NOTHING: 'nothing',
    SOURCE: 'source',
    TARGET: 'target'
};

function applyOptions(instance, options) {
    if (!options) {
        return;
    }

    // 'range' is the distance between windows at which snapping applies
    if (!isNaN(Number.parseInt(options.range, 10)) && options.range >= 0) {
        instance.range = options.range;
    }

    // 'spacing' is the distance between windows when they become docked
    if (!isNaN(Number.parseInt(options.spacing, 10)) && options.spacing >= 0) {
        instance.spacing = options.spacing;
    }

    // 'undockOffsetX/Y' are offset values - they make the undocked window 'jump' a number of pixels
    if (!isNaN(Number.parseInt(options.undockOffsetX, 10)) && options.undockOffsetX >= 0) {
        instance.undockOffsetX = options.undockOffsetX;
    }
    if (!isNaN(Number.parseInt(options.undockOffsetY, 10)) && options.undockOffsetY >= 0) {
        instance.undockOffsetY = options.undockOffsetY;
    }
}

const DockingGroup = (function() {
    function DockingGroupConstructor() {
        this.children = [];
    }

    DockingGroupConstructor.prototype.add = function (window) {
        if (window.group === this) {
            return;
        }

        this.children.push(window);
        window.group = this;
    };

    DockingGroupConstructor.prototype.remove = function (window) {
        const index = this.children.indexOf(window);
        if (index >= 0) {
            this.children.splice(index, 1);
            window.group = null;
        }
    };

    return DockingGroupConstructor;
}());

const DockableWindow = (function () {
    const openDockableWindows = {};
    const DOCKING_MANAGER_NAMESPACE_PREFIX = 'dockingManager.';

    function getFullStorageKey(id) {
        return DOCKING_MANAGER_NAMESPACE_PREFIX +
            fin.desktop.Application.getCurrent().uuid +
            '.' + id;
    }

    function retrieveRelationshipsFor(id) {
        const storedRelationships = JSON.parse(localStorage.getItem(getFullStorageKey(id)));
        return storedRelationships || [];
    }

    function createRelationship(id1, id2) {
        const partners = retrieveRelationshipsFor(id1);
        if (partners.indexOf(id2) !== -1) {
            return;
        }
        partners.push(id2);
        localStorage.setItem(getFullStorageKey(id1), JSON.stringify(partners));
    }

    function createRelationshipsBetween(id1, id2) {
        createRelationship(id1, id2);
        createRelationship(id2, id1);
    }

    function removeRelationship(id1, id2) {
        const currentPartners = retrieveRelationshipsFor(id1);
        const partnerIndex = currentPartners.indexOf(id2);
        if (partnerIndex === -1) {
            return;
        }

        currentPartners.splice(partnerIndex, 1);

        if (currentPartners.length > 0) {
            localStorage.setItem(getFullStorageKey(id1), JSON.stringify(currentPartners));
        } else {
            localStorage.removeItem(getFullStorageKey(id1));
        }
    }

    function removeAllRelationships(id) {
        // grab existing partner windows before removing all trace of this window's persistence
        const currentPartners = retrieveRelationshipsFor(id);
        localStorage.removeItem(getFullStorageKey(id));

        // remove all 'reverse' relationships from partners too
        for (let i = 0; i < currentPartners.length; i++) {
            removeRelationship(currentPartners[i], id);
        }
    }

    function DockableWindowConstructor(windowOrOptions, dockingOptions) {
        this.createDelegates();

        this.name = windowOrOptions.name;

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

        applyOptions(this, dockingOptions);

        this.currentRange = this.range;
        openDockableWindows[this.name] = this;
    }

    DockableWindowConstructor.prototype.name = '';
    DockableWindowConstructor.prototype.range = 40;
    DockableWindowConstructor.prototype.currentRange = 40;
    DockableWindowConstructor.prototype.x = 0;
    DockableWindowConstructor.prototype.y = 0;
    DockableWindowConstructor.prototype.width = 0;
    DockableWindowConstructor.prototype.height = 0;
    DockableWindowConstructor.prototype.undockOffsetX = 0;
    DockableWindowConstructor.prototype.undockOffsetY = 0;
    DockableWindowConstructor.prototype.openfinWindow = null;
    DockableWindowConstructor.prototype.dockableToOthers = true;
    DockableWindowConstructor.prototype.acceptDockingConnection = true;
    DockableWindowConstructor.prototype.minimized = false;
    DockableWindowConstructor.prototype.group = null;

    DockableWindowConstructor.prototype.onMove = () => { /* placeholder */ };
    DockableWindowConstructor.prototype.onClose = () => { /* placeholder */ };
    DockableWindowConstructor.prototype.onFocus = () => { /* placeholder */ };
    DockableWindowConstructor.prototype.onMoveComplete = () => { /* placeholder */ };
    DockableWindowConstructor.prototype.onMinimize = () => { /* placeholder */ };
    DockableWindowConstructor.prototype.onRestore = () => { /* placeholder */ };
    DockableWindowConstructor.prototype.onLeaveGroup = () => { /* placeholder */ };

    DockableWindowConstructor.prototype.createDelegates = function () {
        this.completeInitialization = this.completeInitialization.bind(this);
        this.onMove = this.onMove.bind(this);
        this.onMoved = this.onMoved.bind(this);
        this.onBounds = this.onBounds.bind(this);
        this.onBoundsChanging = this.onBoundsChanging.bind(this);
        this.onClosed = this.onClosed.bind(this);
        this.onFocused = this.onFocused.bind(this);
        this.onGroupChanged = this.onGroupChanged.bind(this);
        this.onMoveComplete = this.onMoved.bind(this);
        this.onBoundsChanged = this.onBoundsChanged.bind(this);
        this.onBoundsUpdate = this.onBoundsUpdate.bind(this);
        this.onMinimized = this.onMinimized.bind(this);
        this.onRestored = this.onRestored.bind(this);
    };

    DockableWindowConstructor.prototype.onWindowInitialized = function () {
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
    };

    DockableWindowConstructor.prototype.completeInitialization = function (initialWindowBounds) {
        this.onBounds(initialWindowBounds);

        const formerDockingPartners = retrieveRelationshipsFor(this.name);
        for (let i = 0; i < formerDockingPartners.length; i++) {
            const potentialPartnerName = formerDockingPartners[i];
            const potentialPartnerWindow = openDockableWindows[potentialPartnerName];

            /* eslint-disable */
            // TODO: push this stuff out into util class
            if (!potentialPartnerWindow ||
                !DockingManager.getInstance().getSnapDirection(this, potentialPartnerWindow) &&
                !DockingManager.getInstance().getSnapDirection(potentialPartnerWindow, this)) {
                /* eslint-enable */
                // garbage collection, essentially
                // note, if a former partner has not been opened yet, then re-connecting
                // that pair of windows will be handled by that window's persisted relationships
                removeRelationship(this.name, potentialPartnerName);
            } else {
                this.joinDockingGroup(potentialPartnerWindow);
            }
        }
    };

    DockableWindowConstructor.prototype.onBounds = function (bounds) {
        this.width = bounds.width;
        this.height = bounds.height;
        this.x = bounds.left;
        this.y = bounds.top;
    };

    DockableWindowConstructor.prototype.onBoundsUpdate = function (bounds) {
        this.x = bounds.left;
        this.y = bounds.top;
        this.width = bounds.width;
        this.height = bounds.height;
    };

    DockableWindowConstructor.prototype.onBoundsChanging = function (bounds) {
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
    };

    DockableWindowConstructor.prototype.onBoundsChanged = function () {
        this.setOpacity(1);
        this.onMoveComplete({target: this});
    };

    DockableWindowConstructor.prototype.onClosed = function () {
        this.onClose({target: this});
    };

    DockableWindowConstructor.prototype.onFocused = function () {
        this.onFocus(this);
    };

    DockableWindowConstructor.prototype.onMinimized = function () {
        this.minimized = true;
        this.onMinimize(this);
    };

    DockableWindowConstructor.prototype.onRestored = function () {
        this.minimized = false;
        this.onRestore(this);
    };

    DockableWindowConstructor.prototype.moveTo = function (x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width || this.width;
        this.height = height || this.height;

        this.openfinWindow.removeEventListener('disabled-frame-bounds-changing', this.onBoundsChanging);
        this.openfinWindow.setBounds(x, y, this.width, this.height, this.onMoved);
    };

    DockableWindowConstructor.prototype.onMoved = function () {
        this.openfinWindow.addEventListener('disabled-frame-bounds-changing', this.onBoundsChanging);
    };

    function intersect(window1, window2) {
        // check right edge position of first window is to the left of left edge of second window, and so on ..
        // comparison is <= as (xpos + width) is one pixel to the right of the window
        return !(
            window1.x + window1.width <= window2.x ||
            window2.x + window2.width <= window1.x ||
            window1.y + window1.height <= window2.y ||
            window2.y + window2.height <= window1.y
        );
    }

    DockableWindowConstructor.prototype.onGroupChanged = function (groupEvent) {
        if (groupEvent.reason === GroupEventReason.LEAVE && groupEvent.sourceWindowName === this.name) {
            this.onLeaveGroup(this.name);
        }
    };

    DockableWindowConstructor.prototype.joinDockingGroup = function (snappedPartnerWindow) {
        if (this.group || !this.dockableToOthers || !snappedPartnerWindow.acceptDockingConnection) {
            return;
        }

        if (snappedPartnerWindow.group) {
            for (let i = 0; i < snappedPartnerWindow.group.children.length; i++) {
                if (intersect(this, snappedPartnerWindow.group.children[i])) {
                    return;
                }
            }
        }

        if (this.group && !snappedPartnerWindow.group) {
            snappedPartnerWindow.joinDockingGroup(this);
            return;
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

        createRelationshipsBetween(this.name, snappedPartnerWindow.name);
    };

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
        const partnerWindowNames = retrieveRelationshipsFor(currentWindow.name);

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

    DockableWindowConstructor.prototype.leaveDockingGroup = async function (isInitiator) {
        const { group } = this;
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
        else if (!this.isInView()) {
            // if indirectly undocked e.g. last window in group
            this.moveTo(0, 0, this.width, this.height);
        }

        if (group.children.length === 1) {
            group.children[0].leaveDockingGroup();
        }

        if (group.children.length > 0 && !this.isGroupInView(group)) {
            group.children[0].moveTo(0, 0);
        }

        removeAllRelationships(this.name);

        if (isInitiator) {
            checkForSplitGroup(group);
        }
    };

    DockableWindowConstructor.prototype.isInView = function () {
        // eslint-disable-next-line
        // TODO: refactor out to util class
        // eslint-disable-next-line
        const monitors = DockingManager.getInstance().getMonitorInfo();
        for (let i = 0; i < monitors.length; i++) {
            if (intersect(this, monitors[i]) && this.y >= monitors[i].y) {
                return true;
            }
        }

        return false;
    };

    DockableWindowConstructor.prototype.setOpacity = function (value) {
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
    };

    DockableWindowConstructor.prototype.minimize = function () {
        if (this.minimized) {
            return;
        }
        this.openfinWindow.minimize();
    };

    DockableWindowConstructor.prototype.restore = function () {
        if (!this.minimized) {
            return;
        }
        this.openfinWindow.restore();
    };

    DockableWindowConstructor.prototype.isGroupInView = function (group) {
        for (let i = 0; i < group.children.length; i++) {
            if (group.children[i].isInView()) {
                return true;
            }
        }
        return false;
    };

    return DockableWindowConstructor;
}());

const DockingManager = (function () {
    let instance = null;
    const windows = [];
    const snappedWindows = {};
    const monitors = [];

    function requestMonitorInfo() {
        fin.desktop.System.getMonitorInfo((monitorInfo) => {
            const primaryMonitorBounds = monitorInfo.primaryMonitor.availableRect;
            monitors.push({
                x: primaryMonitorBounds.left,
                y: primaryMonitorBounds.top,
                width: primaryMonitorBounds.right - primaryMonitorBounds.left,
                height: primaryMonitorBounds.bottom - primaryMonitorBounds.top
            });

            const currentMonitors = monitorInfo.nonPrimaryMonitors;
            for (let i = 0; i < currentMonitors.length; i++) {
                const nonPrimaryMonitorBounds = currentMonitors[i].availableRect;
                monitors.push({
                    x: nonPrimaryMonitorBounds.left,
                    y: nonPrimaryMonitorBounds.top,
                    width: nonPrimaryMonitorBounds.right - nonPrimaryMonitorBounds.left,
                    height: nonPrimaryMonitorBounds.bottom - nonPrimaryMonitorBounds.top
                });
            }
        });
    }

    function DockingManagerConstructor() {
        this.createDelegates();
        requestMonitorInfo();
    }

    DockingManagerConstructor.getInstance = function () {
        // Deprecated:
        //     Use app framework or similar to manage single instance and access to DockableManagerConstructor instance
        if (!instance) {
            instance = new DockingManagerConstructor();
        }
        return instance;
    };

    DockingManagerConstructor.prototype.range = 40;
    DockingManagerConstructor.prototype.spacing = 5;
    DockingManagerConstructor.prototype.undockOffsetX = 0;
    DockingManagerConstructor.prototype.undockOffsetY = 0;

    DockingManagerConstructor.prototype.init = function (dockingOptions) {
        applyOptions(this, dockingOptions);
    };

    DockingManagerConstructor.prototype.createDelegates = function () {
        this.onWindowMove = this.onWindowMove.bind(this);
        this.onWindowClose = this.onWindowClose.bind(this);
        this.bringWindowOrGroupToFront = this.bringWindowOrGroupToFront.bind(this);
        this.onWindowRestore = this.onWindowRestore.bind(this);
        this.onWindowMinimize = this.onWindowMinimize.bind(this);
        this.dockAllSnappedWindows = this.dockAllSnappedWindows.bind(this);
    };

    DockingManagerConstructor.prototype.getMonitorInfo = function () {
        return monitors;
    };

    DockingManagerConstructor.prototype.undockWindow = function (windowName) {
        for (let i = 0; i < windows.length; i++) {
            if (windows[i].name === windowName) {
                windows[i].leaveDockingGroup(true);
            }
        }
    };

    DockingManagerConstructor.prototype.undockAll = function () {
        for (let i = 0; i < windows.length; i++) {
            windows[i].leaveDockingGroup();
        }
    };

    DockingManagerConstructor.prototype.register = function (window, dockableToOthers) {
        for (let i = 0; i < windows.length; i++) {
            if (windows[i].name === window.name) {
                return;
            }
        }

        const dockableWindow = new DockableWindow(window, {
            range: this.range,
            undockOffsetX: this.undockOffsetX,
            undockOffsetY: this.undockOffsetY
        });
        dockableWindow.dockableToOthers = dockableToOthers !== false;
        dockableWindow.onMove = this.onWindowMove;
        dockableWindow.onMoveComplete = this.dockAllSnappedWindows;
        dockableWindow.onClose = this.onWindowClose;
        dockableWindow.onFocus = this.bringWindowOrGroupToFront;
        dockableWindow.onRestore = this.onWindowRestore;
        dockableWindow.onMinimize = this.onWindowMinimize;
        dockableWindow.onLeaveGroup = this.undockWindow;
        windows.push(dockableWindow);
    };

    DockingManagerConstructor.prototype.unregister = function (window) {
        this.unregisterByName(window.name);
    };

    DockingManagerConstructor.prototype.unregisterByName = function (windowName) {
        for (let i = 0; i < windows.length; i++) {
            if (windows[i].name === windowName) {
                const [removedDockableWindow] = windows.splice(i, 1);
                // purge from DockableGroup etc., otherwise it will still influence other DockableWindows
                removedDockableWindow.leaveDockingGroup(true);
            }
        }
    };

    DockingManagerConstructor.prototype.onWindowClose = function (event) {
        this.unregister(event.target);
    };

    DockingManagerConstructor.prototype.bringWindowOrGroupToFront = function (dockingWindow) {
        const affectedWindows = dockingWindow.group
            ? dockingWindow.group.children
            : [dockingWindow];

        for (let i = 0; i < affectedWindows.length; i++) {
            affectedWindows[i].openfinWindow.bringToFront();
        }
    };

    DockingManagerConstructor.prototype.onWindowRestore = function (dockableWindow) {
        if (!dockableWindow.group) {
            return;
        }

        const windowsInGroup = dockableWindow.group.children;
        for (let i = 0; i < windowsInGroup.length; i++) {
            windowsInGroup[i].restore();
        }
    };

    DockingManagerConstructor.prototype.onWindowMinimize = function (dockableWindow) {
        if (!dockableWindow.group) {
            return;
        }

        const windowsInGroup = dockableWindow.group.children;
        for (let i = 0; i < windowsInGroup.length; i++) {
            windowsInGroup[i].minimize();
        }
    };

    DockingManagerConstructor.prototype.onWindowMove = function (event) {
        const currentWindow = event.target;
        if (currentWindow.group) {
            return;
        }

        // eslint-disable-next-line
        // TODO: refactor mutable event
        event.bounds.currentRange = currentWindow.currentRange;

        const position = {
            x: null,
            y: null
        };

        for (let i = windows.length - 1; i >= 0; i--) {
            const dockableWindow = windows[i];
            let snapDirection = this.getSnapDirection(event.bounds, dockableWindow);

            if (!snapDirection) {
                snapDirection = this.reverseSnapDirection(this.getSnapDirection(dockableWindow, event.bounds));
            }

            if (snapDirection) {
                currentWindow.currentRange = currentWindow.range + 10;
                // eslint-disable-next-line
                // TODO: keep DOM events to handlers, or preferably contain within DW
                const pos = this.getSnappedCoordinates(event, dockableWindow, snapDirection);

                this.bringWindowOrGroupToFront(dockableWindow);

                if (!position.x) {
                    position.x = pos.x;
                }

                if (!position.y) {
                    position.y = pos.y;
                }

                this.addToSnapList(currentWindow, dockableWindow);
            } else {
                currentWindow.currentRange = currentWindow.range;
                this.removeFromSnapList(currentWindow, dockableWindow);
            }
        }

        if (position.x || position.y) {
            event.preventDefault = true;

            position.x = position.x ? position.x : event.bounds.x;
            position.y = position.y ? position.y : event.bounds.y;
            currentWindow.moveTo(position.x, position.y);

            this.checkIfStillSnapped();
        }
    };

    DockingManagerConstructor.prototype.checkIfStillSnapped = function () {
        Object.values(snappedWindows).forEach((snappedWindowInfo) => {
            if (snappedWindowInfo &&
                !this.getSnapDirection(snappedWindowInfo[0], snappedWindowInfo[1]) &&
                !this.getSnapDirection(snappedWindowInfo[1], snappedWindowInfo[0])) {
                // currentWindow[1].setOpacity(1);
                this.removeFromSnapList(snappedWindowInfo[0], snappedWindowInfo[1]);
            }
        });
    };

    DockingManagerConstructor.prototype.getSnapDirection = function (currentWidow, window) {
        const isInVerticalZone = this.isPointInVerticalZone(window.y, window.y + window.height, currentWidow.y, currentWidow.height);

        if (isInVerticalZone && currentWidow.x > window.x + window.width - currentWidow.currentRange && currentWidow.x < window.x + window.width + currentWidow.currentRange) {
            return 'right';
        }

        if (isInVerticalZone && currentWidow.x + currentWidow.width > window.x - currentWidow.currentRange && currentWidow.x + currentWidow.width < window.x + currentWidow.currentRange) {
            return 'left';
        }

        const isInHorizontalZone = this.isPointInHorizontalZone(window.x, window.x + window.width, currentWidow.x, currentWidow.width);

        if (isInHorizontalZone && currentWidow.y > window.y + window.height - currentWidow.currentRange && currentWidow.y < window.y + window.height + currentWidow.currentRange) {
            return 'bottom';
        }

        if (isInHorizontalZone && currentWidow.y + currentWidow.height > window.y - currentWidow.currentRange && currentWidow.y + currentWidow.height < window.y + currentWidow.currentRange) {
            return 'top';
        }

        return false;
    };

    DockingManagerConstructor.prototype.isPointInVerticalZone = function (startY, endY, y, height) {
        const bottomEdgePosition = y + height;
        return y >= startY && y <= endY || bottomEdgePosition >= startY && bottomEdgePosition <= endY;
    };

    DockingManagerConstructor.prototype.isPointInHorizontalZone = function (startX, endX, x, width) {
        const rightEdgePosition = x + width;
        return x >= startX && x <= endX || rightEdgePosition >= startX && rightEdgePosition <= endX;
    };

    DockingManagerConstructor.prototype.reverseSnapDirection = function (value) {
        switch (value) {
            case 'right':
                return 'left';
            case 'left':
                return 'right';
            case 'top':
                return 'bottom';
            case 'bottom':
                return 'top';
            default:
                return null;
        }
    };

    DockingManagerConstructor.prototype.getSnappedCoordinates = function (event, window, position) {
        const currentWindow = event.target;
        switch (position) {
            case 'right':
                return {
                    x: window.x + window.width + this.spacing,
                    y: this.getVerticalEdgeSnapping(window, event.bounds)
                };
            case 'left':
                return {
                    x: window.x - currentWindow.width - this.spacing,
                    y: this.getVerticalEdgeSnapping(window, event.bounds)
                };
            case 'top':
                return {
                    x: this.getHorizontalEdgeSnapping(window, event.bounds),
                    y: window.y - currentWindow.height - this.spacing
                };
            case 'bottom':
                return {
                    x: this.getHorizontalEdgeSnapping(window, event.bounds),
                    y: window.y + window.height + this.spacing
                };
            default:
                return null;
        }
    };

    DockingManagerConstructor.prototype.getVerticalEdgeSnapping = function (window, currentWindow) {
        if (currentWindow.y <= window.y + this.range && currentWindow.y >= window.y - this.range) {
            return window.y;
        }
        if (currentWindow.y + currentWindow.height >= window.y + window.height - this.range &&
            currentWindow.y + currentWindow.height <= window.y + window.height + this.range) {
            return window.y + window.height - currentWindow.height;
        }
        return null;
    };

    DockingManagerConstructor.prototype.getHorizontalEdgeSnapping = function (window, currentWindow) {
        if (currentWindow.x <= window.x + this.range && currentWindow.x >= window.x - this.range) {
            return window.x;
        }
        if (currentWindow.x + currentWindow.width >= window.x + window.width - this.range &&
            currentWindow.x + currentWindow.width <= window.x + window.width + this.range) {
            return window.x + window.width - currentWindow.width;
        }
        return null;
    };

    DockingManagerConstructor.prototype.addToSnapList = function (window1, window2) {
        snappedWindows[window1.name + window2.name] = [
            window1,
            window2
        ];
        window1.setOpacity(0.5);
        window2.setOpacity(0.5);
    };

    DockingManagerConstructor.prototype.removeFromSnapList = function (window1, window2) {
        if (snappedWindows[window1.name + window2.name]) {
            Reflect.deleteProperty(snappedWindows, window1.name + window2.name);
            window2.setOpacity(1);
        }
    };

    DockingManagerConstructor.prototype.dockAllSnappedWindows = function () {
        Object.values(snappedWindows).forEach((snappedWindowInfo) => {
            this.removeFromSnapList(snappedWindowInfo[0], snappedWindowInfo[1]);
            this.addWindowToTheGroup(snappedWindowInfo[0], snappedWindowInfo[1]);
        });
    };

    DockingManagerConstructor.prototype.addWindowToTheGroup = function (snappedWindow, groupedWindow) {
        snappedWindow.setOpacity(1);
        snappedWindow.joinDockingGroup(groupedWindow);
    };

    return DockingManagerConstructor;
}());

export {DockingManager, GroupEventReason, GroupEventMemberOf};
