/* globals describe, it */
import assert from 'assert';
import { intersect } from '../lib/DockingUtil';

describe('DockingUtil', function() {
    describe('intersect', function() {
        describe('when pairs of rectangles are tested', function() {
            it('should correctly assess whether they overlap', function() {
                assert.ok(intersect(overlappingRect1, overlappingRect2));
            });
        });
    });
});

const overlappingRect1 = {x: 0, y: 0, width: 100, height: 100};
const overlappingRect2 = {x: 50, y: 50, width: 100, height: 100};
