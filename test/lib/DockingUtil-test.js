/* globals describe, it, beforeEach */
import assert from 'assert';
import { intersect, isInView, getSnapDirection } from '../../lib/DockingUtil';

describe('DockingUtil', function() {

    describe('intersect', function() {
        describe('when pairs of rectangles are tested', function() {
            it('should correctly assess whether they overlap', function() {
                assert.ok(intersect(overlappingRect1, overlappingRect2));
            });
        });
    });

    describe('isInView', function() {
        describe('when monitor is partly off-screen', function() {
            it('should still be considered in view', function() {
                assert.ok(isInView(partlyOffScreenRect, [basicFullHDMonitor]));
            });
        });
    });

    describe('getSnapDirection', function() {
        let win1, win2;

        describe('when the windows are side by side and within the configured range', function() {
            beforeEach(function () {
                win1 = {x: 100, y: 100, width: 100, height: 100, currentRange: 10};
                win2 = {x: 205, y: 100, width: 100, height: 100, currentRange: 10};
            });

            it('should report that snapping is possible .. to the "left", from the snap target perspective', function() {
                assert.equal(getSnapDirection(win1, win2), 'left');
            });
        });

        describe('when the windows are side by side but overlapping horizontally beyond the configured range', function() {
            beforeEach(function () {
                win1 = {x: 100, y: 100, width: 100, height: 100, currentRange: 10};
                win2 = {x: 150, y: 100, width: 100, height: 100, currentRange: 10};
            });

            it('should report that snapping is not possible', function() {
                assert.equal(getSnapDirection(win1, win2), null);
            });
        });
    });

});

const overlappingRect1 = {x: 0, y: 0, width: 100, height: 100};
const overlappingRect2 = {x: 50, y: 50, width: 100, height: 100};

const basicFullHDMonitor = {x: 0, y: 0, width: 1920, height: 1080};
const partlyOffScreenRect = {x: 1900, y: 1050, width: 100, height: 100};
