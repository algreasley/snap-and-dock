/* globals beforeEach, describe, it */
/* globals fin */
import assert from 'assert';
import * as sinon from 'sinon';
import DockingManager from '../../lib/DockingManager.js';

describe('DockingManager (registration)', function () {
    let dockingManager;

    beforeEach(function () {
        dockingManager = new DockingManager();
    });

    describe('when an existing window is registered', function () {
        const windowName = 'dummyExisting';
        let dummyOpenfinWindow;
        let getOptionsFake;

        beforeEach(function () {
            getOptionsFake = sinon.fake();
            fin.desktop.Window.prototype.getOptions = getOptionsFake;
            dummyOpenfinWindow = new fin.desktop.Window({name: windowName});
            dockingManager.register(dummyOpenfinWindow);
        });

        it('should be recorded as a participant in the set of docking windows', function () {
            assert.equal(dockingManager.windows.length, 1);
            assert.equal(getOptionsFake.callCount, 1);
        });

        it('should have no effect if a window with the same name is registered again', function () {
            dockingManager.register(dummyOpenfinWindow);
            assert.equal(dockingManager.windows.length, 1);
        });

        it('should be removed from the set of docking windows if unregistered by window object', function () {
            dockingManager.unregister(dummyOpenfinWindow);
            assert.equal(dockingManager.windows.length, 0);
        });
    });

    describe('when a new window is registered with a set of options', function () {
        const windowName = 'dummyNew';
        let dummyOpenfinWindow;
        beforeEach(function () {
            dummyOpenfinWindow = {name: windowName};
            dockingManager.register(dummyOpenfinWindow);
        });

        it('should be recorded as a new window in the set of docking windows', function () {
            assert.equal(dockingManager.windows.length, 1);
        });

        it('should be removed from the set of docking windows if unregistered by window name', function () {
            dockingManager.unregisterByName(windowName);
            assert.equal(dockingManager.windows.length, 0);
        });
    });
});