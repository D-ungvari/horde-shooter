import { CANVAS_WIDTH, CANVAS_HEIGHT, COLOR_PLAYER, COLOR_PLAYER_DARK, COLOR_BULLET } from './constants.js';
import { applyCamera, isInView } from './camera.js';
import { getMouse } from './input.js';
import { drawBackground } from './background.js';
import { drawCircle, drawBar, drawGlow } from './drawLib.js';
import { v2FromAngle } from './utils.js';

let ctx;
let gameTime = 0;

export function initRenderer(context) {
    ctx = context;
}

export function renderGame(camera, player, enemies, projectiles, xpGems, dt, state) {
    gameTime += dt || 1 / 60;

    // Clear
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // --- World space rendering ---
    ctx.save();
    applyCamera(ctx, camera);

    // Background tiles
    drawBackground(ctx, camera);

    // XP gems
    if (xpGems) {
        for (let i = 0; i < xpGems.length; i++) {
            const gem = xpGems[i];
            if (!gem || !gem.active) continue;
            if (!isInView(camera, gem.x, gem.y, 40)) continue;
            drawXPGem(gem);
        }
    }

    // Enemies
    if (enemies) {
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || !e.active) continue;
            if (!isInView(camera, e.x, e.y, e.radius + 30)) continue;
            drawEnemyEntity(e);
        }
    }

    // Player
    drawPlayerEntity(player);

    // Projectiles
    if (projectiles) {
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (!p || !p.active) continue;
            if (!isInView(camera, p.x, p.y, 20)) continue;
            drawProjectile(p);
        }
    }

    ctx.restore();
    // --- End world space ---

    // --- Screen space HUD ---
    drawHUD(player, state);
}

// --- Entity drawing ---

