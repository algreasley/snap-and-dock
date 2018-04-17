
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
}

export function intersect(rectangle, targetRectangle) {
    // check right edge position of first window is to the left of left edge of second window, and so on ..
    // comparison is <= as (xpos + width) is one pixel to the right of the window
    return !(
        rectangle.x + rectangle.width <= targetRectangle.x ||
        targetRectangle.x + targetRectangle.width <= rectangle.x ||
        rectangle.y + rectangle.height <= targetRectangle.y ||
        targetRectangle.y + targetRectangle.height <= rectangle.y
    );
}

export function isInView(rectangle, monitors) {
    return monitors.some(monitor => intersect(rectangle, monitor) && rectangle.y >= monitor.y);
}

export function isGroupInView(rectangles, monitors) {
    return rectangles.some(rectangle => isInView(rectangle, monitors));
}

function isPointInVerticalZone(startY, endY, y, height) {
    const bottomEdgePosition = y + height;
    return y >= startY && y <= endY || bottomEdgePosition >= startY && bottomEdgePosition <= endY;
}

function isPointInHorizontalZone(startX, endX, x, width) {
    const rightEdgePosition = x + width;
    return x >= startX && x <= endX || rightEdgePosition >= startX && rightEdgePosition <= endX;
}

export function getSnapDirection(currentWindow, window) {
    const isInVerticalZone = isPointInVerticalZone(window.y, window.y + window.height, currentWindow.y, currentWindow.height);

    if (isInVerticalZone && currentWindow.x > window.x + window.width - currentWindow.currentRange && currentWindow.x < window.x + window.width + currentWindow.currentRange) {
        return 'right';
    }

    if (isInVerticalZone && currentWindow.x + currentWindow.width > window.x - currentWindow.currentRange && currentWindow.x + currentWindow.width < window.x + currentWindow.currentRange) {
        return 'left';
    }

    const isInHorizontalZone = isPointInHorizontalZone(window.x, window.x + window.width, currentWindow.x, currentWindow.width);

    if (isInHorizontalZone && currentWindow.y > window.y + window.height - currentWindow.currentRange && currentWindow.y < window.y + window.height + currentWindow.currentRange) {
        return 'bottom';
    }

    if (isInHorizontalZone && currentWindow.y + currentWindow.height > window.y - currentWindow.currentRange && currentWindow.y + currentWindow.height < window.y + currentWindow.currentRange) {
        return 'top';
    }

    return false;
}

export function reverseSnapDirection(direction) {
    switch (direction) {
        case 'right':
            return 'left';
        case 'left':
            return 'right';
        case 'top':
            return 'bottom';
        case 'bottom':
            return 'top';
        default:
            return null;
    }
}
