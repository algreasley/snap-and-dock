/* globals fin */
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

export function requestMonitorInfo(handler) {
    System.getMonitorInfo(handler);
}
