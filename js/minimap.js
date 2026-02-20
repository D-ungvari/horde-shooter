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

/**
 * Draw the circular minimap radar in the bottom-right corner.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} player  – world position
 * @param {Array<{ active: boolean, x: number, y: number, isBoss: boolean, isElite: boolean, radius: number }>} enemies
 * @param {Array<{ active: boolean, x: number, y: number }>} xpGems
 */
export function drawMinimap(ctx, player, enemies, xpGems) {
    ctx.save();

    // --- circular clip mask ---
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, MAP_RADIUS, 0, Math.PI * 2);
    ctx.clip();

    // --- dark semi-transparent background ---
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(CENTER_X - MAP_RADIUS, CENTER_Y - MAP_RADIUS, MAP_SIZE, MAP_SIZE);

    // Helper: convert world offset (relative to player) into minimap pixel coords.
    // Returns { mx, my, clamped } where clamped is true if the point was outside range.
    const scale = MAP_RADIUS / MAP_RANGE;

    function toMinimap(wx, wy) {
        let dx = (wx - player.x) * scale;
        let dy = (wy - player.y) * scale;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let clamped = false;

        if (dist > MAP_RADIUS - 2) {
            // Clamp to edge (leave 2px inset so dots stay visible)
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

        // Only show gems within range
        const gdx = g.x - player.x;
        const gdy = g.y - player.y;
        if (gdx * gdx + gdy * gdy > MAP_RANGE * MAP_RANGE) continue;

        const { mx, my } = toMinimap(g.x, g.y);
        ctx.fillRect(mx - GEM_DOT, my - GEM_DOT, GEM_DOT * 2, GEM_DOT * 2);
    }

    // --- Enemies ---
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.active) continue;

        const { mx, my } = toMinimap(e.x, e.y);

        if (e.isBoss) {
            // Boss: larger yellow dot
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(mx, my, BOSS_DOT, 0, Math.PI * 2);
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

    // --- Player (white dot, always at center) ---
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, PLAYER_DOT, 0, Math.PI * 2);
    ctx.fill();

    // --- restore before drawing the border (border should not be clipped) ---
    ctx.restore();

    // --- circular border ---
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, MAP_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}
