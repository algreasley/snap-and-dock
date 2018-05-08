/* globals Reflect */
import {applyOptions} from "./OptionsParser.js";
import {getSnapDirection, reverseSnapDirection} from "./DockingUtil.js";
import DockingWindow from "./DockingWindow.js";
import {getAppId, requestMonitorInfo} from "./OpenFinWrapper.js";
import LocalStoragePersistence from "./LocalStoragePersistence.js";

const dockingOptionDefaults = {
    range: 40,
    spacing: 5,
    undockOffsetX: 0,
    undockOffsetY: 0,
    movingOpacity: 0.5,
    snappedMovingOpacity: 0.5,
    snappedTargetOpacity: 0.5
};

const DOCKING_MANAGER_NAMESPACE_PREFIX = 'dockingManager.';

export default class DockingManager {
    constructor(dockingOptions) {
        // references of all windows registered for docking
        this.windows = [];
        // monitor data (rectangles) retrieved asynchronously
        // .. will be present by the time windows interact
        this.monitors = [];
        // temporary list of snappable window references
        this.snappedWindows = {};
        // default options
        this.persistenceService =
            new LocalStoragePersistence(DOCKING_MANAGER_NAMESPACE_PREFIX + getAppId());
        this.initMonitorInfo();
        this.createDelegates();
        applyOptions(this, dockingOptions, dockingOptionDefaults);
    }

    async initMonitorInfo() {
        const monitors = await requestMonitorInfo();
        for (const monitorInfo of monitors) {
            // add to monitors array, rather than replacing the ref, in case window already initialised with ref
            this.monitors.push(monitorInfo);
        }
    }

    createDelegates() {
        // DW handlers, that need access to DM instance members, must have DM burned in as context
        // (can all be dropped when class properties / arrow functions as methods are standard)
        this.onWindowMove = this.onWindowMove.bind(this);
        this.dockAllSnappedWindows = this.dockAllSnappedWindows.bind(this);
        this.onWindowClose = this.onWindowClose.bind(this);
        this.undockWindow = this.undockWindow.bind(this);
    }

    register(window, dockableToOthers) {
        if (this.windows.some(registeredWindow => registeredWindow.name === window.name)) {
            return;
        }

        const dockingOptions = {
            range: this.range,
            undockOffsetX: this.undockOffsetX,
            undockOffsetY: this.undockOffsetY,
            movingOpacity: this.movingOpacity,
            dockableToOthers: dockableToOthers !== false,
            allMonitorBounds: this.monitors,
            persistenceService: this.persistenceService
        };
        const dockingWindow = new DockingWindow(window, dockingOptions);
        dockingWindow.onMove = this.onWindowMove;
        dockingWindow.onMoveComplete = this.dockAllSnappedWindows;
        dockingWindow.onClose = this.onWindowClose;
        dockingWindow.onFocus = this.bringWindowOrGroupToFront;
        dockingWindow.onRestore = this.onWindowRestore;
        dockingWindow.onMinimize = this.onWindowMinimize;
        dockingWindow.onLeaveGroup = this.undockWindow;
        this.windows.push(dockingWindow);
    }

    unregister(window) {
        this.unregisterByName(window.name);
    }

    unregisterByName(windowName) {
        const existingWindowIdx = this.windows.findIndex(window => window.name === windowName);
        if (existingWindowIdx > -1) {
            const [removedDockableWindow] = this.windows.splice(existingWindowIdx, 1);
            // purge from DockableGroup etc., otherwise it will still influence other DockableWindows
            removedDockableWindow.leaveDockingGroup(true);
        }
    }

    undockWindow(windowName) {
        const existingWindow = DockingWindow.getWindowByName(this.windows, windowName);
        if (existingWindow) {
            existingWindow.leaveDockingGroup(true);
        }
    }

    undockAll() {
        for (const dockingWindow of this.windows) {
            dockingWindow.leaveDockingGroup();
        }
    }

    onWindowClose(event) {
        this.unregister(event.target);
    }

