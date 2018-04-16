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
        },
        Window: function() {
            this.getOptions = () => {}
        }
    }
};

function getMonitorInfoStub(successCallback) {
    successCallback({
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

function getStubLocation(path) {
    let target = global;
    path.split('.').forEach(property => {
        if (target[property]) {
            target = target[property];
        } else {
            throw new Error('Bad property address', path);
        }
    });
    return target;
}

global.replaceStubOrValue = function(path, property, stubOrValue) {
    const target = getStubLocation(path);
    target[`${property}_SAFE`] = target[property];
    target[property] = stubOrValue;
};

global.resetStubOrValue = function(path, property) {
    const target = getStubLocation(path);
    target[property] = target[`${property}_SAFE`];
};