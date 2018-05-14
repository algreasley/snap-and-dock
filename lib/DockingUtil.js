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

    return null;
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

function getVerticalEdgeSnapping(window, currentWindow, range) {
    if (currentWindow.y <= window.y + range && currentWindow.y >= window.y - range) {
        return window.y;
    }
    if (currentWindow.y + currentWindow.height >= window.y + window.height - range &&
        currentWindow.y + currentWindow.height <= window.y + window.height + range) {
        return window.y + window.height - currentWindow.height;
    }
    return null;
}

function getHorizontalEdgeSnapping(window, currentWindow, range) {
    if (currentWindow.x <= window.x + range && currentWindow.x >= window.x - range) {
        return window.x;
    }
    if (currentWindow.x + currentWindow.width >= window.x + window.width - range &&
        currentWindow.x + currentWindow.width <= window.x + window.width + range) {
        return window.x + window.width - currentWindow.width;
    }
    return null;
}

export function getSnappedCoordinates(newBounds, currentWindow, window, direction, range, spacing) {
    switch (direction) {
        case 'right':
            return {
                x: window.x + window.width + spacing,
                y: getVerticalEdgeSnapping(window, newBounds, range)
            };
        case 'left':
            return {
                x: window.x - currentWindow.width - spacing,
                y: getVerticalEdgeSnapping(window, newBounds, range)
            };
        case 'top':
            return {
                x: getHorizontalEdgeSnapping(window, newBounds, range),
                y: window.y - currentWindow.height - spacing
            };
        case 'bottom':
            return {
                x: getHorizontalEdgeSnapping(window, newBounds, range),
                y: window.y + window.height + spacing
            };
        default:
            return null;
    }
}

