import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

// Minimap configuration
const MAP_SIZE = 140;                    // diameter in screen pixels
const MAP_RADIUS = MAP_SIZE / 2;         // 70px
const MAP_RANGE = 800;                   // world units visible in each direction
const PADDING_RIGHT = 8;
const PADDING_BOTTOM = 24;               // clears the 16px XP bar + 8px gap

// Pre-compute center position (screen coords)
const CENTER_X = CANVAS_WIDTH - PADDING_RIGHT - MAP_RADIUS;
const CENTER_Y = CANVAS_HEIGHT - PADDING_BOTTOM - MAP_RADIUS;

// Dot sizes
const PLAYER_DOT = 3;
const ENEMY_DOT = 2;
const BOSS_DOT = 4;
const ELITE_DOT = 3;
const GEM_DOT = 1.5;

// Sweep line: one full rotation every 4 seconds
const SWEEP_PERIOD = 4000; // ms

/**
 * Draw the circular minimap radar in the bottom-right corner.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, aimAngle: number }} player  – world position + aim
 * @param {Array<{ active: boolean, x: number, y: number, isBoss: boolean, isElite: boolean, radius: number }>} enemies
 * @param {Array<{ active: boolean, x: number, y: number }>} xpGems
 */
export function drawMinimap(ctx, player, enemies, xpGems) {
    ctx.save();

    // --- circular clip mask ---
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, MAP_RADIUS, 0, Math.PI * 2);
    ctx.clip();

    // --- radial gradient background (lighter at center) ---
    const bgGrad = ctx.createRadialGradient(CENTER_X, CENTER_Y, 0, CENTER_X, CENTER_Y, MAP_RADIUS);
    bgGrad.addColorStop(0, 'rgba(15, 20, 30, 0.6)');
    bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(CENTER_X - MAP_RADIUS, CENTER_Y - MAP_RADIUS, MAP_SIZE, MAP_SIZE);

    // --- range rings at 33% and 66% ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 0.5;
    for (const frac of [0.33, 0.66]) {
        ctx.beginPath();
        ctx.arc(CENTER_X, CENTER_Y, MAP_RADIUS * frac, 0, Math.PI * 2);
        ctx.stroke();
    }

    // --- crosshair grid lines ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    // horizontal
    ctx.moveTo(CENTER_X - MAP_RADIUS, CENTER_Y);
    ctx.lineTo(CENTER_X + MAP_RADIUS, CENTER_Y);
    // vertical
    ctx.moveTo(CENTER_X, CENTER_Y - MAP_RADIUS);
    ctx.lineTo(CENTER_X, CENTER_Y + MAP_RADIUS);
    ctx.stroke();

    // --- cardinal tick marks (N/S/E/W) ---
    const TICK_LEN = 5;
    const TICK_OFFSET = 3; // inset from edge
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // N
    ctx.moveTo(CENTER_X, CENTER_Y - MAP_RADIUS + TICK_OFFSET);
    ctx.lineTo(CENTER_X, CENTER_Y - MAP_RADIUS + TICK_OFFSET + TICK_LEN);
    // S
    ctx.moveTo(CENTER_X, CENTER_Y + MAP_RADIUS - TICK_OFFSET);
    ctx.lineTo(CENTER_X, CENTER_Y + MAP_RADIUS - TICK_OFFSET - TICK_LEN);
    // E
    ctx.moveTo(CENTER_X + MAP_RADIUS - TICK_OFFSET, CENTER_Y);
    ctx.lineTo(CENTER_X + MAP_RADIUS - TICK_OFFSET - TICK_LEN, CENTER_Y);
    // W
    ctx.moveTo(CENTER_X - MAP_RADIUS + TICK_OFFSET, CENTER_Y);
    ctx.lineTo(CENTER_X - MAP_RADIUS + TICK_OFFSET + TICK_LEN, CENTER_Y);
    ctx.stroke();

    // Tiny "N" label at top
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('N', CENTER_X, CENTER_Y - MAP_RADIUS + TICK_OFFSET + TICK_LEN + 1);

    // --- sweep line (rotating radar sweep) ---
    const now = performance.now();
    const sweepAngle = ((now % SWEEP_PERIOD) / SWEEP_PERIOD) * Math.PI * 2 - Math.PI / 2; // start from top
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#88CCFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(CENTER_X, CENTER_Y);
    ctx.lineTo(
        CENTER_X + Math.cos(sweepAngle) * MAP_RADIUS,
        CENTER_Y + Math.sin(sweepAngle) * MAP_RADIUS
    );
    ctx.stroke();
    // faint trailing wedge for sweep effect
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#88CCFF';
    ctx.beginPath();
    ctx.moveTo(CENTER_X, CENTER_Y);
    ctx.arc(CENTER_X, CENTER_Y, MAP_RADIUS, sweepAngle - 0.4, sweepAngle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Helper: convert world offset (relative to player) into minimap pixel coords.
    const scale = MAP_RADIUS / MAP_RANGE;

    function toMinimap(wx, wy) {
        let dx = (wx - player.x) * scale;
        let dy = (wy - player.y) * scale;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let clamped = false;

        if (dist > MAP_RADIUS - 2) {
            const f = (MAP_RADIUS - 2) / dist;
            dx *= f;
            dy *= f;
            clamped = true;
        }

        return {
            mx: CENTER_X + dx,
            my: CENTER_Y + dy,
            clamped,
        };
    }

    // --- XP gems (green, drawn first so enemies overlay them) ---
    ctx.fillStyle = '#44FF88';
    for (let i = 0; i < xpGems.length; i++) {
        const g = xpGems[i];
        if (!g.active) continue;

        const gdx = g.x - player.x;
        const gdy = g.y - player.y;
        if (gdx * gdx + gdy * gdy > MAP_RANGE * MAP_RANGE) continue;

        const { mx, my } = toMinimap(g.x, g.y);
        ctx.fillRect(mx - GEM_DOT, my - GEM_DOT, GEM_DOT * 2, GEM_DOT * 2);
    }

    // --- Enemies ---
    const bossPulse = Math.sin(now * 0.004) * 1.2; // boss dot size pulsing

    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.active) continue;

        const { mx, my } = toMinimap(e.x, e.y);

        if (e.isBoss) {
            // Boss: larger yellow dot, pulsing size
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(mx, my, BOSS_DOT + bossPulse, 0, Math.PI * 2);
            ctx.fill();
        } else if (e.isElite) {
            // Elite: medium orange-ish dot
            ctx.fillStyle = '#FF8844';
            ctx.beginPath();
            ctx.arc(mx, my, ELITE_DOT, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Regular: small red dot
            ctx.fillStyle = '#FF4444';
            ctx.beginPath();
            ctx.arc(mx, my, ENEMY_DOT, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // --- Player direction indicator (arrow/triangle pointing aim direction) ---
    const aimAngle = player.aimAngle || 0;
    const ARROW_LEN = 7;
    const ARROW_HALF_W = 3;
    const tipX = CENTER_X + Math.cos(aimAngle) * ARROW_LEN;
    const tipY = CENTER_Y + Math.sin(aimAngle) * ARROW_LEN;
    const backAngle = aimAngle + Math.PI;
    const lx = CENTER_X + Math.cos(backAngle + 0.5) * ARROW_HALF_W;
    const ly = CENTER_Y + Math.sin(backAngle + 0.5) * ARROW_HALF_W;
    const rx = CENTER_X + Math.cos(backAngle - 0.5) * ARROW_HALF_W;
    const ry = CENTER_Y + Math.sin(backAngle - 0.5) * ARROW_HALF_W;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(lx, ly);
    ctx.lineTo(rx, ry);
    ctx.closePath();
    ctx.fill();

    // --- restore before drawing the border (border should not be clipped) ---
    ctx.restore();

    // --- double ring border ---
    ctx.save();
    // Inner ring: thin white
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, MAP_RADIUS - 1, 0, Math.PI * 2);
    ctx.stroke();
    // Outer ring: slightly thicker dark
    ctx.strokeStyle = 'rgba(100, 120, 140, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, MAP_RADIUS + 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}
