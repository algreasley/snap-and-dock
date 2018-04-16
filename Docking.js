/* globals fin, localStorage, window, document, screen, console */
/* eslint-disable no-console */
import DockingManager from './lib/DockingManager.js';
import {GroupEventMemberOf, GroupEventReason} from "./lib/OpenFinWrapper.js";

/**
 * Created by haseebriaz on 03/03/15.
 */

let dockingManager;

function getDockingManager() {
    // Apply any of the following options
    // if you want to modify the docking parameters
    const dockingOptions = {
        // range: 20,
        // spacing: 0,
        // undockOffsetX: 25,
        // undockOffsetY: 25,
        // movingOpacity: 0.6,
        // snappedMovingOpacity: 0.8,
        // snappedTargetOpacity: 1
    };

    if (!dockingManager) {
        dockingManager = new DockingManager(dockingOptions);
    }
    return dockingManager;
}

function onGroupChanged(groupEvent) {
    // leaving is simple ... if member of 'nothing', then this window is leaving
    if (groupEvent.memberOf === GroupEventMemberOf.NOTHING) {
        console.log('group-changed event: ' + groupEvent.name + ' left group');
        return;
    }

    // joining is a little more complicated ...
    // if sourceWindowName is the same as name, that is a primary join event
    // but at group setup, the first window is only a 'target' of a join
    // (for the 2 setup events, the target group has just those 2 members)
    if (groupEvent.reason === GroupEventReason.JOIN) {
        if (groupEvent.sourceWindowName === groupEvent.name ||
            groupEvent.targetGroup.length === 2 &&
            groupEvent.targetWindowName  === groupEvent.name) {
            console.log('group-changed event: ' + groupEvent.name + ' joined group');
        }
    }
}

function createAndRegister(windowNameSuffix) {
    const windowOptions = {
        name: `child${windowNameSuffix}`,
        url: 'childWindow.html',
        defaultWidth: 200,
        defaultHeight: 150,
        defaultTop: (screen.availHeight - 200) / 2,
        defaultLeft: (screen.availWidth - 150) / 2,
        frame: false,
        autoShow: true
    };

    const openfinWindow = new fin.desktop.Window(
        windowOptions,
        function() {
            dockingManager.register(openfinWindow);
        }
    );

    // To test using DockingWindow to create the OpenFin window
    //
    // dockingManager.register(windowOptions);

    openfinWindow.addEventListener('group-changed', onGroupChanged);
}

function onOpenFinReady() {
    const dockingManager = getDockingManager();
    dockingManager.register(fin.desktop.Window.getCurrent(), false);

    let counter = 0;
    document.getElementById('createWindows').onclick = () => { createAndRegister(++counter); };

    // convenience to restore up to 10 docked child windows from previous persistance
    for (let tempCounter = 0; tempCounter < 10; tempCounter++) {
        const DOCKING_MANAGER_NAMESPACE_PREFIX = 'dockingManager.';
        const windowStorageKey = `${DOCKING_MANAGER_NAMESPACE_PREFIX}${fin.desktop.Application.getCurrent().uuid}.child${tempCounter}`;
        if (localStorage.getItem(windowStorageKey)) {
            createAndRegister(tempCounter);
            counter = tempCounter;
        }
    }

    fin.desktop.InterApplicationBus.subscribe('*', 'window-docked', function(message) {
        console.log('window-docked subscription: ' + message.windowName + ' joined group');
    });

    fin.desktop.InterApplicationBus.subscribe('*', 'window-undocked', function(message) {
        console.log('window-undocked subscription: ' + message.windowName + ' left group');
    });

    // bus-based handling for external java application docking

    fin.desktop.InterApplicationBus.subscribe('*', 'register-docking-window', function(message) {
        const { appUuid, name } = message;
        console.log('Registering external window', appUuid, name);
        const javaWindow = fin.desktop.Window.wrap(appUuid, name);
        dockingManager.register(javaWindow);
    });

    fin.desktop.InterApplicationBus.publish('status-update', {status: 'ready'});
}

window.addEventListener('DOMContentLoaded', () => fin.desktop.main(onOpenFinReady));
