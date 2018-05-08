/* globals describe, it, beforeEach, afterEach, FULLHD_WIDTH, FULLHD_HEIGHT,
 setSingleFullHDMonitor, setTripleFullHDMonitor, setErrorMonitor, resetMonitors */
import assert from 'assert';

import { requestMonitorInfo } from '../../lib/OpenFinWrapper';

const ERR_REQUEST_MONITOR_INFO = 'Something went wrong';

describe('OpenFinWrapper', function() {
    describe('requestMonitorInfo', function() {
        describe('default', function() {
            let monitors;
            beforeEach(async function() {
                setSingleFullHDMonitor();
                monitors = await requestMonitorInfo();
            });
            it('returns an array with bounds for the single monitor', function() {
                assert.equal(monitors.length, 1);
            });
            it('with Full HD dimensions', function() {
                assert.equal(monitors[0].width, FULLHD_WIDTH);
                assert.equal(monitors[0].height, FULLHD_HEIGHT);
            });
        });
        describe('multi-monitor', function() {
            let monitors;
            beforeEach(async function() {
                setTripleFullHDMonitor();
                monitors = await requestMonitorInfo();
            });
            it('returns an array containing the bounds of each monitor', function() {
                assert.equal(monitors.length, 3);
            });
            it('each with Full HD dimensions', function() {
                assert.equal(monitors[0].width, FULLHD_WIDTH);
                assert.equal(monitors[1].width, FULLHD_WIDTH);
                assert.equal(monitors[2].width, FULLHD_WIDTH);
                assert.equal(monitors[0].height, FULLHD_HEIGHT);
                assert.equal(monitors[1].height, FULLHD_HEIGHT);
                assert.equal(monitors[2].height, FULLHD_HEIGHT);
            });
        });
        describe('api error', function() {
            beforeEach(async function() {
                setErrorMonitor();
            });
            it('api call rejected with appropriate error message', async function() {
                try {
                    await requestMonitorInfo();
                } catch (rejectionError) {
                    assert.equal(rejectionError, ERR_REQUEST_MONITOR_INFO);
                }
            });
        });

        afterEach(function() {
            resetMonitors();
        });
    });
});

