/* globals Reflect */
import {applyOptions, getSnapDirection, reverseSnapDirection} from "./DockingUtil.js";
import DockingWindow from "./DockingWindow.js";
import {getAppId, requestMonitorInfo} from "./OpenFinWrapper.js";
import LocalStoragePersistence from "./LocalStoragePersistence.js";

const DEFAULT_RANGE = 40;
const DEFAULT_SPACING = 5;
const DEFAULT_UNDOCK_OFFSET = 0;

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
        this.range = DEFAULT_RANGE;
        this.spacing = DEFAULT_SPACING;
        this.undockOffsetX = DEFAULT_UNDOCK_OFFSET;
        this.undockOffsetY = DEFAULT_UNDOCK_OFFSET;

        this.persistenceService =
            new LocalStoragePersistence(DOCKING_MANAGER_NAMESPACE_PREFIX + getAppId());
        this.initMonitorInfo();
        this.createDelegates();
        applyOptions(this, dockingOptions);
    }

    async initMonitorInfo() {
        const monitors = await requestMonitorInfo();
        monitors.forEach(monitorInfo => this.monitors.push(monitorInfo));
    }

    createDelegates() {
        // DW handlers must have DM burned in as context
        // can all be dropped when class properties / arrow functions as methods are standard
        this.onWindowMove = this.onWindowMove.bind(this);
        this.dockAllSnappedWindows = this.dockAllSnappedWindows.bind(this);
        this.onWindowClose = this.onWindowClose.bind(this);
        this.bringWindowOrGroupToFront = this.bringWindowOrGroupToFront.bind(this);
        this.onWindowRestore = this.onWindowRestore.bind(this);
        this.onWindowMinimize = this.onWindowMinimize.bind(this);
        this.undockWindow = this.undockWindow.bind(this);
    }

    undockWindow(windowName) {
        const existingWindow = this.windows.find(window => window.name === windowName);
        if (existingWindow) {
            existingWindow.leaveDockingGroup(true);
        }
    }

    undockAll() {
        this.windows.forEach(window => window.leaveDockingGroup());
    }

    register(window, dockableToOthers) {
        if (this.windows.some(registeredWindow => registeredWindow.name === window.name)) {
            return;
        }

        const dockingOptions = {
            range: this.range,
            undockOffsetX: this.undockOffsetX,
            undockOffsetY: this.undockOffsetY,
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

    onWindowClose(event) {
        this.unregister(event.target);
    }

    bringWindowOrGroupToFront(dockingWindow) {
        const affectedWindows = dockingWindow.group
            ? dockingWindow.group.children
            : [dockingWindow];

        affectedWindows.forEach(window => window.openfinWindow.bringToFront());
    }

    onWindowRestore(dockableWindow) {
        if (!dockableWindow.group) {
            return;
        }
        dockableWindow.group.children.forEach(window => window.restore());
    }

    onWindowMinimize(dockableWindow) {
        if (!dockableWindow.group) {
            return;
        }
        dockableWindow.group.children.forEach(window => window.minimize());
    }

    onWindowMove(event) {
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

        for (let i = this.windows.length - 1; i >= 0; i--) {
            const dockableWindow = this.windows[i];
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
    }

    checkIfStillSnapped() {
        Object.values(this.snappedWindows).forEach((snappedWindowInfo) => {
            if (snappedWindowInfo &&
                !getSnapDirection(snappedWindowInfo[0], snappedWindowInfo[1]) &&
                !getSnapDirection(snappedWindowInfo[1], snappedWindowInfo[0])) {
                // currentWindow[1].setOpacity(1);
                this.removeFromSnapList(snappedWindowInfo[0], snappedWindowInfo[1]);
            }
        });
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
        window1.setOpacity(0.5);
        window2.setOpacity(0.5);
    }

    removeFromSnapList(window1, window2) {
        if (this.snappedWindows[window1.name + window2.name]) {
            Reflect.deleteProperty(this.snappedWindows, window1.name + window2.name);
            window2.setOpacity(1);
        }
    }

    dockAllSnappedWindows() {
        Object.values(this.snappedWindows).forEach((snappedWindowInfo) => {
            this.removeFromSnapList(snappedWindowInfo[0], snappedWindowInfo[1]);
            this.addWindowToTheGroup(snappedWindowInfo[0], snappedWindowInfo[1]);
        });
    }

    addWindowToTheGroup(snappedWindow, groupedWindow) {
        snappedWindow.setOpacity(1);
        snappedWindow.joinDockingGroup(groupedWindow);
    }
}