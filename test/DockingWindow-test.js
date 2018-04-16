/* globals beforeEach, describe, it */
import assert from 'assert';
import DockingWindow from '../lib/DockingWindow';

const DEFAULT_WINDOW_DOCKING_OPTIONS = {};

describe('DockingWindow', function() {

    describe('getWindowByName', function() {
        let windows;

        beforeEach(function() {
            windows = [
                new DockingWindow({name: 'bob'}, DEFAULT_WINDOW_DOCKING_OPTIONS)
            ]
        });

        it('should retrieve the window if the name matches', function() {
            assert.ok(DockingWindow.getWindowByName(windows, 'bob'));
            assert.strictEqual(DockingWindow.getWindowByName(windows, 'dave'), undefined);
        });
    });
});