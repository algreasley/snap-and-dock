/* globals beforeEach, describe, it */
/* globals fin */
import assert from 'assert';
import DockingWindow from '../../lib/DockingWindow';
import * as sinon from "sinon";

const fakeDockingOptions = {};

describe('DockingWindow', function() {
    let dockingWindow;
    let getOptionsStub, getBoundsStub;
    let updateOptionsSpy;
    const ORIG_OPACITY = 0.8;

    beforeEach(function () {
        getOptionsStub = sinon.stub();
        getOptionsStub.callsArgWith(0, {
            opacity: ORIG_OPACITY
        });
        fin.desktop.Window.prototype.getOptions = getOptionsStub;
        getBoundsStub = sinon.stub();
        getBoundsStub.callsArgWith(0, {x: 0, y: 0, width: 100, height: 100});
        fin.desktop.Window.prototype.getBounds = getBoundsStub;
        fin.desktop.Window.prototype.setBounds = sinon.fake();
        fin.desktop.Window.prototype.disableFrame = sinon.fake();
        fin.desktop.Window.prototype.addEventListener = sinon.fake();
        fin.desktop.Window.prototype.removeEventListener = sinon.fake();
        updateOptionsSpy = sinon.spy();
        fin.desktop.Window.prototype.updateOptions = updateOptionsSpy;
        fakeDockingOptions.allMonitorBounds = [{
            x: 0,
            y: 0,
            width: 1920,
            height: 1080
        }];
        fakeDockingOptions.persistenceService = {
            retrieveRelationshipsFor: sinon.fake.returns([]),
            createRelationshipsBetween: sinon.fake(),
            removeAllRelationships: sinon.fake()
        };
    });

    describe('getWindowByName', function() {
        let windows;

        beforeEach(function() {
            dockingWindow = new DockingWindow({name: 'bob'}, fakeDockingOptions);
            windows = [ dockingWindow ];
        });

        it('should retrieve the window if the name matches', function() {
            assert.ok(DockingWindow.getWindowByName(windows, dockingWindow.name));
            assert.strictEqual(DockingWindow.getWindowByName(windows, 'dave'), undefined);
        });
    });

    describe('opacity', function() {
        const NEW_OPACITY = 0.4;

        beforeEach(function() {
            dockingWindow = new DockingWindow({name: 'bob'}, fakeDockingOptions);
        });

        describe('when the opacity value of a window is modified', function() {
            beforeEach(function() {
                dockingWindow.setOpacity(NEW_OPACITY);
            });

            it('the target window should have its opacity updated (via updateOptions)', function () {
                assert.equal(updateOptionsSpy.calledWith({opacity: NEW_OPACITY}), 1);
            });

            describe('when the opacity value of a window is modified', function() {
                beforeEach(function() {
                    dockingWindow.resetOpacity();
                });

                it('the target window should have its opacity restored (via updateOptions)', function () {
                    assert.equal(updateOptionsSpy.calledWith({opacity: ORIG_OPACITY}), 1);
                });
            });
        });
    });

    describe('grouping', function() {
        let window1, window2;
        let joinGroupSpy, leaveGroupStub;

        beforeEach(function() {
            fin.desktop.Window.prototype.enableFrame = sinon.fake();
            joinGroupSpy = sinon.spy();
            fin.desktop.Window.prototype.joinGroup = joinGroupSpy;

            window1 = new DockingWindow({name: 'bob'}, fakeDockingOptions);
            window2 = new DockingWindow({name: 'dave'}, fakeDockingOptions);
        });

        describe('when one ungrouped window is joined to another ungrouped window', function() {
            beforeEach(function() {
                leaveGroupStub = sinon.stub();
                leaveGroupStub.callsArgWith(0, null);
                fin.desktop.Window.prototype.leaveGroup = leaveGroupStub;
                fin.desktop.Window.prototype.moveBy = sinon.fake();
                window1.joinDockingGroup(window2);
            });

            it('the openfin api is called to link the two windows', function () {
                assert.equal(joinGroupSpy.calledWith(window2.openfinWindow), 1);
            });

            describe('when one window subsequently leaves the group (of 2)', function () {
                beforeEach(async function () {
                    await window1.leaveDockingGroup(true);
                });

                it('the openfin api is called to unlink each window', function () {
                    assert.equal(leaveGroupStub.callCount, 2);
                });
            });
        });
    });
});