export function shelfCameraDistance(width, height, shelf, fov = 50) {
    //defaults to a distance of 30 if the window pane hasnt been sized yet
    if (width <= 0 || height <= 0) return 30;
    const aspect = width / height;//width and height of window
    const halfWidth = (shelf.width + 2*shelf.thin) / 2;//half of the shelf width including thin edges
    const distance = halfWidth * 1.05 / (Math.tan(fov * Math.PI / 360) * aspect);
    return Math.max(30, shelf.depth / 2 + distance)
}
//Contains scrolling to a little above and below the shelf
export function shelfScrollBounds(width, height, shelf, fov = 50) {
    if (width <= 0 || height <= 0 || shelf.numOfShelves <= 0) {
        return { top: 0, bottom: 0, scrollHeight: 0 }
    }

    const distance = shelfCameraDistance(width, height, shelf, fov)
    const visibleHeight = 2 * (distance - shelf.depth / 2) * Math.tan(fov * Math.PI / 360)
    const margin = 9;
    const shelfTop = shelf.height / 2 + margin
    const shelfBottom = -(shelf.numOfShelves - 1) * shelf.height - (shelf.height + shelf.thin) / 2 - margin
    const top = shelfTop - visibleHeight / 2
    const bottom = shelfBottom + visibleHeight / 2

    if (top <= bottom) {
        const center = (shelfTop + shelfBottom) / 2
        return { top: center, bottom: center, scrollHeight: 0 }
    }
    return { top, bottom, scrollHeight: (top - bottom) * height / visibleHeight }
}
