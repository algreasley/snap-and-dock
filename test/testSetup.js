/* globals global, FULLHD_WIDTH, FULLHD_HEIGHT, ERR_REQUEST_MONITOR_INFO */
/* globals fin */
import * as sinon from 'sinon';

global.localStorage = {};

global.fin = {
    desktop: {
        Application: {
            getCurrent: () => ({ uuid: 'temp'})
        },
        System: {
            getMonitorInfo: singleFullHDMonitorStub
        },
        Window: function(options) {
            Object.assign(this, options);
        },
        InterApplicationBus: {
            publish: () => undefined
        }
    }
};

global.FULLHD_WIDTH = 1920;
global.FULLHD_HEIGHT = 1080;
global.ERR_REQUEST_MONITOR_INFO = 'Something went wrong';

global.setSingleFullHDMonitor = function() {
    sinon.replace(fin.desktop.System, 'getMonitorInfo', singleFullHDMonitorStub);
};
global.setTripleFullHDMonitor = function() {
    sinon.replace(fin.desktop.System, 'getMonitorInfo', tripleFullHDMonitorStub);
};
global.setErrorMonitor = function() {
    sinon.replace(fin.desktop.System, 'getMonitorInfo', errorMonitorStub);
};
global.resetMonitors = function () {
    sinon.restore();
};

function singleFullHDMonitorStub(successCallback) {
    successCallback({
        primaryMonitor: {
            availableRect: {
                left: 0,
                right: FULLHD_WIDTH,
                bottom: FULLHD_HEIGHT,
                top: 0
            }
        },
        nonPrimaryMonitors: []
    });
}

function tripleFullHDMonitorStub(callback) {
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

function errorMonitorStub(successCallback, errorCallback) {
    errorCallback(ERR_REQUEST_MONITOR_INFO);
}
