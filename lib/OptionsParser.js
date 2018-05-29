
function parsePositiveInt(option, defaultOption) {
    if (!isNaN(Number.parseInt(option, 10)) && option >= 0) {
        return option;
    }
    return defaultOption;
}

function parseOpacity(opacityOption, defaultOption) {
    if (!isNaN(Number.parseFloat(opacityOption))
        && opacityOption >= 0
        && opacityOption <= 1) {
        return opacityOption;
    }
    return defaultOption;
}

export function applyOptions(instance, options, defaults = {}) {
    if (!options) {
        return;
    }
    // 'range' is the distance between windows at which snapping applies
    instance.range = parsePositiveInt(options.range, defaults.range);
    // 'spacing' is the distance between windows when they become docked
    instance.spacing = parsePositiveInt(options.spacing, defaults.spacing);
    // 'undockOffsetX/Y' are offset values - they make the undocked window 'jump' a number of pixels
    instance.undockOffsetX = parsePositiveInt(options.undockOffsetX, defaults.undockOffsetX);
    instance.undockOffsetY = parsePositiveInt(options.undockOffsetY, defaults.undockOffsetY);
    // opacities applied for 1) moving window, 2) snappedMovingWindow, 3) snappedTargetWindow
    // Value from 0 (invisible) to 1.0 (fully opaque)
    instance.movingOpacity = parseOpacity(options.movingOpacity, defaults.movingOpacity);
    instance.snappedMovingOpacity = parseOpacity(options.snappedMovingOpacity, defaults.snappedMovingOpacity);
    instance.snappedTargetOpacity = parseOpacity(options.snappedTargetOpacity, defaults.snappedTargetOpacity);
    // 'dockableToOthers' is a boolean which applies only to DockingWindow
    instance.dockableToOthers = (options.dockableToOthers === true || options.dockableToOthers === false)
        ? options.dockableToOthers
        : defaults.dockableToOthers;
    // 'unregisterOnClose' is a boolean which toggles automatic unregistration on close of a DockingWindow
    instance.unregisterOnClose = (options.unregisterOnClose === true || options.unregisterOnClose === false)
        ? options.unregisterOnClose
        : defaults.unregisterOnClose;
}
