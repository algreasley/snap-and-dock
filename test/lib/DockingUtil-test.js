/* globals describe, it */
import assert from 'assert';
import { intersect, isInView } from '../../lib/DockingUtil';

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
});

const overlappingRect1 = {x: 0, y: 0, width: 100, height: 100};
const overlappingRect2 = {x: 50, y: 50, width: 100, height: 100};

const basicFullHDMonitor = {x: 0, y: 0, width: 1920, height: 1080};
const partlyOffScreenRect = {x: 1900, y: 1050, width: 100, height: 100};
