import { CANVAS_WIDTH, CANVAS_HEIGHT, COLOR_PLAYER, COLOR_PLAYER_DARK, COLOR_BULLET, DEATH_ANIM_DURATION, DEATH_ANIM_EXPAND_PHASE } from './constants.js';
import { applyCamera, isInView } from './camera.js';
import { getMouse } from './input.js';
import { drawBackground, drawAmbientParticles } from './background.js';
import { BIOMES } from './biomes.js';
import { drawCircle, drawBar, drawGlow } from './drawLib.js';
import { v2FromAngle } from './utils.js';
import { renderEffects, renderScreenEffects, getShakeOffset } from './effects.js';
import { getCooldowns } from './weapons.js';
import { WEAPONS, EVOLUTIONS, getWeaponStats } from './weaponData.js';
import { PASSIVES } from './passiveData.js';
import { drawMinimap } from './minimap.js';
import { getGold } from './meta.js';

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
            if (p.type === 'zone' || p.type === 'firezone' || p.type === 'plaguezone' || p.type === 'frostdot') {
                if (!isInView(camera, p.x, p.y, p.radius + 20)) continue;
                if (p.type === 'firezone') {
                    drawFireZone(p);
                } else if (p.type === 'plaguezone') {
                    drawPlagueZone(p);
                } else if (p.type === 'frostdot') {
                    drawFrostDotZone(p);
                } else {
                    drawZone(p);
                }
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
            if (p.type === 'zone' || p.type === 'firezone' || p.type === 'plaguezone' || p.type === 'frostdot') continue; // Already drawn
            if (!isInView(camera, p.x, p.y, Math.max(p.radius, 20) + 10)) continue;
            drawProjectileTrail(p);
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

    // Minimap (only during gameplay states)
    if (state === 'PLAYING' || state === 'PAUSED') {
        drawMinimap(ctx, player, enemies, xpGems);
    }
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
    // Death animation: scale up then shrink to 0
    if (e.dying) {
        const elapsed = DEATH_ANIM_DURATION - e.deathTimer;
        let scale;
        if (elapsed <= DEATH_ANIM_EXPAND_PHASE) {
            scale = 1.0 + 0.3 * (elapsed / DEATH_ANIM_EXPAND_PHASE);
        } else {
            const shrinkT = (elapsed - DEATH_ANIM_EXPAND_PHASE) / (DEATH_ANIM_DURATION - DEATH_ANIM_EXPAND_PHASE);
            scale = 1.3 * (1 - shrinkT);
        }
        scale = Math.max(0, scale);

        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.scale(scale, scale);
        ctx.rotate(e.deathRotation);
        ctx.globalAlpha = Math.max(0.1, scale / 1.3);

        // Simplified body for death anim
        ctx.fillStyle = e.color || '#FF4444';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();

        // White flash overlay during expand
        if (elapsed <= DEATH_ANIM_EXPAND_PHASE) {
            ctx.fillStyle = '#FFFFFF';
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        return;
    }

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

    // Hit flash overlay
    if (e.hitFlashTimer > 0) {
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
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

function drawProjectileTrail(p) {
    if (p.trailCount <= 0) return;
    // Skip trails for types that don't move or have custom visuals
    if (p.type === 'lightning' || p.type === 'frostburst' || p.type === 'zone' ||
        p.type === 'firezone' || p.type === 'plaguezone' || p.type === 'frostdot') return;

    const trailColor = p.color || '#FFDD44';
    for (let i = 0; i < p.trailCount; i++) {
        // Read from ring buffer: oldest to newest
        const idx = (p.trailHead - p.trailCount + i + 6) % 6;
        const age = (p.trailCount - i) / p.trailCount; // 1 = oldest, 0 = newest
        const alpha = (1 - age) * 0.4;
        const r = p.radius * (1 - age * 0.5);
        if (alpha < 0.02) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = trailColor;
        ctx.beginPath();
        ctx.arc(p.trailX[idx], p.trailY[idx], Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
    }
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
        case 'chakram':
            drawChakram(p);
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

function drawChakram(p) {
    const spin = gameTime * 20; // Faster spin than boomerang
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(spin);

    const r = p.radius;

    // Outer glow ring
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.stroke();

    // Chakram disc: 6-pointed star shape
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = p.color || '#22FFCC';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 / 6) * i;
        const outerR = r;
        const innerR = r * 0.5;
        const a2 = a + Math.PI / 6;
        if (i === 0) {
            ctx.moveTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
        } else {
            ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
        }
        ctx.lineTo(Math.cos(a2) * innerR, Math.sin(a2) * innerR);
    }
    ctx.closePath();
    ctx.fill();

    // Center core
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.restore();
}

function drawFireZone(p) {
    const fade = 1 - (p.lifetime / p.maxLifetime);
    const pulse = 1 + Math.sin(gameTime * 6) * 0.08;
    const r = p.radius * pulse;

    // Outer glow
    ctx.globalAlpha = fade * 0.2;
    ctx.fillStyle = '#FF6600';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Main fire zone
    ctx.globalAlpha = fade * 0.3;
    ctx.fillStyle = '#FF4400';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Hot core
    ctx.globalAlpha = fade * 0.4;
    ctx.fillStyle = '#FFAA22';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Border ring
    ctx.globalAlpha = fade * 0.5;
    ctx.strokeStyle = '#FF4400';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
}

function drawPlagueZone(p) {
    const fade = 1 - (p.lifetime / p.maxLifetime);
    const pulse = 1 + Math.sin(gameTime * 3) * 0.06;
    const r = p.radius * pulse;

    // Outer sickly glow
    ctx.globalAlpha = fade * 0.12;
    ctx.fillStyle = '#AAFF22';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Main plague zone
    ctx.globalAlpha = fade * 0.25;
    ctx.fillStyle = '#88FF22';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Toxic core
    ctx.globalAlpha = fade * 0.35;
    ctx.fillStyle = '#44DD00';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Border ring — pulsing skull-green
    ctx.globalAlpha = fade * 0.5;
    ctx.strokeStyle = '#66FF00';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 1.0;
}

function drawFrostDotZone(p) {
    const fade = 1 - (p.lifetime / p.maxLifetime);
    const pulse = 1 + Math.sin(gameTime * 5) * 0.04;
    const r = p.radius * pulse;

    // Outer frost glow
    ctx.globalAlpha = fade * 0.1;
    ctx.fillStyle = '#88DDFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Main frost zone
    ctx.globalAlpha = fade * 0.15;
    ctx.fillStyle = '#66CCFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Ice ring border
    ctx.globalAlpha = fade * 0.35;
    ctx.strokeStyle = '#AAEEFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner crystalline pattern
    ctx.globalAlpha = fade * 0.2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 / 6) * i + gameTime * 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * r * 0.6, p.y + Math.sin(a) * r * 0.6);
        ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
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

    const cooldowns = getCooldowns();

    // === HP Bar (top left) ===
    const hpRatio = player.health / player.maxHealth;
    const r = Math.floor(255 * (1 - hpRatio));
    const g = Math.floor(200 * hpRatio);

    // HP bar background
    ctx.fillStyle = '#111';
    ctx.fillRect(9, 9, 162, 14);
    // HP bar fill
    ctx.fillStyle = `rgb(${r},${g},50)`;
    ctx.fillRect(10, 10, 160 * hpRatio, 12);
    // HP bar border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(9, 9, 162, 14);
    // HP text
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`HP: ${Math.ceil(player.health)} / ${player.maxHealth}`, 14, 19);

    // === Weapon slots (top left, below HP) ===
    let wy = 30;
    for (let i = 0; i < player.weapons.length; i++) {
        const weapon = player.weapons[i];
        const def = WEAPONS[weapon.id] || EVOLUTIONS[weapon.id];
        const maxLvl = 8;
        const isMaxed = weapon.level >= maxLvl;
        const stats = getWeaponStats(weapon.id, weapon.level);

        // Cooldown bar background
        const barX = 10;
        const barW = 160;
        const barH = 10;
        ctx.fillStyle = '#111';
        ctx.fillRect(barX, wy, barW, barH);

        // Cooldown fill
        const cd = cooldowns[i] || 0;
        if (stats && stats.cooldown > 0) {
            const cdRatio = Math.max(0, 1 - (cd / stats.cooldown));
            const cdColor = cdRatio >= 1 ? '#336633' : '#222233';
            ctx.fillStyle = cdColor;
            ctx.fillRect(barX, wy, barW * cdRatio, barH);
        } else {
            ctx.fillStyle = '#336633';
            ctx.fillRect(barX, wy, barW, barH);
        }

        // Border
        ctx.strokeStyle = isMaxed ? '#FFD700' : '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, wy, barW, barH);

        // Weapon name + pips
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = isMaxed ? '#FFD700' : '#aaa';
        const displayName = def ? def.name : weapon.id;
        ctx.fillText(displayName, barX + 3, wy + 8);

        // Level pips on the right side
        const pipStr = '\u25A0'.repeat(weapon.level) + '\u25A1'.repeat(maxLvl - weapon.level);
        ctx.fillStyle = isMaxed ? '#FFD700' : '#44FF88';
        ctx.font = '8px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(pipStr, barX + barW - 3, wy + 8);

        wy += 13;
    }

    // === Passive icons (compact row below weapons) ===
    if (player.passives.length > 0) {
        wy += 4;
        let px = 10;
        for (const passive of player.passives) {
            const def = PASSIVES[passive.id];
            const maxLvl = 5;

            // Background box
            ctx.fillStyle = '#111';
            ctx.fillRect(px, wy, 28, 22);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(px, wy, 28, 22);

            // Icon
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(def ? def.icon : '?', px + 14, wy + 12);

            // Level dots below icon
            ctx.font = '7px monospace';
            ctx.fillStyle = '#88AAFF';
            const dots = '\u25CF'.repeat(passive.level) + '\u25CB'.repeat(maxLvl - passive.level);
            ctx.fillText(dots, px + 14, wy + 20);

            px += 31;
        }
    }

    // === XP bar (bottom, full width) ===
    const xpRatio = player.xp / player.xpToNext;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, CANVAS_HEIGHT - 16, CANVAS_WIDTH, 16);
    ctx.fillStyle = '#44FF88';
    ctx.fillRect(0, CANVAS_HEIGHT - 16, CANVAS_WIDTH * xpRatio, 16);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, CANVAS_HEIGHT - 16, CANVAS_WIDTH, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv ${player.level}  \u2014  ${player.xp} / ${player.xpToNext} XP`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 4);

    // === Kill count + Gold (top right) ===
    ctx.font = '13px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ccc';
    ctx.fillText(`Kills: ${player.killCount}`, CANVAS_WIDTH - 10, 22);

    ctx.fillStyle = '#FFD700';
    ctx.fillText(`\u2B50 ${getGold()}`, CANVAS_WIDTH - 10, 38);

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
