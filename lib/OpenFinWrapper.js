/* globals fin, Promise */
const {Application, System} = fin.desktop;

export const GroupEventReason = {
    DISBAND: 'disband',
    JOIN: 'join',
    LEAVE: 'leave',
    MERGE: 'merge'
};

export const GroupEventMemberOf = {
    NOTHING: 'nothing',
    SOURCE: 'source',
    TARGET: 'target'
};

export function getAppId() {
    return Application.getCurrent().uuid;
}

function openfinMonitorInfoToMonitorBounds(monitorInfo) {
    const { left, right, top, bottom } = monitorInfo.availableRect;
    return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top
    }
}

function handleMonitorInfo(openfinMonitorInfo) {
    const allMonitors = [ openfinMonitorInfo.primaryMonitor, ...openfinMonitorInfo.nonPrimaryMonitors ];
    return allMonitors.map(openfinMonitorInfoToMonitorBounds);
}

export async function requestMonitorInfo() {
    return new Promise((resolve, reject) => System.getMonitorInfo(
        monitorData => resolve(handleMonitorInfo(monitorData)),
        err => reject(err)
    ));
}
