/* globals beforeEach, describe, it */
import assert from 'assert';
import DockingManager from '../../lib/DockingManager.js';

describe('DockingManager (init)', function () {
    let dockingManager;

    describe('full', function () {
        beforeEach(function () {
            dockingManager = new DockingManager({
                range: 35,
                spacing: 0,
                undockOffsetX: 5,
                undockOffsetY: 5,
                movingOpacity: 0.6,
                snappedMovingOpacity: 0.8,
                snappedTargetOpacity: 1
            });
        });

        it('should set properties from stated values only', function () {
            assert.equal(dockingManager.range, 35);
            assert.equal(dockingManager.spacing, 0);
            assert.equal(dockingManager.undockOffsetX, 5);
            assert.equal(dockingManager.undockOffsetY, 5);
            assert.equal(dockingManager.movingOpacity, 0.6);
            assert.equal(dockingManager.snappedMovingOpacity, 0.8);
            assert.equal(dockingManager.snappedTargetOpacity, 1);
        });
    });

    describe('partial / valid', function () {
        beforeEach(function () {
            dockingManager = new DockingManager({
                range: 30,
                spacing: 20
            });
        });

        it('should set the stated values and set other values from defaults', function () {
            assert.equal(dockingManager.range, 30);
            assert.equal(dockingManager.spacing, 20);
            assert.equal(dockingManager.undockOffsetX, 0);
            assert.equal(dockingManager.undockOffsetY, 0);
            assert.equal(dockingManager.movingOpacity, 0.5);
            assert.equal(dockingManager.snappedMovingOpacity, 0.5);
            assert.equal(dockingManager.snappedTargetOpacity, 0.5);
        });
    });

    describe('partial / all invalid', function () {
        beforeEach(function () {
            dockingManager = new DockingManager({
                range: -5,
                spacing: 'BIG',
                movingOpacity: -1,
                snappedMovingOpacity: 100,
                snappedTargetOpacity: 'bob'
            });
        });

        it('should set all values from defaults', function () {
            assert.equal(dockingManager.range, 40);
            assert.equal(dockingManager.spacing, 5);
            assert.equal(dockingManager.undockOffsetX, 0);
            assert.equal(dockingManager.undockOffsetY, 0);
            assert.equal(dockingManager.movingOpacity, 0.5);
            assert.equal(dockingManager.snappedMovingOpacity, 0.5);
            assert.equal(dockingManager.snappedTargetOpacity, 0.5);
        });
    });
});