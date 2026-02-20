import { CANVAS_WIDTH, CANVAS_HEIGHT, CAMERA_LERP } from './constants.js';
import { lerp } from './utils.js';

export function createCamera() {
    return {
        x: 0,
        y: 0,
        halfW: CANVAS_WIDTH / 2,
        halfH: CANVAS_HEIGHT / 2,
    };
}

export function updateCamera(camera, target, dt) {
    const t = 1 - Math.exp(-CAMERA_LERP * dt);
    camera.x = lerp(camera.x, target.x, t);
    camera.y = lerp(camera.y, target.y, t);
}

export function applyCamera(ctx, camera) {
    ctx.translate(
        -camera.x + camera.halfW,
        -camera.y + camera.halfH
    );
}

export function screenToWorld(camera, sx, sy) {
    return {
        x: sx + camera.x - camera.halfW,
        y: sy + camera.y - camera.halfH,
    };
}

export function worldToScreen(camera, wx, wy) {
    return {
        x: wx - camera.x + camera.halfW,
        y: wy - camera.y + camera.halfH,
    };
}

export function isInView(camera, wx, wy, margin = 64) {
    const dx = Math.abs(wx - camera.x);
    const dy = Math.abs(wy - camera.y);
    return dx < camera.halfW + margin && dy < camera.halfH + margin;
}
