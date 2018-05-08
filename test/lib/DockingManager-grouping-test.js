/* globals beforeEach, describe, it */
/* globals fin, localStorage */
import assert from 'assert';
import * as sinon from 'sinon';
import DockingManager from '../../lib/DockingManager.js';

describe('DockingManager (grouping)', function () {
    let dockingManager;
    let getItemFake, setItemFake;
    let getOptionsFake, joinGroupFake, leaveGroupFake, enableFrameFake, disableFrameFake;
    let updateOptionsSpy;

    beforeEach(function () {
        dockingManager = new DockingManager();
        getItemFake = sinon.fake.returns(null);
        setItemFake = sinon.fake();
        joinGroupFake = sinon.fake();
        leaveGroupFake = sinon.fake();
        enableFrameFake = sinon.fake();
        disableFrameFake = sinon.fake();
        getOptionsFake = sinon.fake();
        localStorage.getItem = getItemFake;
        localStorage.setItem = setItemFake;
        fin.desktop.Window.prototype.joinGroup = joinGroupFake;
        fin.desktop.Window.prototype.leaveGroup = leaveGroupFake;
        fin.desktop.Window.prototype.enableFrame = enableFrameFake;
        fin.desktop.Window.prototype.disableFrame = disableFrameFake;
        fin.desktop.Window.prototype.getOptions = getOptionsFake;
        updateOptionsSpy = sinon.spy();
        fin.desktop.Window.prototype.updateOptions = updateOptionsSpy;
    });

    describe('when 2 windows are registered', function () {
        beforeEach(function () {
            const openfinWindow1 = {name: 'win1'};
            dockingManager.register(openfinWindow1);
            const openfinWindow2 = {name: 'win2'};
            dockingManager.register(openfinWindow2);
        });

        it('both windows should be available for docking', function () {
            assert.equal(dockingManager.windows.length, 2);
            assert.equal(getOptionsFake.callCount, 2);
        });

        describe('when those 2 windows are then grouped', function () {
            beforeEach(function () {
                dockingManager.addWindowToTheGroup(
                    dockingManager.windows[0], dockingManager.windows[1]);
            });

            it('each window should have a group reference', function () {
                for (let dockingWindow of dockingManager.windows) {
                    assert.ok(dockingWindow.group);
                }
            });

            it('the target window should have its opacity restored (via updateOptions)', function () {
                assert.equal(updateOptionsSpy.calledWith({opacity: 1}), 1);
            });

            it('both windows should refer to the same group', function () {
                assert.equal(dockingManager.windows[0].group, dockingManager.windows[1].group)
            });

            describe('when all windows are forcibly undocked', function () {
                beforeEach(function () {
                    dockingManager.undockAll();
                });

                it('each window should no longer have a group reference', function () {
                    for (let dockingWindow of dockingManager.windows) {
                        assert.ok(!dockingWindow.group);
                    }
                });
            });
        });
    });
});