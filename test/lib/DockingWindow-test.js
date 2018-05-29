/* globals beforeEach, describe, it */
/* globals fin */
import assert from 'assert';
import DockingWindow from '../../lib/DockingWindow';
import * as sinon from "sinon";

const FAKE_DOCKING_OPTIONS = {};

describe('DockingWindow', function() {
    let dockingWindow;
    let getOptionsStub, getBoundsStub;
    let addEventListenerFake, disableFrameFake, persistenceServiceRetrieveFake;
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
        disableFrameFake = sinon.fake();
        fin.desktop.Window.prototype.disableFrame = disableFrameFake;
        addEventListenerFake = sinon.fake();
        fin.desktop.Window.prototype.addEventListener = addEventListenerFake;
        updateOptionsSpy = sinon.spy();
        fin.desktop.Window.prototype.updateOptions = updateOptionsSpy;
        persistenceServiceRetrieveFake = sinon.fake.returns([]);
        FAKE_DOCKING_OPTIONS.persistenceService = {
            retrieveRelationshipsFor: persistenceServiceRetrieveFake
        };
    });

    describe('getWindowByName', function() {
        let windows;

        beforeEach(function() {
            dockingWindow = new DockingWindow({name: 'bob'}, FAKE_DOCKING_OPTIONS);
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
            dockingWindow = new DockingWindow({name: 'bob'}, FAKE_DOCKING_OPTIONS);
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
});