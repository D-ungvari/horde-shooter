import { CANVAS_WIDTH, CANVAS_HEIGHT, COLOR_PLAYER, COLOR_PLAYER_DARK, COLOR_BULLET } from './constants.js';
import { applyCamera, isInView } from './camera.js';
import { getMouse } from './input.js';
import { drawBackground, drawAmbientParticles } from './background.js';
import { BIOMES } from './biomes.js';
import { drawCircle, drawBar, drawGlow } from './drawLib.js';
import { v2FromAngle } from './utils.js';
import { renderEffects, renderScreenEffects, getShakeOffset } from './effects.js';

let ctx;
let gameTime = 0;

export function initRenderer(context) {
    ctx = context;
}

export function renderGame(camera, player, enemies, projectiles, xpGems, dt, state, orbitals, biomeId) {
    gameTime += dt || 1 / 60;

    // Clear with biome bg color
    const biomeDef = BIOMES[biomeId] || BIOMES.graveyard;
    ctx.fillStyle = biomeDef.bgColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // --- World space rendering ---
    const shake = getShakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);
    applyCamera(ctx, camera);

    // Background tiles
    drawBackground(ctx, camera, biomeId);

    // Ambient particles (mist, embers, sparks)
    drawAmbientParticles(ctx, biomeId);

    // Zone projectiles (draw under everything)
    if (projectiles) {
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (!p || !p.active) continue;
            if (p.type === 'zone') {
                if (!isInView(camera, p.x, p.y, p.radius + 20)) continue;
                drawZone(p);
            }
        }
    }

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

    // Orbitals (draw around player)
    if (orbitals) {
        for (const orb of orbitals) {
            drawOrbital(orb);
        }
    }

    // Player
    drawPlayerEntity(player);

    // Projectiles (non-zone)
    if (projectiles) {
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (!p || !p.active) continue;
            if (p.type === 'zone') continue; // Already drawn
            if (!isInView(camera, p.x, p.y, Math.max(p.radius, 20) + 10)) continue;
            drawProjectile(p);
        }
    }

    // Particles & damage numbers (world space)
    renderEffects(ctx, camera);

    ctx.restore();
    // --- End world space ---

    // Screen flash overlay
    renderScreenEffects(ctx);

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
    ctx.fillStyle = '#3377CC';
    ctx.fillRect(8, -3, 14, 6);
    ctx.fillStyle = '#888899';
    ctx.fillRect(18, -4, 14, 8);
    ctx.fillStyle = '#666677';
    ctx.fillRect(30, -2, 8, 4);
    ctx.fillStyle = '#AAAABB';
    ctx.fillRect(20, -3, 3, 6);
    ctx.restore();

    // Eyes (facing aim direction)
    const eyeOffX = Math.cos(aimAngle) * 3;
    const eyeOffY = Math.sin(aimAngle) * 3;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x - 4 + eyeOffX, y - 4 + eyeOffY + breathe, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 4 + eyeOffX, y - 4 + eyeOffY + breathe, 3, 0, Math.PI * 2);
    ctx.fill();
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
    // Slow tint
    const slowed = e.slowTimer > 0;

    // Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.radius + 2, e.radius * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Exploder pulsing glow
    if (e.type === 'exploder') {
        const pulse = 0.3 + Math.sin(gameTime * 8 + e.pulseTimer) * 0.2;
        drawGlow(ctx, e.x, e.y, e.radius * 2.5, '#FF2222', pulse);
        if (e.chargeState === 'charging') {
            drawGlow(ctx, e.x, e.y, e.radius * 3, '#FFFF00', 0.4);
        }
    }

    // Boss glow — pulsing, large
    if (e.isBoss) {
        const bossPulse = 0.25 + Math.sin(gameTime * 3) * 0.1;
        drawGlow(ctx, e.x, e.y, e.radius * 3, '#FF2200', bossPulse);
        drawGlow(ctx, e.x, e.y, e.radius * 2, e.color, 0.3);
    }

    // Elite glow
    if (e.isElite) {
        drawGlow(ctx, e.x, e.y, e.radius * 2, '#FFD700', 0.2);
    }

    // Body
    ctx.fillStyle = slowed ? '#88BBDD' : (e.color || '#FF4444');
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // Frost ring if slowed
    if (slowed) {
        ctx.strokeStyle = '#AADDFF';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    // Elite crown indicator
    if (e.isElite) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 2, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Eyes facing player direction
    if (e.targetAngle !== undefined) {
        const eyeOff = Math.min(e.radius * 0.3, 4);
        const ex = Math.cos(e.targetAngle) * eyeOff;
        const ey = Math.sin(e.targetAngle) * eyeOff;
        const eyeScale = Math.min(e.radius / 12, 1.5);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(e.x - 3 * eyeScale + ex, e.y - 2 * eyeScale + ey, 2.5 * eyeScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x + 3 * eyeScale + ex, e.y - 2 * eyeScale + ey, 2.5 * eyeScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = e.type === 'exploder' ? '#FF0000' : '#000';
        ctx.beginPath();
        ctx.arc(e.x - 3 * eyeScale + ex * 1.3, e.y - 2 * eyeScale + ey * 1.3, 1.2 * eyeScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x + 3 * eyeScale + ex * 1.3, e.y - 2 * eyeScale + ey * 1.3, 1.2 * eyeScale, 0, Math.PI * 2);
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

    drawGlow(ctx, gem.x, gem.y, r * 2.5, gem.color, 0.15);

    ctx.fillStyle = gem.color;
    ctx.beginPath();
    ctx.moveTo(gem.x, gem.y - r);
    ctx.lineTo(gem.x + r * 0.7, gem.y);
    ctx.lineTo(gem.x, gem.y + r);
    ctx.lineTo(gem.x - r * 0.7, gem.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(gem.x - 1, gem.y - 2, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawProjectile(p) {
    switch (p.type) {
        case 'lightning':
            drawLightning(p);
            return;
        case 'flame':
            drawFlame(p);
            return;
        case 'boomerang':
            drawBoomerang(p);
            return;
        case 'frostburst':
            drawFrostBurst(p);
            return;
        case 'enemy':
            drawEnemyProjectile(p);
            return;
        default:
            drawNormalProjectile(p);
    }
}

function drawNormalProjectile(p) {
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

function drawLightning(p) {
    // Draw a jagged line between endpoints
    ctx.strokeStyle = p.color || '#88CCFF';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1 - (p.lifetime / p.maxLifetime);

    const dx = p.x2 - p.x1;
    const dy = p.y2 - p.y1;
    const steps = 6;

    ctx.beginPath();
    ctx.moveTo(p.x1, p.y1);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const jx = (Math.random() - 0.5) * 15;
        const jy = (Math.random() - 0.5) * 15;
        ctx.lineTo(p.x1 + dx * t + jx, p.y1 + dy * t + jy);
    }
    ctx.lineTo(p.x2, p.y2);
    ctx.stroke();

    // Bright center line
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x1, p.y1);
    ctx.lineTo(p.x2, p.y2);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
}

function drawFlame(p) {
    const fade = 1 - (p.lifetime / p.maxLifetime);
    const r = p.radius * (1 + (1 - fade) * 1.5);

    ctx.globalAlpha = fade * 0.8;
    // Outer flame
    ctx.fillStyle = '#FF4400';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.3, 0, Math.PI * 2);
    ctx.fill();
    // Inner flame
    ctx.fillStyle = p.color || '#FF6622';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Core
    ctx.fillStyle = '#FFDD44';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawBoomerang(p) {
    const spin = gameTime * 12;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(spin);

    // Boomerang shape
    ctx.fillStyle = p.color || '#44DDAA';
    ctx.beginPath();
    ctx.moveTo(0, -p.radius);
    ctx.quadraticCurveTo(p.radius * 0.8, -p.radius * 0.3, p.radius, 0);
    ctx.quadraticCurveTo(p.radius * 0.5, p.radius * 0.2, 0, p.radius * 0.3);
    ctx.quadraticCurveTo(-p.radius * 0.5, p.radius * 0.2, -p.radius, 0);
    ctx.quadraticCurveTo(-p.radius * 0.8, -p.radius * 0.3, 0, -p.radius);
    ctx.fill();

    // Shine
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, -p.radius * 0.3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.restore();
}

function drawFrostBurst(p) {
    const fade = 1 - (p.lifetime / p.maxLifetime);
    ctx.globalAlpha = fade * 0.6;
    ctx.fillStyle = p.color || '#AADDFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * (1 + (1 - fade)), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawEnemyProjectile(p) {
    // Enemy bullet — distinct color
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#AAFF44';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#DDFF88';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#AAFF44';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawZone(p) {
    const fade = 1 - (p.lifetime / p.maxLifetime);
    const pulse = 1 + Math.sin(gameTime * 4) * 0.05;
    const r = p.radius * pulse;

    // Outer glow
    ctx.globalAlpha = fade * 0.15;
    ctx.fillStyle = p.color || '#66FF44';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Main zone
    ctx.globalAlpha = fade * 0.25;
    ctx.fillStyle = p.color || '#66FF44';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Border ring
    ctx.globalAlpha = fade * 0.4;
    ctx.strokeStyle = p.color || '#66FF44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
}

function drawOrbital(orb) {
    // Glow
    drawGlow(ctx, orb.x, orb.y, orb.radius * 2.5, orb.color, 0.3);

    // Core
    ctx.fillStyle = orb.color;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fill();

    // Shine
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(orb.x - 2, orb.y - 2, orb.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
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
        const maxLvl = 8;
        const levelPips = '\u25A0'.repeat(weapon.level) + '\u25A1'.repeat(maxLvl - weapon.level);
        ctx.fillStyle = '#888';
        ctx.fillText(`${weapon.id}`, 12, wy);
        ctx.fillStyle = weapon.level >= maxLvl ? '#FFD700' : '#44FF88';
        ctx.fillText(levelPips, 100, wy);
        wy += 14;
    }

    // Passive inventory (below weapons)
    if (player.passives.length > 0) {
        wy += 4;
        for (const passive of player.passives) {
            const maxLvl = 5;
            ctx.fillStyle = '#777';
            ctx.fillText(`${passive.id}`, 12, wy);
            ctx.fillStyle = '#88AAFF';
            ctx.fillText('\u25A0'.repeat(passive.level) + '\u25A1'.repeat(maxLvl - passive.level), 100, wy);
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
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
}
