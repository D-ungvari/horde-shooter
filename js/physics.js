import { SPATIAL_CELL_SIZE } from './constants.js';

// --- Spatial Hash Grid ---
// Rebuilds every frame for moving entities. O(n) insert, O(1) query per cell.

const grid = new Map();

export function clearSpatialHash() {
    grid.clear();
}

export function insertIntoHash(entity) {
    const cs = SPATIAL_CELL_SIZE;
    const r = entity.radius || 0;
    const x0 = Math.floor((entity.x - r) / cs);
    const y0 = Math.floor((entity.y - r) / cs);
    const x1 = Math.floor((entity.x + r) / cs);
    const y1 = Math.floor((entity.y + r) / cs);

    for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
            const key = (x * 73856093) ^ (y * 19349663); // hash ints
            let cell = grid.get(key);
            if (!cell) {
                cell = [];
                grid.set(key, cell);
            }
            cell.push(entity);
        }
    }
}

export function queryHash(x, y, radius) {
    const cs = SPATIAL_CELL_SIZE;
    const x0 = Math.floor((x - radius) / cs);
    const y0 = Math.floor((y - radius) / cs);
    const x1 = Math.floor((x + radius) / cs);
    const y1 = Math.floor((y + radius) / cs);

    const results = [];
    const seen = new Set();

    for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
            const key = (cx * 73856093) ^ (cy * 19349663);
            const cell = grid.get(key);
            if (!cell) continue;
            for (let i = 0; i < cell.length; i++) {
                const e = cell[i];
                if (!seen.has(e._poolIndex)) {
                    seen.add(e._poolIndex);
                    results.push(e);
                }
            }
        }
    }

    return results;
}

// --- Collision helpers ---

export function circlesOverlap(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const radSum = (a.radius || 0) + (b.radius || 0);
    return dx * dx + dy * dy <= radSum * radSum;
}

export function pointInCircle(px, py, cx, cy, r) {
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= r * r;
}

export function distSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}
