/* globals global */

global.window = {
    document: {
        addEventListener: () => undefined
    },
};

global.fin = {
    desktop: {
        Application: {
            getCurrent: () => ({ uuid: 'temp'})
        },
        System: {
            getMonitorInfo: getMonitorInfoStub
        }
    }
};

function getMonitorInfoStub(callback) {
    callback({
        primaryMonitor: {
            availableRect: {
                left: 0,
                right: 1920,
                bottom: 1080,
                top: 0
            }
        },
        nonPrimaryMonitors: []
    });
}