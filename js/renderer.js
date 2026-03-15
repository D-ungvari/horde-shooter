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
let _player = null;

export function initRenderer(context) {
    ctx = context;
}

export function renderGame(camera, player, enemies, projectiles, xpGems, dt, state, orbitals, biomeId) {
    gameTime += dt || 1 / 60;
    _player = player;

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
    // Spawn animation: scale in from 0
    if (e.spawnTimer > 0) {
        const spawnT = 1 - (e.spawnTimer / 0.3); // 0→1 over 300ms
        const scale = spawnT < 0.85 ? spawnT / 0.85 * 1.1 : 1.1 - (spawnT - 0.85) / 0.15 * 0.1; // overshoot + settle
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.scale(scale, scale);
        ctx.globalAlpha = 0.3 + spawnT * 0.7; // fade in
        // Draw simplified body (just circle)
        ctx.fillStyle = e.color || '#FF4444';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return; // skip normal drawing during spawn
    }

    // LOD: skip composite body for distant enemies
    if (_player) {
        const dx = e.x - _player.x;
        const dy = e.y - _player.y;
        const distSq = dx * dx + dy * dy; // avoid sqrt
        const LOD_MIN_SQ = 500 * 500; // 250000

        if (distSq > LOD_MIN_SQ) {
            // Minimal: just a colored dot
            ctx.fillStyle = e.color || '#FF4444';
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.fill();
            // Still show hit flash at minimal LOD
            if (e.hitFlashTimer > 0) {
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
            return;
        }
    }

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

    // Body (dispatches to type-specific draw fn or circle fallback)
    drawEnemyBody(e);

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

// --- Enemy body dispatch ---

function drawEnemyCircleFallback(e) {
    // Body
    const slowed = e.slowTimer > 0;
    ctx.fillStyle = slowed ? '#88BBDD' : (e.color || '#FF4444');
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();

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
}

function drawShambler(e) {
    const slowed = e.slowTimer > 0;
    const r = e.radius;
    const speed = e.speed || 40;
    const walkPhase = gameTime * speed * 0.1;
    const bodyBob = Math.sin(gameTime * speed * 0.15) * 1.5;
    const facingLeft = e.targetAngle !== undefined && Math.cos(e.targetAngle) < 0;

    ctx.save();
    ctx.translate(e.x, e.y);
    if (facingLeft) ctx.scale(-1, 1);

    // Legs (behind body) — 2 stumpy circles below body, alternating phase
    const legY = r * 0.7;
    const legR = r * 0.35;
    ctx.fillStyle = slowed ? '#668877' : '#337733';
    for (let side = -1; side <= 1; side += 2) {
        const legOff = Math.sin(walkPhase + side * Math.PI * 0.5) * 3;
        ctx.beginPath();
        ctx.arc(side * r * 0.4 + legOff, legY + bodyBob, legR, 0, Math.PI * 2);
        ctx.fill();
    }

    // Arms (dangling thin rects, slight sway)
    const armSway = Math.sin(walkPhase * 0.7) * 0.15;
    ctx.fillStyle = slowed ? '#88BBAA' : '#3D8B3D';
    for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.translate(side * r * 0.85, -r * 0.1 + bodyBob);
        ctx.rotate(0.4 * side + armSway * side);
        ctx.fillRect(-2, 0, 4, r * 0.9);
        ctx.restore();
    }

    // Main body — green ellipse, slightly wider than tall, slouching
    ctx.fillStyle = slowed ? '#88BBDD' : (e.color || '#44AA44');
    ctx.beginPath();
    ctx.ellipse(0, bodyBob, r * 1.05, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // Slack jaw — small arc below body center
    ctx.fillStyle = slowed ? '#556655' : '#2A6B2A';
    ctx.beginPath();
    ctx.arc(0, r * 0.45 + bodyBob, r * 0.35, 0, Math.PI);
    ctx.fill();

    // Eyes — white sclera + dark pupils facing targetAngle
    // When flipped, targetAngle eye offset needs to respect the flip
    const angle = e.targetAngle || 0;
    const eyeDir = facingLeft ? Math.PI - angle : angle;
    const eyeOff = Math.min(r * 0.3, 4);
    const ex = Math.cos(eyeDir) * eyeOff;
    const ey = Math.sin(eyeDir) * eyeOff;
    const eyeScale = Math.min(r / 12, 1.5);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-3 * eyeScale + ex, -3 * eyeScale + ey + bodyBob, 2.5 * eyeScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 * eyeScale + ex, -3 * eyeScale + ey + bodyBob, 2.5 * eyeScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-3 * eyeScale + ex * 1.3, -3 * eyeScale + ey * 1.3 + bodyBob, 1.2 * eyeScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 * eyeScale + ex * 1.3, -3 * eyeScale + ey * 1.3 + bodyBob, 1.2 * eyeScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawRunner(e) {
    const slowed = e.slowTimer > 0;
    const r = e.radius;
    const speed = e.speed || 120;
    const walkPhase = gameTime * speed * 0.15;
    const bodyBob = Math.sin(walkPhase * 1.2) * 1;
    const facingLeft = e.targetAngle !== undefined && Math.cos(e.targetAngle) < 0;

    ctx.save();
    ctx.translate(e.x, e.y);
    if (facingLeft) ctx.scale(-1, 1);

    // Forward lean tilt
    ctx.rotate(0.25);

    // Legs (behind body) — long rects, exaggerated stride
    const legLen = r * 1.3;
    const legW = r * 0.22;
    ctx.fillStyle = slowed ? '#886666' : '#AA2222';
    for (let side = -1; side <= 1; side += 2) {
        const legSwing = Math.sin(walkPhase + side * Math.PI * 0.5) * 0.5;
        ctx.save();
        ctx.translate(side * r * 0.3, r * 0.3 + bodyBob);
        ctx.rotate(legSwing * side);
        ctx.fillRect(-legW / 2, 0, legW, legLen);
        ctx.restore();
    }

    // Main body — tall thin ellipse (opposite of Shambler's wide body)
    ctx.fillStyle = slowed ? '#88BBDD' : (e.color || '#FF4444');
    ctx.beginPath();
    ctx.ellipse(0, bodyBob, r * 0.65, r * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pointed ears — 2 small triangles on top of head
    ctx.fillStyle = slowed ? '#886666' : '#CC3333';
    for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.35, -r * 0.8 + bodyBob);
        ctx.lineTo(side * r * 0.55, -r * 1.3 + bodyBob);
        ctx.lineTo(side * r * 0.15, -r * 0.85 + bodyBob);
        ctx.closePath();
        ctx.fill();
    }

    // Sharp teeth — 3 small triangles along a mouth arc at the front
    ctx.fillStyle = '#FFFFFF';
    for (let i = -1; i <= 1; i++) {
        const toothX = r * 0.35 + i * r * 0.12;
        const toothY = r * 0.25 + bodyBob;
        ctx.beginPath();
        ctx.moveTo(toothX - 2, toothY);
        ctx.lineTo(toothX, toothY + 5);
        ctx.lineTo(toothX + 2, toothY);
        ctx.closePath();
        ctx.fill();
    }

    // Eyes — white sclera + dark pupils tracking targetAngle
    const angle = e.targetAngle || 0;
    const eyeDir = facingLeft ? Math.PI - angle : angle;
    const eyeOff = Math.min(r * 0.3, 4);
    const ex = Math.cos(eyeDir) * eyeOff;
    const ey = Math.sin(eyeDir) * eyeOff;
    const eyeScale = Math.min(r / 12, 1.5);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-3 * eyeScale + ex, -3 * eyeScale + ey + bodyBob, 2.5 * eyeScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 * eyeScale + ex, -3 * eyeScale + ey + bodyBob, 2.5 * eyeScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-3 * eyeScale + ex * 1.3, -3 * eyeScale + ey * 1.3 + bodyBob, 1.2 * eyeScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 * eyeScale + ex * 1.3, -3 * eyeScale + ey * 1.3 + bodyBob, 1.2 * eyeScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawBat(e) {
    const slowed = e.slowTimer > 0;
    const r = e.radius;
    const flap = Math.sin(gameTime * 8 * Math.PI * 2);
    const hoverBob = Math.sin(gameTime * 3) * 2;

    ctx.save();
    ctx.translate(e.x, e.y + hoverBob);

    // Wings — quadratic bezier, symmetric, no flip needed
    const wingSpan = r * 2.2;
    const wingTipY = r * 0.3;
    const flapY = -r * 0.8 + flap * r * 0.6;
    ctx.fillStyle = slowed ? '#7788AA' : (e.color || '#9944CC');
    for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.2);
        ctx.quadraticCurveTo(side * wingSpan * 0.6, flapY, side * wingSpan, wingTipY);
        ctx.quadraticCurveTo(side * wingSpan * 0.5, flapY + r * 0.5, 0, r * 0.4);
        ctx.fill();
    }

    // Body — small circle
    ctx.fillStyle = slowed ? '#88BBDD' : (e.color || '#9944CC');
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Pointed ears
    ctx.fillStyle = slowed ? '#667799' : '#7733AA';
    for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.25, -r * 0.45);
        ctx.lineTo(side * r * 0.45, -r * 1.0);
        ctx.lineTo(side * r * 0.05, -r * 0.5);
        ctx.closePath();
        ctx.fill();
    }

    // Eyes — red, no pupils (bat spec: red eyes, not standard black)
    const angle = e.targetAngle || 0;
    const eyeOff = Math.min(r * 0.2, 3);
    const ex = Math.cos(angle) * eyeOff;
    const ey = Math.sin(angle) * eyeOff;
    ctx.fillStyle = '#FF2222';
    ctx.beginPath();
    ctx.arc(-r * 0.2 + ex, -r * 0.1 + ey, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.2 + ex, -r * 0.1 + ey, r * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawBrute(e) {
    const slowed = e.slowTimer > 0;
    const r = e.radius;
    const speed = e.speed || 30;
    const walkPhase = gameTime * speed * 0.08;
    const bodyBob = Math.sin(gameTime * speed * 0.1) * 1;
    const facingLeft = e.targetAngle !== undefined && Math.cos(e.targetAngle) < 0;

    ctx.save();
    ctx.translate(e.x, e.y);
    if (facingLeft) ctx.scale(-1, 1);

    // Legs — 2 thick rectangles, slow stride
    ctx.fillStyle = slowed ? '#887755' : '#AA6622';
    for (let side = -1; side <= 1; side += 2) {
        const legOff = Math.sin(walkPhase + side * Math.PI * 0.5) * 2;
        ctx.fillRect(side * r * 0.4 - r * 0.18 + legOff, r * 0.4 + bodyBob, r * 0.36, r * 0.7);
    }

    // Main body — wide rounded rectangle
    const bw = r * 1.3;
    const bh = r * 1.1;
    const bx = -bw;
    const by = -bh * 0.6 + bodyBob;
    ctx.fillStyle = slowed ? '#88BBDD' : (e.color || '#DD8833');
    ctx.beginPath();
    ctx.roundRect(bx, by, bw * 2, bh, r * 0.3);
    ctx.fill();

    // Armor plate — darker rect on chest
    ctx.fillStyle = slowed ? '#667788' : '#995522';
    ctx.fillRect(-r * 0.5, -r * 0.3 + bodyBob, r * 1.0, r * 0.6);

    // Horns — 2 triangles on top
    ctx.fillStyle = slowed ? '#998877' : '#CCAA44';
    for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.4, -r * 0.6 + bodyBob);
        ctx.lineTo(side * r * 0.65, -r * 1.3 + bodyBob);
        ctx.lineTo(side * r * 0.2, -r * 0.55 + bodyBob);
        ctx.closePath();
        ctx.fill();
    }

    // Eyes — small, beady
    const angle = e.targetAngle || 0;
    const eyeDir = facingLeft ? Math.PI - angle : angle;
    const eyeOff = Math.min(r * 0.2, 3);
    const ex = Math.cos(eyeDir) * eyeOff;
    const ey = Math.sin(eyeDir) * eyeOff;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-r * 0.25 + ex, -r * 0.35 + ey + bodyBob, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.25 + ex, -r * 0.35 + ey + bodyBob, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-r * 0.25 + ex * 1.3, -r * 0.35 + ey * 1.3 + bodyBob, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.25 + ex * 1.3, -r * 0.35 + ey * 1.3 + bodyBob, r * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawSpitter(e) {
    const slowed = e.slowTimer > 0;
    const r = e.radius;
    const speed = e.speed || 50;
    const walkPhase = gameTime * speed * 0.1;
    const bodyBob = Math.sin(gameTime * speed * 0.12) * 1.5;
    const facingLeft = e.targetAngle !== undefined && Math.cos(e.targetAngle) < 0;

    ctx.save();
    ctx.translate(e.x, e.y);
    if (facingLeft) ctx.scale(-1, 1);

    // Big belly — large circle, lower
    ctx.fillStyle = slowed ? '#88BBDD' : (e.color || '#88DD33');
    ctx.beginPath();
    ctx.arc(0, r * 0.15 + bodyBob, r * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // Smaller head — circle on top
    ctx.fillStyle = slowed ? '#99CCBB' : '#77CC22';
    ctx.beginPath();
    ctx.arc(0, -r * 0.55 + bodyBob, r * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Puffed cheeks — 2 small circles on sides of head
    ctx.fillStyle = slowed ? '#AADDCC' : '#99EE55';
    for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.arc(side * r * 0.5, -r * 0.35 + bodyBob, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Mouth circle with green projectile dot
    ctx.fillStyle = slowed ? '#556655' : '#335511';
    ctx.beginPath();
    ctx.arc(r * 0.25, -r * 0.3 + bodyBob, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = slowed ? '#88AAAA' : '#44FF00';
    ctx.beginPath();
    ctx.arc(r * 0.25, -r * 0.3 + bodyBob, r * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — standard tracking
    const angle = e.targetAngle || 0;
    const eyeDir = facingLeft ? Math.PI - angle : angle;
    const eyeOff = Math.min(r * 0.25, 3);
    const ex = Math.cos(eyeDir) * eyeOff;
    const ey = Math.sin(eyeDir) * eyeOff;
    const eyeScale = Math.min(r / 12, 1.5);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-3 * eyeScale + ex, -r * 0.6 + ey + bodyBob, 2.5 * eyeScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 * eyeScale + ex, -r * 0.6 + ey + bodyBob, 2.5 * eyeScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-3 * eyeScale + ex * 1.3, -r * 0.6 + ey * 1.3 + bodyBob, 1.2 * eyeScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 * eyeScale + ex * 1.3, -r * 0.6 + ey * 1.3 + bodyBob, 1.2 * eyeScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawSwarmer(e) {
    const slowed = e.slowTimer > 0;
    const r = e.radius;
    const speed = e.speed || 80;
    const walkPhase = gameTime * speed * 0.15;

    ctx.save();
    ctx.translate(e.x, e.y);
    // No horizontal flip — rotationally symmetric

    // 6 legs — lineTo strokes radiating from body edge, animated as pairs
    ctx.strokeStyle = slowed ? '#777788' : '#444444';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
        const baseAngle = (i / 6) * Math.PI * 2;
        const pair = i % 3;
        const legAnim = Math.sin(walkPhase + pair * Math.PI * 0.67) * 0.3;
        const legAngle = baseAngle + legAnim;
        ctx.beginPath();
        ctx.moveTo(Math.cos(baseAngle) * r * 0.6, Math.sin(baseAngle) * r * 0.6);
        ctx.lineTo(Math.cos(legAngle) * r * 1.4, Math.sin(legAngle) * r * 1.4);
        ctx.stroke();
    }

    // Body — small circle
    ctx.fillStyle = slowed ? '#88BBDD' : (e.color || '#555555');
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // 2 antennae — lines with dot tips, slight sway
    const antennaeSway = Math.sin(gameTime * 5) * 0.2;
    ctx.strokeStyle = slowed ? '#777788' : '#444444';
    ctx.lineWidth = 1;
    ctx.fillStyle = slowed ? '#999999' : '#666666';
    for (let side = -1; side <= 1; side += 2) {
        const tipX = side * r * 0.5;
        const tipY = -r * 1.0 + Math.sin(gameTime * 5 + side) * r * 0.15;
        ctx.beginPath();
        ctx.moveTo(side * r * 0.2, -r * 0.4);
        ctx.lineTo(tipX + antennaeSway * side * r, tipY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(tipX + antennaeSway * side * r, tipY, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }

    // Eyes — 2 tiny
    const angle = e.targetAngle || 0;
    const eyeOff = Math.min(r * 0.15, 2);
    const ex = Math.cos(angle) * eyeOff;
    const ey = Math.sin(angle) * eyeOff;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-r * 0.15 + ex, -r * 0.1 + ey, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.15 + ex, -r * 0.1 + ey, r * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawExploder(e) {
    const slowed = e.slowTimer > 0;
    const r = e.radius;
    const wobble = Math.sin(gameTime * 8) * r * 0.08;
    const bodyR = r * 0.85 + wobble;

    ctx.save();
    ctx.translate(e.x, e.y);

    // Main body — wobbling circle
    ctx.fillStyle = slowed ? '#88BBDD' : (e.color || '#FF3333');
    ctx.beginPath();
    ctx.arc(0, 0, bodyR, 0, Math.PI * 2);
    ctx.fill();

    // Inner glow — smaller circle, bright yellow, pulsing alpha
    const glowAlpha = 0.4 + Math.sin(gameTime * 10) * 0.3;
    ctx.save();
    ctx.globalAlpha = glowAlpha;
    ctx.fillStyle = '#FFDD00';
    ctx.beginPath();
    ctx.arc(0, 0, bodyR * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Crack lines — 4 strokes from center outward at seeded angles
    const seed = ((e.x * 73 + e.y * 137) | 0) & 0xFFFF;
    ctx.strokeStyle = slowed ? '#997755' : '#880000';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
        const crackAngle = ((seed + i * 4007) % 628) / 100;
        const crackLen = bodyR * (0.6 + ((seed + i * 1013) % 40) / 100);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(crackAngle) * crackLen, Math.sin(crackAngle) * crackLen);
        ctx.stroke();
    }

    // Eyes — red, like Bat
    const angle = e.targetAngle || 0;
    const eyeOff = Math.min(r * 0.2, 3);
    const ex = Math.cos(angle) * eyeOff;
    const ey = Math.sin(angle) * eyeOff;
    ctx.fillStyle = '#FF2222';
    ctx.beginPath();
    ctx.arc(-r * 0.2 + ex, -r * 0.15 + ey, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.2 + ex, -r * 0.15 + ey, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// --- Helper: darken a hex color by a factor (for boss phase shift) ---
function darkenHex(hex, factor) {
    const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
    const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
    const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getBossDarkFactor(e) {
    const hpRatio = e.health / e.maxHealth;
    return hpRatio < 0.25 ? 0.6 : hpRatio < 0.5 ? 0.8 : 1.0;
}

// --- Boss: Flesh Colossus ---
// Massive round body + 4 dangling tentacle appendages (bezier sway) + single glowing eye
function drawFleshColossus(e) {
    const slowed = e.slowTimer > 0;
    const r = e.radius;
    const walkPhase = gameTime * (e.speed || 22) * 0.06;
    const bodyBob = Math.sin(walkPhase * 1.33) * 2;
    const facingLeft = e.targetAngle !== undefined && Math.cos(e.targetAngle) < 0;
    const df = getBossDarkFactor(e);
    const baseColor = slowed ? '#88BBDD' : darkenHex(e.color || '#CC6633', df);

    ctx.save();
    ctx.translate(e.x, e.y);
    if (facingLeft) ctx.scale(-1, 1);

    // 4 tentacles — bezier curves with sway
    ctx.strokeStyle = slowed ? '#778899' : darkenHex('#AA5522', df);
    ctx.lineWidth = r * 0.18;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
        const sway = Math.sin(walkPhase * 1.5 + i * 1.7) * r * 0.4;
        const sx = Math.cos(a) * r * 0.6, sy = Math.sin(a) * r * 0.6 + bodyBob;
        const tx = Math.cos(a) * r * 1.8 + sway, ty = Math.sin(a) * r * 1.8 + bodyBob;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + tx) * 0.5 + Math.sin(walkPhase + i) * r * 0.5,
            (sy + ty) * 0.5 + Math.cos(walkPhase + i * 0.8) * r * 0.3, tx, ty);
        ctx.stroke();
    }

    // Main body
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(0, bodyBob, r, 0, Math.PI * 2);
    ctx.fill();
    // Belly patch
    ctx.fillStyle = slowed ? '#667788' : darkenHex('#993D1A', df);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.2 + bodyBob, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Vein lines
    ctx.strokeStyle = slowed ? '#7799AA' : darkenHex('#DD7744', df);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
        const a = -0.6 + i * 0.6;
        ctx.beginPath(); ctx.arc(0, bodyBob, r * 0.75, a - 0.3, a + 0.3); ctx.stroke();
    }

    // Single glowing eye
    const eyeDir = facingLeft ? Math.PI - (e.targetAngle || 0) : (e.targetAngle || 0);
    const ex = Math.cos(eyeDir) * r * 0.15, ey = Math.sin(eyeDir) * r * 0.15;
    const eyeY = -r * 0.15 + bodyBob;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = slowed ? '#88AACC' : '#FFCC00';
    ctx.beginPath(); ctx.arc(ex, eyeY + ey, r * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#FFFFCC';
    ctx.beginPath(); ctx.arc(ex, eyeY + ey, r * 0.22, 0, Math.PI * 2); ctx.fill();
    // Vertical slit pupil
    ctx.fillStyle = '#220000';
    ctx.beginPath();
    ctx.ellipse(ex * 1.3, eyeY + ey * 1.3, r * 0.05, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// --- Boss: Hive Queen ---
// Segmented insect body (3 overlapping ellipses) + translucent wing pair + crown of antennae
function drawHiveQueen(e) {
    const slowed = e.slowTimer > 0;
    const r = e.radius;
    const walkPhase = gameTime * (e.speed || 35) * 0.1;
    const bodyBob = Math.sin(walkPhase * 1.2) * 1.5;
    const facingLeft = e.targetAngle !== undefined && Math.cos(e.targetAngle) < 0;
    const df = getBossDarkFactor(e);
    const baseColor = slowed ? '#88BBDD' : darkenHex(e.color || '#8844AA', df);

    ctx.save();
    ctx.translate(e.x, e.y);
    if (facingLeft) ctx.scale(-1, 1);

    // Translucent wings behind body
    const wingFlutter = Math.sin(gameTime * 12) * 0.25;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = slowed ? '#AACCDD' : darkenHex('#BB77DD', df);
    for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.translate(side * r * 0.3, -r * 0.3 + bodyBob);
        ctx.rotate(side * (0.4 + wingFlutter));
        ctx.beginPath();
        ctx.ellipse(side * r * 0.4, -r * 0.2, r * 0.7, r * 0.3, side * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.globalAlpha = 1.0;

    // Abdomen (rear, largest)
    ctx.fillStyle = slowed ? '#7799BB' : darkenHex('#6B3388', df);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.5 + bodyBob, r * 0.9, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    // Abdomen stripes
    ctx.strokeStyle = slowed ? '#556677' : darkenHex('#552266', df);
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(0, r * (0.4 + i * 0.15) + bodyBob, r * 0.7, r * 0.08, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    // Thorax + Head
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.ellipse(0, -r * 0.05 + bodyBob, r * 0.7, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -r * 0.55 + bodyBob, r * 0.45, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();

    // Crown of 5 antennae
    ctx.strokeStyle = slowed ? '#99AACC' : darkenHex('#AA66CC', df);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
        const spread = (i - 2) * 0.35, sway = Math.sin(walkPhase * 1.2 + i * 1.3) * r * 0.15;
        const bY = -r * 0.85 + bodyBob;
        ctx.beginPath();
        ctx.moveTo(spread * r * 0.3, bY);
        ctx.quadraticCurveTo(spread * r * 0.8 + sway, bY - r * 0.5, spread * r * 1.1 + sway, bY - r * 0.8);
        ctx.stroke();
    }

    // Compound eyes
    const eyeDir = facingLeft ? Math.PI - (e.targetAngle || 0) : (e.targetAngle || 0);
    const eOff = Math.min(r * 0.15, 3);
    const ex = Math.cos(eyeDir) * eOff, ey = Math.sin(eyeDir) * eOff;
    ctx.fillStyle = slowed ? '#AACCDD' : '#FF44FF';
    for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.ellipse(s * r * 0.2 + ex, -r * 0.55 + ey + bodyBob, r * 0.13, r * 0.17, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = '#000';
    for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath(); ctx.arc(s * r * 0.2 + ex * 1.3, -r * 0.55 + ey * 1.3 + bodyBob, r * 0.05, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
}

// --- Boss: Infernal Knight ---
// Angular armored body (rects + triangles) + flaming sword arm + visor slit eyes
function drawInfernalKnight(e) {
    const slowed = e.slowTimer > 0;
    const r = e.radius;
    const walkPhase = gameTime * (e.speed || 60) * 0.1;
    const bodyBob = Math.sin(walkPhase) * 1.5;
    const facingLeft = e.targetAngle !== undefined && Math.cos(e.targetAngle) < 0;
    const df = getBossDarkFactor(e);
    const baseColor = slowed ? '#88BBDD' : darkenHex(e.color || '#FF4400', df);
    const armorColor = slowed ? '#667788' : darkenHex('#882200', df);

    ctx.save();
    ctx.translate(e.x, e.y);
    if (facingLeft) ctx.scale(-1, 1);

    // Armored legs
    ctx.fillStyle = armorColor;
    for (let s = -1; s <= 1; s += 2) {
        const off = Math.sin(walkPhase + s * Math.PI * 0.5) * 3;
        ctx.fillRect(s * r * 0.35 - r * 0.12 + off, r * 0.3 + bodyBob, r * 0.24, r * 0.8);
    }

    // Sword arm (right)
    ctx.save();
    ctx.translate(r * 0.7, -r * 0.1 + bodyBob);
    ctx.rotate(-0.3 + Math.sin(walkPhase * 0.8) * 0.2);
    ctx.fillStyle = slowed ? '#99AABB' : darkenHex('#CC6600', df);
    ctx.fillRect(-r * 0.06, -r * 1.6, r * 0.12, r * 1.3);
    // Sword tip
    ctx.fillStyle = slowed ? '#AABBCC' : darkenHex('#FF8800', df);
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 1.6); ctx.lineTo(0, -r * 2.0); ctx.lineTo(r * 0.1, -r * 1.6);
    ctx.closePath(); ctx.fill();
    // Flame particles on sword
    if (!slowed) {
        ctx.globalAlpha = 0.7;
        const flameColors = ['#FFDD00', '#FF8800', '#FF4400'];
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = flameColors[i];
            ctx.beginPath();
            ctx.arc(Math.sin(gameTime * 8 + i * 3.3) * r * 0.1,
                -r * (0.6 + i * 0.4) + Math.sin(gameTime * 10 + i * 2.1) * r * 0.15,
                r * (0.06 + Math.sin(gameTime * 12 + i) * 0.03), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }
    ctx.fillStyle = slowed ? '#778899' : '#554433';
    ctx.fillRect(-r * 0.15, -r * 0.3, r * 0.3, r * 0.08);
    ctx.restore();

    // Shield arm (left)
    ctx.save();
    ctx.translate(-r * 0.75, -r * 0.05 + bodyBob);
    ctx.rotate(0.15);
    ctx.fillStyle = armorColor;
    ctx.fillRect(-r * 0.2, -r * 0.35, r * 0.4, r * 0.7);
    ctx.fillStyle = slowed ? '#99AABB' : darkenHex('#FF6622', df);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.2); ctx.lineTo(-r * 0.1, r * 0.1); ctx.lineTo(r * 0.1, r * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Armored torso
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.roundRect(-r * 0.6, -r * 0.65 + bodyBob, r * 1.2, r * 1.1, r * 0.15); ctx.fill();
    ctx.fillStyle = slowed ? '#889999' : darkenHex('#AA4411', df);
    ctx.fillRect(-r * 0.4, -r * 0.5 + bodyBob, r * 0.8, r * 0.7);

    // Helmet
    ctx.fillStyle = armorColor;
    ctx.fillRect(-r * 0.4, -r * 1.0 + bodyBob, r * 0.8, r * 0.45);
    ctx.fillStyle = slowed ? '#778899' : darkenHex('#CC3300', df);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.35 + bodyBob); ctx.lineTo(-r * 0.15, -r * 1.0 + bodyBob); ctx.lineTo(r * 0.15, -r * 1.0 + bodyBob);
    ctx.closePath(); ctx.fill();

    // Visor slit eyes
    const exx = Math.cos(facingLeft ? Math.PI - (e.targetAngle || 0) : (e.targetAngle || 0)) * Math.min(r * 0.1, 2);
    ctx.fillStyle = slowed ? '#88AACC' : '#FF2200';
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-r * 0.3 + exx, -r * 0.82 + bodyBob, r * 0.6, r * 0.07);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = slowed ? '#AACCEE' : '#FFAA00';
    ctx.fillRect(-r * 0.15 + exx, -r * 0.83 + bodyBob, r * 0.3, r * 0.09);

    ctx.restore();
}

// --- Boss: Elder Spitter ---
// Large pear body (like Spitter but 3x) + 3 mouth openings + pustule bumps
function drawElderSpitter(e) {
    const slowed = e.slowTimer > 0;
    const r = e.radius;
    const walkPhase = gameTime * (e.speed || 28) * 0.08;
    const bodyBob = Math.sin(walkPhase * 1.25) * 2;
    const facingLeft = e.targetAngle !== undefined && Math.cos(e.targetAngle) < 0;
    const df = getBossDarkFactor(e);
    const baseColor = slowed ? '#88BBDD' : darkenHex(e.color || '#66AA22', df);

    ctx.save();
    ctx.translate(e.x, e.y);
    if (facingLeft) ctx.scale(-1, 1);

    // Stumpy legs
    ctx.fillStyle = slowed ? '#668877' : darkenHex('#447711', df);
    for (let s = -1; s <= 1; s += 2) {
        const off = Math.sin(walkPhase + s * Math.PI * 0.5) * 2;
        ctx.beginPath(); ctx.arc(s * r * 0.4 + off, r * 0.75 + bodyBob, r * 0.25, 0, Math.PI * 2); ctx.fill();
    }

    // Pear body — big belly + smaller head
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.arc(0, r * 0.15 + bodyBob, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = slowed ? '#99CCBB' : darkenHex('#77BB33', df);
    ctx.beginPath(); ctx.arc(0, -r * 0.55 + bodyBob, r * 0.55, 0, Math.PI * 2); ctx.fill();

    // Pustule bumps — 6 pulsing circles on body surface
    ctx.fillStyle = slowed ? '#AACCBB' : darkenHex('#99CC44', df);
    const pust = [[0.6,0],[-0.55,0.15],[0.3,0.55],[-0.4,0.5],[0.7,0.35],[-0.65,-0.1]];
    for (let i = 0; i < 6; i++) {
        const pulse = 1 + Math.sin(gameTime * 4 + i * 1.5) * 0.15;
        ctx.beginPath();
        ctx.arc(pust[i][0] * r, pust[i][1] * r + bodyBob, r * 0.1 * pulse, 0, Math.PI * 2);
        ctx.fill();
    }

    // 3 mouths with glowing projectile dots
    const mouthColor = slowed ? '#556655' : darkenHex('#335511', df);
    const mouths = [[0.3,-0.35],[-0.25,-0.2],[0.05,-0.55]];
    for (let i = 0; i < 3; i++) {
        const mx = mouths[i][0] * r, my = mouths[i][1] * r + bodyBob;
        ctx.fillStyle = mouthColor;
        ctx.beginPath(); ctx.arc(mx, my, r * 0.14, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.5 + Math.sin(gameTime * 6 + i * 2.1) * 0.3;
        ctx.fillStyle = slowed ? '#88AAAA' : '#44FF00';
        ctx.beginPath(); ctx.arc(mx, my, r * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Beady eyes
    const eyeDir = facingLeft ? Math.PI - (e.targetAngle || 0) : (e.targetAngle || 0);
    const eOff = Math.min(r * 0.15, 3);
    const ex = Math.cos(eyeDir) * eOff, ey = Math.sin(eyeDir) * eOff;
    ctx.fillStyle = '#FFFF88';
    for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath(); ctx.arc(s * r * 0.18 + ex, -r * 0.65 + ey + bodyBob, r * 0.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#000';
    for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath(); ctx.arc(s * r * 0.18 + ex * 1.3, -r * 0.65 + ey * 1.3 + bodyBob, r * 0.05, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
}

var enemyDrawFns = {
    shambler: drawShambler,
    runner: drawRunner,
    bat: drawBat,
    brute: drawBrute,
    spitter: drawSpitter,
    swarmer: drawSwarmer,
    exploder: drawExploder,
    flesh_colossus: drawFleshColossus,
    hive_queen: drawHiveQueen,
    infernal_knight: drawInfernalKnight,
    elder_spitter: drawElderSpitter,
};

function drawEnemyBody(e) {
    if (enemyDrawFns[e.type]) {
        enemyDrawFns[e.type](e);
    } else {
        drawEnemyCircleFallback(e);
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
