import test from 'node:test'
import assert from 'node:assert/strict'
import { shelfCameraDistance, shelfScrollBounds } from './shelfCamera.js'

const shelf = { width: 24.5, thin: 0.5, depth: 6, height: 8.25, numOfShelves: 3 }

test('preserves the original camera distance on a wide viewport', () => {
    assert.equal(shelfCameraDistance(1440, 900, shelf), 30)
})

test('fits the shelf horizontally at multiple aspect ratios', () => {
    for (const [width, height] of [[375, 700], [500, 700], [800, 700], [1440, 900]]) {
        const distance = shelfCameraDistance(width, height, shelf)
        const availableHalfWidth = (distance - shelf.depth / 2) * Math.tan(25 * Math.PI / 180) * width / height
        assert.ok(availableHalfWidth >= (shelf.width + shelf.thin) / 2, `${width}x${height}`)
    }
})

test('uses the original distance until the viewport is measured', () => {
    assert.equal(shelfCameraDistance(0, 0, shelf), 30)
})

test('scroll bounds show exactly one unit of space above and below the shelf', () => {
    let scrollableViewports = 0
    for (const [width, height] of [[1440, 900], [1600, 500], [800, 700]]) {
        const bounds = shelfScrollBounds(width, height, shelf)
        const distance = shelfCameraDistance(width, height, shelf)
        const visibleHeight = 2 * (distance - shelf.depth / 2) * Math.tan(25 * Math.PI / 180)
        if (bounds.scrollHeight > 0) {
            scrollableViewports++
            assert.ok(Math.abs(bounds.top + visibleHeight / 2 - (shelf.height / 2 + 1)) < 1e-10)
            assert.ok(Math.abs(bounds.bottom - visibleHeight / 2 - (-2 * shelf.height - (shelf.height + shelf.thin) / 2 - 1)) < 1e-10)
            assert.ok(Math.abs(bounds.scrollHeight - (bounds.top - bounds.bottom) * height / visibleHeight) < 1e-10)
        }
    }
    assert.ok(scrollableViewports > 0)
})

test('a five-row shelf has scrollable range on a desktop viewport', () => {
    const bounds = shelfScrollBounds(1440, 900, { ...shelf, numOfShelves: 5 })
    assert.ok(bounds.top > bounds.bottom)
    assert.ok(bounds.scrollHeight > 0)
})

test('centers a shelf that fits in the viewport without scrolling', () => {
    const bounds = shelfScrollBounds(375, 700, shelf)
    assert.equal(bounds.scrollHeight, 0)
    assert.equal(bounds.top, bounds.bottom)
    assert.equal(bounds.top, -8.375)
})

test('handles an unmeasured viewport and an empty shelf', () => {
    assert.deepEqual(shelfScrollBounds(0, 0, shelf), { top: 0, bottom: 0, scrollHeight: 0 })
    assert.deepEqual(shelfScrollBounds(800, 700, { ...shelf, numOfShelves: 0 }), { top: 0, bottom: 0, scrollHeight: 0 })
})