    bringWindowOrGroupToFront(dockingWindow) {
        if (dockingWindow.group) {
            for (const groupDockingWindow of dockingWindow.group.children) {
                groupDockingWindow.openfinWindow.bringToFront();
            }
        }
        dockingWindow.openfinWindow.bringToFront();
    }

    onWindowRestore(dockingWindow) {
        if (!dockingWindow.group) {
            return;
        }

        for (const groupedDockingWindow of dockingWindow.group.children) {
            groupedDockingWindow.restore();
        }
    }

    onWindowMinimize(dockingWindow) {
        if (!dockingWindow.group) {
            return;
        }

        for (const groupedDockingWindow of dockingWindow.group.children) {
            groupedDockingWindow.minimize();
        }
    }

    onWindowMove(event) {
        const currentWindow = event.target;
        if (currentWindow.group) {
            return;
        }

        // TODO: refactor mutable event
        event.bounds.currentRange = currentWindow.currentRange;

        const position = {
            x: null,
            y: null
        };

        for (let i = this.windows.length - 1; i >= 0; i--) {
            const dockableWindow = this.windows[i];
            let snapDirection = getSnapDirection(event.bounds, dockableWindow);

            if (!snapDirection) {
                snapDirection = reverseSnapDirection(getSnapDirection(dockableWindow, event.bounds));
            }

            if (snapDirection) {
                currentWindow.currentRange = currentWindow.range + 10;
                // TODO: keep DOM events to handlers, or preferably contain within DW
                const pos = this.getSnappedCoordinates(event, dockableWindow, snapDirection);

                this.bringWindowOrGroupToFront(dockableWindow);
                currentWindow.openfinWindow.bringToFront();

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
    }

    checkIfStillSnapped() {
        for (const snappedWindowInfo of Object.values(this.snappedWindows)) {
            if (snappedWindowInfo &&
                !getSnapDirection(snappedWindowInfo[0], snappedWindowInfo[1]) &&
                !getSnapDirection(snappedWindowInfo[1], snappedWindowInfo[0])) {
                this.removeFromSnapList(snappedWindowInfo[0], snappedWindowInfo[1]);
            }
        }
    }

    getSnappedCoordinates(event, window, position) {
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
    }

    getVerticalEdgeSnapping(window, currentWindow) {
        if (currentWindow.y <= window.y + this.range && currentWindow.y >= window.y - this.range) {
            return window.y;
        }
        if (currentWindow.y + currentWindow.height >= window.y + window.height - this.range &&
            currentWindow.y + currentWindow.height <= window.y + window.height + this.range) {
            return window.y + window.height - currentWindow.height;
        }
        return null;
    }

    getHorizontalEdgeSnapping(window, currentWindow) {
        if (currentWindow.x <= window.x + this.range && currentWindow.x >= window.x - this.range) {
            return window.x;
        }
        if (currentWindow.x + currentWindow.width >= window.x + window.width - this.range &&
            currentWindow.x + currentWindow.width <= window.x + window.width + this.range) {
            return window.x + window.width - currentWindow.width;
        }
        return null;
    }

    addToSnapList(window1, window2) {
        this.snappedWindows[window1.name + window2.name] = [
            window1,
            window2
        ];
        window1.setOpacity(this.snappedMovingOpacity);
        window2.setOpacity(this.snappedTargetOpacity);
    }

    removeFromSnapList(window1, window2) {
        if (this.snappedWindows[window1.name + window2.name]) {
            Reflect.deleteProperty(this.snappedWindows, window1.name + window2.name);
            window2.resetOpacity();
        }
    }

    dockAllSnappedWindows() {
        for (const snappedWindowInfo of Object.values(this.snappedWindows)) {
            this.removeFromSnapList(snappedWindowInfo[0], snappedWindowInfo[1]);
            this.addWindowToTheGroup(snappedWindowInfo[0], snappedWindowInfo[1]);
        }
    }

    addWindowToTheGroup(snappedWindow, groupedWindow) {
        snappedWindow.resetOpacity();
        snappedWindow.joinDockingGroup(groupedWindow);
    }
}
