/* globals Reflect */
import {applyOptions, getSnapDirection, reverseSnapDirection} from "./DockingUtil.js";
import DockingWindow from "./DockingWindow.js";
import {requestMonitorInfo} from "./OpenFinWrapper.js";

const DockingManager = (function () {
    let instance = null;
    const windows = [];
    const snappedWindows = {};
    const monitors = [];

    function handleMonitorInfo(openfinMonitorInfo) {
        const primaryMonitorBounds = openfinMonitorInfo.primaryMonitor.availableRect;
        monitors.push({
            x: primaryMonitorBounds.left,
            y: primaryMonitorBounds.top,
            width: primaryMonitorBounds.right - primaryMonitorBounds.left,
            height: primaryMonitorBounds.bottom - primaryMonitorBounds.top
        });

        const currentMonitors = openfinMonitorInfo.nonPrimaryMonitors;
        for (let i = 0; i < currentMonitors.length; i++) {
            const nonPrimaryMonitorBounds = currentMonitors[i].availableRect;
            monitors.push({
                x: nonPrimaryMonitorBounds.left,
                y: nonPrimaryMonitorBounds.top,
                width: nonPrimaryMonitorBounds.right - nonPrimaryMonitorBounds.left,
                height: nonPrimaryMonitorBounds.bottom - nonPrimaryMonitorBounds.top
            });
        }
    }

    function DockingManagerConstructor() {
        this.createDelegates();
        requestMonitorInfo(handleMonitorInfo);
    }

    DockingManagerConstructor.getInstance = function () {
        // Deprecated:
        //     Use app framework or similar to manage single instance and access to DockableManagerConstructor instance
        if (!instance) {
            instance = new DockingManagerConstructor();
        }
        return instance;
    };

    DockingManagerConstructor.getMonitorInfo = function () {
        return monitors;
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
        if (windows.some(registeredWindow => registeredWindow.name === window.name)) {
            return;
        }

        const dockingOptions = {
            range: this.range,
            undockOffsetX: this.undockOffsetX,
            undockOffsetY: this.undockOffsetY,
            dockableToOthers: dockableToOthers !== false
        };
        const dockingWindow = new DockingWindow(window, dockingOptions, monitors);
        dockingWindow.onMove = this.onWindowMove;
        dockingWindow.onMoveComplete = this.dockAllSnappedWindows;
        dockingWindow.onClose = this.onWindowClose;
        dockingWindow.onFocus = this.bringWindowOrGroupToFront;
        dockingWindow.onRestore = this.onWindowRestore;
        dockingWindow.onMinimize = this.onWindowMinimize;
        dockingWindow.onLeaveGroup = this.undockWindow;
        windows.push(dockingWindow);
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
            let snapDirection = getSnapDirection(event.bounds, dockableWindow);

            if (!snapDirection) {
                snapDirection = reverseSnapDirection(getSnapDirection(dockableWindow, event.bounds));
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
                !getSnapDirection(snappedWindowInfo[0], snappedWindowInfo[1]) &&
                !getSnapDirection(snappedWindowInfo[1], snappedWindowInfo[0])) {
                // currentWindow[1].setOpacity(1);
                this.removeFromSnapList(snappedWindowInfo[0], snappedWindowInfo[1]);
            }
        });
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

export {DockingManager};
