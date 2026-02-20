// --- Vector2 math ---
export function v2(x = 0, y = 0) { return { x, y }; }
export function v2Add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
export function v2Sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
export function v2Scale(v, s) { return { x: v.x * s, y: v.y * s }; }
export function v2Len(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
export function v2Dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
export function v2Normalize(v) {
    const len = v2Len(v);
    return len > 0 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
}
export function v2Angle(v) { return Math.atan2(v.y, v.x); }
export function v2FromAngle(angle, len = 1) {
    return { x: Math.cos(angle) * len, y: Math.sin(angle) * len };
}

// --- General math ---
export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
export function randomRange(min, max) { return min + Math.random() * (max - min); }
export function randomInt(min, max) { return Math.floor(randomRange(min, max + 1)); }
export function angleBetween(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }

// --- Collision helpers ---
export function circleOverlap(x1, y1, r1, x2, y2, r2) {
    const dx = x1 - x2, dy = y1 - y2;
    const distSq = dx * dx + dy * dy;
    const radSum = r1 + r2;
    return distSq <= radSum * radSum;
}

// --- Format helpers ---
export function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