function drawPlayerEntity(player) {
    const { x, y, radius, aimAngle, invincible } = player;
    const isMoving = Math.abs(player.vx) > 10 || Math.abs(player.vy) > 10;
    const breathe = Math.sin(gameTime * 3) * 0.5;

    ctx.save();

    if (invincible > 0) {
        ctx.globalAlpha = Math.floor(invincible * 10) % 2 === 0 ? 0.3 : 1.0;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + radius + 2, radius * 0.8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (behind body)
    const legPhase = isMoving ? Math.sin(gameTime * 14) : 0;
    const moveAngle = Math.atan2(player.vy, player.vx);
    ctx.fillStyle = '#2255AA';
    for (let side = -1; side <= 1; side += 2) {
        const legOffset = legPhase * 4 * side;
        const perpX = Math.cos(moveAngle + Math.PI / 2) * 5 * side;
        const perpY = Math.sin(moveAngle + Math.PI / 2) * 5 * side;
        const fwdX = Math.cos(moveAngle) * legOffset;
        const fwdY = Math.sin(moveAngle) * legOffset;
        ctx.beginPath();
        ctx.arc(x + perpX + fwdX, y + perpY + fwdY + 4, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Body
    ctx.fillStyle = COLOR_PLAYER;
    ctx.beginPath();
    ctx.arc(x, y + breathe, radius, 0, Math.PI * 2);
    ctx.fill();

    // Body armor ring
    ctx.strokeStyle = COLOR_PLAYER_DARK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y + breathe, radius - 3, 0, Math.PI * 2);
    ctx.stroke();

    // Body highlight
    ctx.fillStyle = '#66AAFF';
    ctx.beginPath();
    ctx.arc(x - 3, y - 4 + breathe, 4, 0, Math.PI * 2);
    ctx.fill();

    // Gun arm
    ctx.save();
    ctx.translate(x, y + breathe);
    ctx.rotate(aimAngle);
    // Arm
    ctx.fillStyle = '#3377CC';
    ctx.fillRect(8, -3, 14, 6);
    // Gun
    ctx.fillStyle = '#888899';
    ctx.fillRect(18, -4, 14, 8);
    // Barrel
    ctx.fillStyle = '#666677';
    ctx.fillRect(30, -2, 8, 4);
    // Muzzle
    ctx.fillStyle = '#AAAABB';
    ctx.fillRect(20, -3, 3, 6);
    ctx.restore();

    // Eyes (facing aim direction)
    const eyeDist = 5;
    const eyeAngle = aimAngle;
    const eyeOffX = Math.cos(eyeAngle) * 3;
    const eyeOffY = Math.sin(eyeAngle) * 3;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x - 4 + eyeOffX, y - 4 + eyeOffY + breathe, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 4 + eyeOffX, y - 4 + eyeOffY + breathe, 3, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#112244';
    ctx.beginPath();
    ctx.arc(x - 4 + eyeOffX * 1.4, y - 4 + eyeOffY * 1.4 + breathe, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 4 + eyeOffX * 1.4, y - 4 + eyeOffY * 1.4 + breathe, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.restore();
}

function drawEnemyEntity(e) {
    // Default circle enemy — will be expanded per type
    ctx.fillStyle = e.color || '#FF4444';

    // Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.radius + 2, e.radius * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body
    ctx.fillStyle = e.color || '#FF4444';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // Eyes facing player direction
    if (e.targetAngle !== undefined) {
        const eyeOff = Math.min(e.radius * 0.3, 4);
        const ex = Math.cos(e.targetAngle) * eyeOff;
        const ey = Math.sin(e.targetAngle) * eyeOff;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(e.x - 3 + ex, e.y - 2 + ey, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x + 3 + ex, e.y - 2 + ey, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(e.x - 3 + ex * 1.3, e.y - 2 + ey * 1.3, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x + 3 + ex * 1.3, e.y - 2 + ey * 1.3, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Health bar if damaged
    if (e.health < e.maxHealth && e.health > 0) {
        const barW = e.radius * 2 + 4;
        drawBar(ctx, e.x - barW / 2, e.y - e.radius - 8, barW, 3,
            e.health / e.maxHealth, '#FF3333', '#333', '#555');
    }
}

function drawXPGem(gem) {
    const pulse = 1 + Math.sin(gameTime * 6 + gem.x) * 0.15;
    const r = gem.radius * pulse;

    // Glow
    drawGlow(ctx, gem.x, gem.y, r * 2.5, gem.color, 0.15);

    // Gem
    ctx.fillStyle = gem.color;
    ctx.beginPath();
    // Diamond shape
    ctx.moveTo(gem.x, gem.y - r);
    ctx.lineTo(gem.x + r * 0.7, gem.y);
    ctx.lineTo(gem.x, gem.y + r);
    ctx.lineTo(gem.x - r * 0.7, gem.y);
    ctx.closePath();
    ctx.fill();

    // Shine
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(gem.x - 1, gem.y - 2, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawProjectile(p) {
    // Glow
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = p.color || COLOR_BULLET;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
    ctx.fill();
    // Core
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color || COLOR_BULLET;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
}

// --- HUD (screen space) ---

function drawHUD(player, state) {
    if (!player) return;

    // HP bar (top left)
    const hpRatio = player.health / player.maxHealth;
    const r = Math.floor(255 * (1 - hpRatio));
    const g = Math.floor(200 * hpRatio);
    drawBar(ctx, 10, 10, 200, 18, hpRatio, `rgb(${r},${g},50)`);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`HP: ${Math.ceil(player.health)} / ${player.maxHealth}`, 14, 24);

    // XP bar (bottom, full width)
    const xpRatio = player.xp / player.xpToNext;
    drawBar(ctx, 0, CANVAS_HEIGHT - 16, CANVAS_WIDTH, 16, xpRatio, '#44FF88', '#111', '#333');
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv ${player.level}  —  ${player.xp} / ${player.xpToNext} XP`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 4);

    // Kill count (top right)
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Kills: ${player.killCount}`, CANVAS_WIDTH - 10, 24);

    // Weapon inventory (top left, below HP bar)
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    let wy = 38;
    for (const weapon of player.weapons) {
        const levelPips = '■'.repeat(weapon.level) + '□'.repeat(8 - weapon.level);
        ctx.fillStyle = '#888';
        ctx.fillText(`${weapon.id}`, 12, wy);
        ctx.fillStyle = weapon.level >= 8 ? '#FFD700' : '#44FF88';
        ctx.fillText(levelPips, 100, wy);
        wy += 14;
    }

    // Passive inventory (below weapons)
    if (player.passives.length > 0) {
        wy += 4;
        for (const passive of player.passives) {
            ctx.fillStyle = '#777';
            ctx.fillText(`${passive.id}`, 12, wy);
            ctx.fillStyle = '#88AAFF';
            ctx.fillText('■'.repeat(passive.level) + '□'.repeat(5 - passive.level), 100, wy);
            wy += 14;
        }
    }

    ctx.textAlign = 'left';
}

// --- Crosshair ---

export function drawCrosshair(ctx) {
    const mouse = getMouse();
    const size = 10;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    // Cross
    ctx.beginPath();
    ctx.moveTo(mouse.x - size, mouse.y);
    ctx.lineTo(mouse.x - 4, mouse.y);
    ctx.moveTo(mouse.x + 4, mouse.y);
    ctx.lineTo(mouse.x + size, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - size);
    ctx.lineTo(mouse.x, mouse.y - 4);
    ctx.moveTo(mouse.x, mouse.y + 4);
    ctx.lineTo(mouse.x, mouse.y + size);
    ctx.stroke();
    // Center dot
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
}
