/* globals fin, window, document, screen, console */
/* eslint-disable no-console */
import DockingManager from './lib/DockingManager.js';
import {GroupEventMemberOf, GroupEventReason} from "./lib/OpenFinWrapper.js";

// import Layouts from './node_modules/openfin-layouts/dist/client/main.js';
import * as Layouts from 'openfin-layouts';

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
        unregisterOnClose: false
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
        url: 'child.html',
        defaultWidth: 200,
        defaultHeight: 150,
        defaultTop: (screen.availHeight - 200) / 2,
        defaultLeft: (screen.availWidth - 150) / 2,
        frame: false,
        shadow: true,
        autoShow: true
    };

    const openfinWindow = new fin.desktop.Window(
        windowOptions,
        function() {
            console.warn('NOT REGISTERING, TO TEST LAYOUT SERVICE')
            // dockingManager.register(openfinWindow);
        }
    );

    // To test using DockingWindow to create the OpenFin window
    //
    // dockingManager.register(windowOptions);

    openfinWindow.addEventListener('group-changed', onGroupChanged);
}

async function getLayout() {
    console.warn('Getting layout ...');
    const layout = await Layouts.generateLayout();
    console.warn(layout);
}

function onOpenFinReady() {
    // const dockingManager = getDockingManager();
    // dockingManager.register(fin.desktop.Window.getCurrent(), false);

    fin.desktop.System.addEventListener("window-file-download-started", function (event) {
        console.log("File download started", event);
    });

    fin.desktop.System.addEventListener("window-file-download-progress", function (event) {
        console.log("File download progress", event);
    });

    fin.desktop.System.addEventListener("window-file-download-completed", function (event) {
        console.log("File download done", event);
        if (event.state === 'cancelled') {
            console.warn("Download cancelled: ", event.originalFileName);
        }
        fin.desktop.System.launchExternalProcess({fileUuid: event.fileUuid})
    });

    Layouts.deregister();

    let counter = 0;
    document.getElementById('createWindows').onclick = () => { createAndRegister(++counter); };

    document.getElementById('getLayout').onclick = getLayout;

    // convenience to restore up to 10 docked child windows from previous persistance
    // for (let tempCounter = 0; tempCounter < 10; tempCounter++) {
    //     const DOCKING_MANAGER_NAMESPACE_PREFIX = 'dockingManager.';
    //     const windowStorageKey = `${DOCKING_MANAGER_NAMESPACE_PREFIX}${fin.desktop.Application.getCurrent().uuid}.child${tempCounter}`;
    //     if (localStorage.getItem(windowStorageKey)) {
    //         createAndRegister(tempCounter);
    //         counter = tempCounter;
    //     }
    // }

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
