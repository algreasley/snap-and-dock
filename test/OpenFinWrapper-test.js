/* globals describe, it, beforeEach, afterEach, replaceStubOrValue, resetStubOrValue */
import assert from 'assert';

import { requestMonitorInfo } from '../lib/OpenFinWrapper';

const FULLHD_WIDTH = 1920;
const FULLHD_HEIGHT = 1080;
const ERR_REQUEST_MONITOR_INFO = 'Something went wrong';

describe('OpenFinWrapper', () => {
    describe('requestMonitorInfo', () => {
        describe('default', () => {
            let monitors;
            beforeEach(async () => {
                monitors = await requestMonitorInfo();
            });
            it('returns an array with bounds for the single monitor', () => {
                assert.equal(monitors.length, 1);
            });
            it('with Full HD dimensions', () => {
                assert.equal(monitors[0].width, FULLHD_WIDTH);
                assert.equal(monitors[0].height, FULLHD_HEIGHT);
            });
        });
        describe('multi-monitor', () => {
            let monitors;
            beforeEach(async () => {
                replaceStubOrValue('fin.desktop.System', 'getMonitorInfo', getMultiMonitorInfoStub);
                monitors = await requestMonitorInfo();
            });
            it('returns an array containing the bounds of each monitor', () => {
                assert.equal(monitors.length, 3);
            });
            it('each with Full HD dimensions', () => {
                assert.equal(monitors[0].width, FULLHD_WIDTH);
                assert.equal(monitors[1].width, FULLHD_WIDTH);
                assert.equal(monitors[2].width, FULLHD_WIDTH);
                assert.equal(monitors[0].height, FULLHD_HEIGHT);
                assert.equal(monitors[1].height, FULLHD_HEIGHT);
                assert.equal(monitors[2].height, FULLHD_HEIGHT);
            });
            afterEach(() => {
                resetStubOrValue('fin.desktop.System', 'getMonitorInfo');
            });
        });
        describe('api error', () => {
            beforeEach(async () => {
                replaceStubOrValue('fin.desktop.System', 'getMonitorInfo', getMonitorErrorStub);
            });
            it('api call rejected with appropriate error message', async () => {
                try {
                    await requestMonitorInfo();
                } catch (rejectionError) {
                    assert.equal(rejectionError, ERR_REQUEST_MONITOR_INFO);
                }
            });
        });
    });
});

function getMultiMonitorInfoStub(callback) {
    callback({
        primaryMonitor: {
            availableRect: {
                left: 0,
                right: FULLHD_WIDTH,
                bottom: FULLHD_HEIGHT,
                top: 0
            }
        },
        nonPrimaryMonitors: [
            {
                availableRect: {
                    left: -FULLHD_WIDTH,
                    right: 0,
                    bottom: FULLHD_HEIGHT,
                    top: 0
                }
            },
            {
                availableRect: {
                    left: FULLHD_WIDTH,
                    right: FULLHD_WIDTH * 2,
                    bottom: FULLHD_HEIGHT,
                    top: 0
                }
            }
        ]
    });
}

function getMonitorErrorStub(successCallback, errorCallback) {
    errorCallback(ERR_REQUEST_MONITOR_INFO);
}
