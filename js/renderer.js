import { CANVAS_WIDTH, CANVAS_HEIGHT, COLOR_PLAYER, COLOR_PLAYER_DARK, COLOR_BULLET, DEATH_ANIM_DURATION, DEATH_ANIM_EXPAND_PHASE } from './constants.js';
import { applyCamera, isInView } from './camera.js';
import { getMouse } from './input.js';
import { drawBackground, drawAmbientParticles } from './background.js';
import { BIOMES } from './biomes.js';
import { drawCircle, drawBar, drawGlow } from './drawLib.js';
import { v2FromAngle, randomRange } from './utils.js';
import { renderEffects, renderScreenEffects, renderGroundScars, getShakeOffset, spawnParticle } from './effects.js';
import { getCooldowns, getLastSweepState } from './weapons.js';
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

    // Ground scars (032) — fading blast marks drawn in background layer
    renderGroundScars(ctx);

    // Zone projectiles (draw under everything)
    if (projectiles) {
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (!p || !p.active) continue;
            if (p.type === 'zone' || p.type === 'firezone' || p.type === 'plaguezone' || p.type === 'frostdot' || p.type === 'holywaterzone') {
                if (!isInView(camera, p.x, p.y, p.radius + 20)) continue;
                if (p.type === 'firezone') {
                    drawFireZone(p);
                } else if (p.type === 'plaguezone') {
                    drawPlagueZone(p);
                } else if (p.type === 'frostdot') {
                    drawFrostDotZone(p);
                } else if (p.type === 'holywaterzone') {
                    drawHolyWaterZone(p);
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
            if (p.type === 'zone' || p.type === 'firezone' || p.type === 'plaguezone' || p.type === 'frostdot' || p.type === 'holywaterzone') continue; // Already drawn
            if (!isInView(camera, p.x, p.y, Math.max(p.radius, 20) + 10)) continue;
            drawProjectileTrail(p);
            drawProjectile(p);
        }
    }

    // Whip sweep visual (040)
    const sweep = getLastSweepState();
    if (sweep) {
        drawSweepArc(sweep);
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

// Map evolution IDs back to base weapon family for visuals
const EVOLUTION_TO_BASE = {};
for (const [id, def] of Object.entries(WEAPONS)) {
    if (def.evolutionId) EVOLUTION_TO_BASE[def.evolutionId] = id;
}

// --- Weapon type classification for arm poses ---
function getWeaponClass(weaponId) {
    const resolved = EVOLUTION_TO_BASE[weaponId] || weaponId;
    switch (resolved) {
        case 'pistol': case 'smg': case 'shotgun': return 'rifle';
        case 'rocket': case 'flamethrower': return 'heavy';
        case 'lightning': case 'frostnova': return 'magic';
        case 'whip': return 'melee';
        case 'boomerang': case 'holywater': case 'poison': return 'thrown';
        case 'orbitals': return 'magic';
        case 'sawblade': return 'heavy';
        default: return 'rifle';
    }
}

// --- Get primary weapon color for visor tint ---
function getWeaponColor(weaponId) {
    if (!weaponId) return '#44FF88';
    const stats = getWeaponStats(weaponId, 1);
    return (stats && stats.color) ? stats.color : '#44FF88';
}

// --- Recoil state tracking ---
let recoilTimer = 0;
let lastCooldownSnapshot = [];

function getRecoilAmount() {
    const cooldowns = getCooldowns();
    // Detect weapon fire: cooldown jumped from <=0 to >0
    for (let i = 0; i < cooldowns.length; i++) {
        if (cooldowns[i] > 0 && (lastCooldownSnapshot[i] === undefined || lastCooldownSnapshot[i] <= 0)) {
            recoilTimer = 0.05; // 50ms recoil
        }
        lastCooldownSnapshot[i] = cooldowns[i];
    }
    if (recoilTimer > 0) {
        recoilTimer -= 1 / 60;
        return Math.max(0, recoilTimer / 0.05) * 3; // 0-3px kickback
    }
    return 0;
}

// --- Walk cycle state ---
let walkPhase = 0;

// --- Weapon-specific gun arm visuals (COMPLETE REWRITE) ---
function drawPlayerWeapon(weaponId, recoil) {
    const resolvedId = EVOLUTION_TO_BASE[weaponId] || weaponId;
    const rb = recoil || 0; // recoil kickback in px

    // Upper arm segment (darker, connects to shoulder)
    ctx.fillStyle = '#2A3A5A';
    ctx.beginPath();
    ctx.moveTo(2, -3.5);
    ctx.lineTo(10, -3);
    ctx.lineTo(10, 3);
    ctx.lineTo(2, 3.5);
    ctx.closePath();
    ctx.fill();

    // Elbow joint
    ctx.fillStyle = '#3A4A6A';
    ctx.beginPath();
    ctx.arc(10, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // Forearm segment (lighter, slightly thinner)
    ctx.fillStyle = '#3366AA';
    ctx.beginPath();
    ctx.moveTo(10, -2.5);
    ctx.lineTo(18 - rb, -2.5);
    ctx.lineTo(18 - rb, 2.5);
    ctx.lineTo(10, 2.5);
    ctx.closePath();
    ctx.fill();

    // Forearm highlight strip
    ctx.fillStyle = '#4488CC';
    ctx.fillRect(12, -2.5, 4, 1.2);

    switch (resolvedId) {
        case 'pistol': {
            // Compact sidearm with slide and trigger
            ctx.fillStyle = '#6A6A7A';
            ctx.fillRect(18 - rb, -3.5, 12, 7); // receiver
            ctx.fillStyle = '#555566';
            ctx.fillRect(28 - rb, -2, 5, 4); // barrel
            // Slide top
            ctx.fillStyle = '#7A7A8A';
            ctx.fillRect(18 - rb, -3.5, 12, 2);
            // Slide serrations
            ctx.strokeStyle = '#555566';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(20 + i * 2.5 - rb, -3.5);
                ctx.lineTo(20 + i * 2.5 - rb, -1.5);
                ctx.stroke();
            }
            // Trigger guard
            ctx.strokeStyle = '#555566';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(22 - rb, 5, 3, -0.3, Math.PI + 0.3);
            ctx.stroke();
            // Trigger
            ctx.fillStyle = '#444455';
            ctx.fillRect(22 - rb, 3.5, 1.5, 2.5);
            // Front sight
            ctx.fillStyle = '#AAAABB';
            ctx.fillRect(31 - rb, -4.5, 1.5, 1.5);
            // Muzzle flash hint when recoiling
            if (rb > 1) {
                ctx.globalAlpha = rb / 3;
                ctx.fillStyle = '#FFDD44';
                ctx.beginPath();
                ctx.arc(33 - rb, 0, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            break;
        }

        case 'shotgun': {
            // Pump-action shotgun with wooden furniture
            ctx.fillStyle = '#7A5533'; // wooden pump grip
            ctx.fillRect(16 - rb, -4, 7, 8);
            // Wooden grip detail
            ctx.strokeStyle = '#5A3A1A';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(17 - rb, -3); ctx.lineTo(17 - rb, 3);
            ctx.moveTo(19 - rb, -3); ctx.lineTo(19 - rb, 3);
            ctx.stroke();
            // Receiver
            ctx.fillStyle = '#7A7A8A';
            ctx.fillRect(22 - rb, -5, 14, 10);
            // Barrel (wide bore)
            ctx.fillStyle = '#555566';
            ctx.fillRect(34 - rb, -4, 4, 8);
            // Barrel bore (dark hole)
            ctx.fillStyle = '#222233';
            ctx.beginPath();
            ctx.arc(38 - rb, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            // Top rail + bead sight
            ctx.fillStyle = '#9A9AAA';
            ctx.fillRect(22 - rb, -5.5, 14, 1.5);
            ctx.fillStyle = '#FF4422';
            ctx.beginPath();
            ctx.arc(37 - rb, -5, 1.2, 0, Math.PI * 2);
            ctx.fill();
            // Shell ejection port
            ctx.fillStyle = '#444455';
            ctx.fillRect(26 - rb, -5, 4, 2);
            break;
        }

        case 'smg': {
            // Compact submachine gun with foregrip and extended mag
            ctx.fillStyle = '#6A6A7A';
            ctx.fillRect(18 - rb, -4, 14, 8); // receiver body
            ctx.fillStyle = '#555566';
            ctx.fillRect(30 - rb, -2.5, 7, 5); // barrel + suppressor
            // Barrel tip
            ctx.fillStyle = '#444455';
            ctx.fillRect(35 - rb, -2, 3, 4);
            // Extended magazine
            ctx.fillStyle = '#4A4A5A';
            ctx.beginPath();
            ctx.moveTo(22 - rb, 4);
            ctx.lineTo(20 - rb, 14);
            ctx.lineTo(26 - rb, 14);
            ctx.lineTo(24 - rb, 4);
            ctx.closePath();
            ctx.fill();
            // Mag base plate
            ctx.fillStyle = '#333344';
            ctx.fillRect(19.5 - rb, 13, 7, 2);
            // Top rail
            ctx.fillStyle = '#8A8A9A';
            ctx.fillRect(19 - rb, -4.5, 10, 1.5);
            // Red dot sight
            ctx.fillStyle = '#333344';
            ctx.fillRect(22 - rb, -6.5, 4, 2.5);
            ctx.fillStyle = '#FF2222';
            ctx.beginPath();
            ctx.arc(24 - rb, -5.5, 0.8, 0, Math.PI * 2);
            ctx.fill();
            // Foregrip
            ctx.fillStyle = '#5A5A6A';
            ctx.fillRect(28 - rb, 4, 3, 4);
            break;
        }

        case 'rocket': {
            // Shoulder-mounted rocket tube
            ctx.fillStyle = '#4A5A4A';
            ctx.fillRect(14 - rb, -7, 22, 14); // thick tube body
            // Tube bore (dark)
            ctx.fillStyle = '#2A2A2A';
            ctx.beginPath();
            ctx.arc(36 - rb, 0, 5.5, 0, Math.PI * 2);
            ctx.fill();
            // Tube opening ring
            ctx.strokeStyle = '#5A6A5A';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(36 - rb, 0, 6.5, 0, Math.PI * 2);
            ctx.stroke();
            // Rear exhaust vent
            ctx.fillStyle = '#3A3A3A';
            ctx.fillRect(12 - rb, -5, 3, 10);
            // Grip underneath
            ctx.fillStyle = '#7A5533';
            ctx.fillRect(20 - rb, 7, 5, 6);
            // Iron sight on top
            ctx.fillStyle = '#8A8A9A';
            ctx.fillRect(24 - rb, -9, 2, 3);
            ctx.fillRect(32 - rb, -9, 2, 3);
            // Warhead peeking out (if not recoiling)
            if (rb < 1) {
                ctx.fillStyle = '#AA4422';
                ctx.beginPath();
                ctx.arc(37, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#CC5533';
                ctx.beginPath();
                ctx.moveTo(37, -3);
                ctx.lineTo(41, 0);
                ctx.lineTo(37, 3);
                ctx.closePath();
                ctx.fill();
            }
            break;
        }

        case 'lightning': {
            // Arcane focus orb with crackling energy
            const pulse = Math.sin(gameTime * 6);
            const pulse2 = Math.sin(gameTime * 8 + 1);
            // Staff/wand
            ctx.fillStyle = '#5A4A6A';
            ctx.fillRect(16 - rb, -1.5, 8, 3);
            // Outer glow
            ctx.globalAlpha = 0.2 + pulse * 0.1;
            ctx.fillStyle = '#88CCFF';
            ctx.beginPath();
            ctx.arc(28 - rb, 0, 12, 0, Math.PI * 2);
            ctx.fill();
            // Inner orb glow
            ctx.globalAlpha = 0.5 + pulse2 * 0.2;
            ctx.fillStyle = '#AADDFF';
            ctx.beginPath();
            ctx.arc(28 - rb, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            // Core
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(28 - rb, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            // Mini lightning arcs (2 random arcs around orb)
            ctx.strokeStyle = '#AADDFF';
            ctx.lineWidth = 1;
            for (let i = 0; i < 2; i++) {
                const a = gameTime * 5 + i * 3.14;
                const sx = 28 - rb + Math.cos(a) * 6;
                const sy = Math.sin(a) * 6;
                const ex = 28 - rb + Math.cos(a + 1) * 10;
                const ey = Math.sin(a + 1) * 10;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                const mx = (sx + ex) / 2 + (Math.sin(gameTime * 20 + i) * 3);
                const my = (sy + ey) / 2 + (Math.cos(gameTime * 20 + i) * 3);
                ctx.quadraticCurveTo(mx, my, ex, ey);
                ctx.stroke();
            }
            // Channeling particles from hand
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#88CCFF';
            const pAngle = gameTime * 12;
            ctx.beginPath();
            ctx.arc(22 - rb + Math.cos(pAngle) * 2, Math.sin(pAngle) * 2, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            break;
        }

        case 'flamethrower': {
            // Fuel-fed flamethrower with nozzle and pilot light
            ctx.fillStyle = '#6A6A7A';
            ctx.fillRect(16 - rb, -3.5, 12, 7); // body
            // Fuel line along top
            ctx.strokeStyle = '#CC4422';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(10, -3);
            ctx.lineTo(28 - rb, -3);
            ctx.stroke();
            // Flared nozzle
            ctx.fillStyle = '#AA5522';
            ctx.beginPath();
            ctx.moveTo(28 - rb, -4);
            ctx.lineTo(36 - rb, -7);
            ctx.lineTo(36 - rb, 7);
            ctx.lineTo(28 - rb, 4);
            ctx.closePath();
            ctx.fill();
            // Nozzle interior (dark)
            ctx.fillStyle = '#331100';
            ctx.beginPath();
            ctx.moveTo(34 - rb, -4);
            ctx.lineTo(36 - rb, -5);
            ctx.lineTo(36 - rb, 5);
            ctx.lineTo(34 - rb, 4);
            ctx.closePath();
            ctx.fill();
            // Pilot light (always flickering)
            ctx.globalAlpha = 0.7 + Math.sin(gameTime * 15) * 0.3;
            ctx.fillStyle = '#FF8833';
            ctx.beginPath();
            ctx.arc(36 - rb, 0, 2.5 + Math.sin(gameTime * 20) * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            // Fuel tank on back of arm
            ctx.fillStyle = '#CC4422';
            ctx.beginPath();
            ctx.ellipse(8, 5, 5, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#993311';
            ctx.lineWidth = 0.7;
            ctx.stroke();
            // Tank stripe
            ctx.fillStyle = '#FFCC22';
            ctx.fillRect(5, 4, 6, 1.2);
            break;
        }

        case 'boomerang': {
            // Hand with held boomerang weapon
            // Fist
            ctx.fillStyle = '#3366AA';
            ctx.beginPath();
            ctx.arc(18 - rb, 0, 3.5, 0, Math.PI * 2);
            ctx.fill();
            // Knuckle detail
            ctx.fillStyle = '#2A5599';
            ctx.beginPath();
            ctx.arc(20 - rb, -1.5, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(20 - rb, 1.5, 1.5, 0, Math.PI * 2);
            ctx.fill();
            // Boomerang shape (angular V)
            ctx.strokeStyle = '#44DDAA';
            ctx.lineWidth = 3.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(14 - rb, -8);
            ctx.quadraticCurveTo(24 - rb, -2, 30 - rb, -6);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(14 - rb, 8);
            ctx.quadraticCurveTo(24 - rb, 2, 30 - rb, 6);
            ctx.stroke();
            // Highlight edges
            ctx.strokeStyle = '#66FFCC';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(14 - rb, -8);
            ctx.quadraticCurveTo(24 - rb, -2, 30 - rb, -6);
            ctx.stroke();
            ctx.lineCap = 'butt';
            break;
        }

        case 'orbitals': {
            // Open channeling palm with energy swirl
            // Extended palm
            ctx.fillStyle = '#3366AA';
            ctx.beginPath();
            ctx.arc(18 - rb, 0, 4.5, 0, Math.PI * 2);
            ctx.fill();
            // Fingers spread
            ctx.strokeStyle = '#2A5599';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            for (let i = -2; i <= 2; i++) {
                const fAngle = i * 0.3;
                ctx.beginPath();
                ctx.moveTo(21 - rb, i * 2);
                ctx.lineTo(26 + Math.cos(fAngle) * 2 - rb, i * 3.2);
                ctx.stroke();
            }
            ctx.lineCap = 'butt';
            // Energy swirl at palm
            ctx.globalAlpha = 0.4;
            const swirlAngle = gameTime * 5;
            for (let i = 0; i < 3; i++) {
                const a = swirlAngle + i * (Math.PI * 2 / 3);
                ctx.fillStyle = i === 0 ? '#66AAFF' : (i === 1 ? '#88CCFF' : '#AADDFF');
                ctx.beginPath();
                ctx.arc(18 - rb + Math.cos(a) * 4, Math.sin(a) * 4, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            // Central glow
            ctx.fillStyle = '#66AAFF';
            ctx.beginPath();
            ctx.arc(18 - rb, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            break;
        }

        case 'poison': {
            // Alchemical flask with bubbling liquid
            // Flask body (round bottom)
            ctx.fillStyle = '#448833';
            ctx.beginPath();
            ctx.arc(24 - rb, 2, 5.5, 0, Math.PI * 2);
            ctx.fill();
            // Flask neck
            ctx.fillStyle = '#336622';
            ctx.fillRect(22 - rb, -6, 4, 7);
            // Cork
            ctx.fillStyle = '#8B6914';
            ctx.fillRect(21.5 - rb, -8, 5, 2.5);
            // Cork grain
            ctx.strokeStyle = '#6A4A0A';
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.moveTo(22 - rb, -7.5); ctx.lineTo(26 - rb, -6.5);
            ctx.stroke();
            // Liquid shimmer (animated)
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#88FF44';
            const liquidY = 3 + Math.sin(gameTime * 4) * 0.8;
            ctx.beginPath();
            ctx.arc(24 - rb, liquidY, 3.5, 0.2, Math.PI - 0.2);
            ctx.fill();
            // Bubbles
            const b1y = 1 - (gameTime * 20 % 6);
            const b2y = 3 - (gameTime * 15 % 5);
            ctx.fillStyle = '#AAFFAA';
            ctx.beginPath();
            ctx.arc(23 - rb, b1y, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(25 - rb, b2y, 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            // Skull label on flask
            ctx.fillStyle = '#112211';
            ctx.beginPath();
            ctx.arc(24 - rb, 2, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#88FF44';
            ctx.fillRect(23.2 - rb, 0.8, 0.6, 0.6);
            ctx.fillRect(24.2 - rb, 0.8, 0.6, 0.6);
            break;
        }

        case 'frostnova': {
            // Crystal-tipped frost staff
            // Staff shaft (wooden)
            ctx.fillStyle = '#7A5533';
            ctx.fillRect(16 - rb, -1.5, 12, 3);
            // Shaft grain
            ctx.strokeStyle = '#5A3A1A';
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.moveTo(17 - rb, -0.5); ctx.lineTo(27 - rb, -0.5);
            ctx.moveTo(17 - rb, 0.5); ctx.lineTo(27 - rb, 0.5);
            ctx.stroke();
            // Crystal mount (metal cap)
            ctx.fillStyle = '#6A7A8A';
            ctx.fillRect(27 - rb, -2.5, 2, 5);
            // Diamond crystal tip
            ctx.fillStyle = '#AADDFF';
            ctx.beginPath();
            ctx.moveTo(33 - rb, 0);
            ctx.lineTo(29 - rb, -6);
            ctx.lineTo(25 - rb, 0);
            ctx.lineTo(29 - rb, 6);
            ctx.closePath();
            ctx.fill();
            // Crystal inner facet
            ctx.fillStyle = '#CCEEFF';
            ctx.beginPath();
            ctx.moveTo(31 - rb, -1);
            ctx.lineTo(29 - rb, -4);
            ctx.lineTo(27 - rb, -1);
            ctx.closePath();
            ctx.fill();
            // Crystal shine
            ctx.fillStyle = '#FFFFFF';
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(30 - rb, -2);
            ctx.lineTo(29 - rb, -3.5);
            ctx.lineTo(28 - rb, -2);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1.0;
            // Frost glow aura
            ctx.globalAlpha = 0.2 + Math.sin(gameTime * 4) * 0.1;
            ctx.fillStyle = '#88CCFF';
            ctx.beginPath();
            ctx.arc(29 - rb, 0, 9, 0, Math.PI * 2);
            ctx.fill();
            // Frost particle
            ctx.fillStyle = '#DDEEFF';
            const fpAngle = gameTime * 3;
            ctx.beginPath();
            ctx.arc(29 - rb + Math.cos(fpAngle) * 7, Math.sin(fpAngle) * 7, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            break;
        }

        case 'whip': {
            // Leather whip with coiled length
            // Handle (leather wrapped)
            ctx.fillStyle = '#7A5533';
            ctx.fillRect(16 - rb, -2.5, 7, 5);
            // Handle pommel
            ctx.fillStyle = '#5A3A1A';
            ctx.beginPath();
            ctx.arc(16 - rb, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Handle wrapping detail
            ctx.strokeStyle = '#5A3A1A';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(18 + i * 2 - rb, -2.5);
                ctx.lineTo(18 + i * 2 - rb, 2.5);
                ctx.stroke();
            }
            // Whip coil (curved line, idle position)
            ctx.strokeStyle = '#CC88FF';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(22 - rb, 0);
            ctx.bezierCurveTo(28 - rb, -8, 26 - rb, 6, 32 - rb, -2);
            ctx.bezierCurveTo(34 - rb, -6, 30 - rb, 8, 36 - rb, 2);
            ctx.stroke();
            // Whip tip
            ctx.strokeStyle = '#AA66DD';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(36 - rb, 2);
            ctx.lineTo(39 - rb, 0);
            ctx.stroke();
            ctx.lineCap = 'butt';
            break;
        }

        case 'holywater': {
            // Holy water vial with glowing cross
            // Vial body
            ctx.fillStyle = '#2266AA';
            ctx.beginPath();
            ctx.arc(24 - rb, 2, 5.5, 0, Math.PI * 2);
            ctx.fill();
            // Vial neck
            ctx.fillStyle = '#1155AA';
            ctx.fillRect(22 - rb, -6, 4, 7);
            // Cork
            ctx.fillStyle = '#8B6914';
            ctx.fillRect(21.5 - rb, -8, 5, 2.5);
            // Holy glow
            ctx.globalAlpha = 0.3 + Math.sin(gameTime * 3) * 0.1;
            ctx.fillStyle = '#88DDFF';
            ctx.beginPath();
            ctx.arc(24 - rb, 2, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            // Cross on flask (brighter)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(23 - rb, -0.5, 2, 5);
            ctx.fillRect(22 - rb, 1, 4, 2);
            // Liquid shimmer
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = '#AAEEFF';
            ctx.beginPath();
            ctx.arc(24 - rb, 3, 3, 0.2, Math.PI - 0.2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            break;
        }

        case 'sawblade': {
            // Mechanical launcher with spinning saw
            ctx.fillStyle = '#6A6A7A';
            ctx.fillRect(16 - rb, -4.5, 12, 9); // boxy body
            // Grip section
            ctx.fillStyle = '#4A4A5A';
            ctx.fillRect(14 - rb, -3, 4, 6);
            // Grip texture
            ctx.strokeStyle = '#3A3A4A';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(15 - rb, -2 + i * 2);
                ctx.lineTo(17 - rb, -2 + i * 2);
                ctx.stroke();
            }
            // Launch rail
            ctx.fillStyle = '#555566';
            ctx.fillRect(26 - rb, -2, 6, 4);
            // Spinning saw blade at front
            const sawSpin = gameTime * 12;
            ctx.save();
            ctx.translate(34 - rb, 0);
            ctx.rotate(sawSpin);
            // Saw disc
            ctx.fillStyle = '#BBBBCC';
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            // Saw center
            ctx.fillStyle = '#888899';
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Saw teeth
            ctx.fillStyle = '#DDDDEE';
            for (let i = 0; i < 8; i++) {
                const ta = (i / 8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(Math.cos(ta) * 4.5, Math.sin(ta) * 4.5);
                ctx.lineTo(Math.cos(ta + 0.15) * 7, Math.sin(ta + 0.15) * 7);
                ctx.lineTo(Math.cos(ta + 0.3) * 5, Math.sin(ta + 0.3) * 5);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
            break;
        }

        default: {
            // Fallback generic rifle
            ctx.fillStyle = '#6A6A7A';
            ctx.fillRect(18 - rb, -4, 14, 8);
            ctx.fillStyle = '#555566';
            ctx.fillRect(30 - rb, -2.5, 8, 5);
            ctx.fillStyle = '#8A8A9A';
            ctx.fillRect(20 - rb, -4, 3, 8);
            // Magazine
            ctx.fillStyle = '#4A4A5A';
            ctx.fillRect(24 - rb, 4, 4, 6);
            break;
        }
    }
}

// --- Support arm drawing (left arm, weapon-class dependent) ---
function drawSupportArm(weaponClass, aimAngle, recoil) {
    const rb = recoil || 0;
    ctx.save();

    if (weaponClass === 'rifle' || weaponClass === 'heavy') {
        // Support arm reaches toward weapon barrel to steady it
        // Upper arm
        ctx.fillStyle = '#2A3A5A';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(8, -4);
        ctx.lineTo(10, -2);
        ctx.lineTo(2, 2);
        ctx.closePath();
        ctx.fill();
        // Elbow
        ctx.fillStyle = '#3A4A6A';
        ctx.beginPath();
        ctx.arc(9, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Forearm (reaching forward toward weapon)
        ctx.fillStyle = '#3366AA';
        ctx.beginPath();
        ctx.moveTo(9, -4.5);
        ctx.lineTo(20 - rb, -3);
        ctx.lineTo(20 - rb, 0);
        ctx.lineTo(9, -1.5);
        ctx.closePath();
        ctx.fill();
        // Forearm highlight
        ctx.fillStyle = '#4488CC';
        ctx.fillRect(11, -4.5, 4, 1);
        // Hand gripping
        ctx.fillStyle = '#3366AA';
        ctx.beginPath();
        ctx.arc(20 - rb, -1.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
    } else if (weaponClass === 'magic') {
        // Open palm channeling: arm at side, palm up
        // Upper arm
        ctx.fillStyle = '#2A3A5A';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-3, 6);
        ctx.lineTo(-1, 8);
        ctx.lineTo(2, 2);
        ctx.closePath();
        ctx.fill();
        // Elbow
        ctx.fillStyle = '#3A4A6A';
        ctx.beginPath();
        ctx.arc(-2, 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Forearm forward
        ctx.fillStyle = '#3366AA';
        ctx.beginPath();
        ctx.moveTo(-3, 6);
        ctx.lineTo(10, 3);
        ctx.lineTo(10, 6);
        ctx.lineTo(-1, 9);
        ctx.closePath();
        ctx.fill();
        // Open palm
        ctx.fillStyle = '#3366AA';
        ctx.beginPath();
        ctx.arc(11, 4.5, 3, 0, Math.PI * 2);
        ctx.fill();
        // Channeling energy particles
        ctx.globalAlpha = 0.5;
        const pa = gameTime * 8;
        ctx.fillStyle = '#88CCFF';
        ctx.beginPath();
        ctx.arc(11 + Math.cos(pa) * 3, 4.5 + Math.sin(pa) * 3, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#AADDFF';
        ctx.beginPath();
        ctx.arc(11 + Math.cos(pa + 2) * 3, 4.5 + Math.sin(pa + 2) * 3, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    } else {
        // Melee / thrown / default: arm hanging at side
        // Upper arm
        ctx.fillStyle = '#2A3A5A';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-2, 8);
        ctx.lineTo(0, 10);
        ctx.lineTo(2, 2);
        ctx.closePath();
        ctx.fill();
        // Elbow
        ctx.fillStyle = '#3A4A6A';
        ctx.beginPath();
        ctx.arc(-1, 9, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Forearm
        ctx.fillStyle = '#3366AA';
        ctx.beginPath();
        ctx.moveTo(-2, 9);
        ctx.lineTo(-3, 16);
        ctx.lineTo(0, 16);
        ctx.lineTo(1, 9);
        ctx.closePath();
        ctx.fill();
        // Fist
        ctx.fillStyle = '#3366AA';
        ctx.beginPath();
        ctx.arc(-1.5, 16, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawPlayerEntity(player) {
    const { x, y, radius, aimAngle, invincible } = player;
    const isMoving = Math.abs(player.vx) > 10 || Math.abs(player.vy) > 10;
    const moveSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    const breathe = Math.sin(gameTime * 3) * 0.5;
    const hpRatio = player.health / player.maxHealth;

    // --- Power level checks ---
    const weaponCount = player.weapons ? player.weapons.length : 0;
    const hasEvolved = player.weapons ? player.weapons.some(w => {
        return !!EVOLUTIONS[w.id];
    }) : false;
    const allMaxed = player.weapons ? player.weapons.length >= 6 && player.weapons.every(w => w.level >= 8) : false;
    const primaryWeaponId = (player.weapons && player.weapons.length > 0)
        ? player.weapons[0].id : null;
    const weaponClass = getWeaponClass(primaryWeaponId);
    const visorColor = getWeaponColor(primaryWeaponId);
    const recoil = getRecoilAmount();

    // --- Walk cycle update ---
    if (isMoving) {
        walkPhase += moveSpeed * 0.008;
    } else {
        // Subtle idle weight shift
        walkPhase += 0.3 * (1 / 60);
    }

    const moveAngle = isMoving ? Math.atan2(player.vy, player.vx) : aimAngle;
    // Body tilt in movement direction (5-10 degrees)
    const bodyTilt = isMoving ? Math.sin(moveAngle - aimAngle) * 0.12 : 0;

    // --- Damage state: low HP red particles (sparking from armor cracks) ---
    if (hpRatio < 0.40) {
        // Sparking particles (yellow for armor cracks)
        if (hpRatio < 0.20) {
            if (Math.random() < 0.5) {
                spawnParticle(
                    x + (Math.random() - 0.5) * 12,
                    y + (Math.random() - 0.5) * 12,
                    (Math.random() - 0.5) * 60,
                    -Math.random() * 40 - 20,
                    1.5 + Math.random() * 1.5,
                    Math.random() > 0.5 ? '#FFDD44' : '#FF8822',
                    0.2 + Math.random() * 0.2,
                    true
                );
            }
        }
        // Red blood particles when moving at low HP
        if (isMoving && hpRatio < 0.30) {
            const particleChance = hpRatio < 0.15 ? 0.4 : 0.15;
            if (Math.random() < particleChance) {
                spawnParticle(
                    x + (Math.random() - 0.5) * 8,
                    y + (Math.random() - 0.5) * 8,
                    -player.vx * 0.1 + (Math.random() - 0.5) * 20,
                    -player.vy * 0.1 + (Math.random() - 0.5) * 20,
                    2 + Math.random() * 2,
                    '#FF2222',
                    0.4 + Math.random() * 0.3,
                    true
                );
            }
        }
    }

    // --- Dust particles at feet when moving ---
    if (isMoving && Math.random() < 0.25) {
        spawnParticle(
            x + (Math.random() - 0.5) * 6,
            y + radius + 2 + Math.random() * 2,
            -player.vx * 0.05 + (Math.random() - 0.5) * 15,
            -Math.random() * 10,
            1.5 + Math.random() * 1.5,
            'rgba(180,160,140,0.5)',
            0.3 + Math.random() * 0.2,
            true
        );
    }

    // --- Speed lines when Move Speed passive is high ---
    if (isMoving && moveSpeed > 280) {
        for (let i = 0; i < 3; i++) {
            if (Math.random() < 0.3) {
                const offsetPerp = (Math.random() - 0.5) * 10;
                spawnParticle(
                    x - Math.cos(moveAngle) * 8 + Math.cos(moveAngle + Math.PI / 2) * offsetPerp,
                    y - Math.sin(moveAngle) * 8 + Math.sin(moveAngle + Math.PI / 2) * offsetPerp,
                    -player.vx * 0.3,
                    -player.vy * 0.3,
                    1,
                    'rgba(200,220,255,0.4)',
                    0.15 + Math.random() * 0.1,
                    true
                );
            }
        }
    }

    ctx.save();

    // --- Damage state: visor flicker at low HP ---
    if (hpRatio < 0.40 && hpRatio >= 0.20) {
        // Occasional flicker
        if (Math.floor(gameTime * 6) % 5 === 0) {
            ctx.globalAlpha = 0.7;
        }
    } else if (hpRatio < 0.20) {
        // Heavy flicker
        const flickerRate = hpRatio < 0.10 ? 14 : 8;
        if (Math.floor(gameTime * flickerRate) % 3 === 0) {
            ctx.globalAlpha = 0.45;
        }
    }

    if (invincible > 0) {
        ctx.globalAlpha = Math.floor(invincible * 10) % 2 === 0 ? 0.3 : 1.0;
    }

    // --- All weapons maxed: blazing afterimage trail ---
    if (allMaxed && isMoving) {
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x - player.vx * 0.03, y - player.vy * 0.03, radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - player.vx * 0.06, y - player.vy * 0.06, radius * 1.0, 0, Math.PI * 2);
        ctx.fill();
        // Restore alpha
        ctx.globalAlpha = 1.0;
        if (invincible > 0) ctx.globalAlpha = Math.floor(invincible * 10) % 2 === 0 ? 0.3 : 1.0;
    }

    // --- Power aura ---
    if (weaponCount >= 3) {
        const auraAlpha = weaponCount >= 5 ? 0.18 : 0.1;
        const auraSize = weaponCount >= 5 ? radius * 2.8 : radius * 2.2;
        const gradient = ctx.createRadialGradient(x, y + breathe, radius * 0.5, x, y + breathe, auraSize);
        const auraColor = allMaxed ? '255,215,0' : '100,180,255';
        gradient.addColorStop(0, 'rgba(' + auraColor + ',' + (auraAlpha + Math.sin(gameTime * 3) * 0.04) + ')');
        gradient.addColorStop(1, 'rgba(' + auraColor + ',0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y + breathe, auraSize, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Orbiting energy motes at 5+ weapons ---
    if (weaponCount >= 5) {
        const moteCount = allMaxed ? 4 : 2;
        for (let m = 0; m < moteCount; m++) {
            const mAngle = gameTime * (3 + m * 0.5) + m * (Math.PI * 2 / moteCount);
            const mDist = radius * 2 + Math.sin(gameTime * 2 + m) * 3;
            const mx = x + Math.cos(mAngle) * mDist;
            const my = y + breathe + Math.sin(mAngle) * mDist;
            const mColor = allMaxed ? '#FFD700' : '#88CCFF';
            ctx.fillStyle = mColor;
            ctx.globalAlpha = 0.6 + Math.sin(gameTime * 10 + m * 2) * 0.3;
            ctx.beginPath();
            ctx.arc(mx, my, 2, 0, Math.PI * 2);
            ctx.fill();
            // Mote glow
            ctx.globalAlpha = 0.15;
            ctx.beginPath();
            ctx.arc(mx, my, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        if (invincible > 0) ctx.globalAlpha = Math.floor(invincible * 10) % 2 === 0 ? 0.3 : 1.0;
    }

    // --- Shadow ---
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + radius + 5, radius * 1.0, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // =========================================
    // --- LEGS (proper 2-segment walk cycle) ---
    // =========================================
    const legSpread = 5;
    const strideAngle = isMoving ? 0.4 : 0.05; // walking vs idle sway
    for (let side = -1; side <= 1; side += 2) {
        const phase = walkPhase + (side === 1 ? 0 : Math.PI); // alternating stride
        const thighSwing = Math.sin(phase) * strideAngle;
        const shinDelay = Math.sin(phase - 0.5) * strideAngle * 0.7; // shin follows with delay

        // Leg origin (hip joint)
        const hipX = x + Math.cos(moveAngle + Math.PI / 2) * legSpread * side;
        const hipY = y + 4;

        // Thigh segment
        const thighLen = 7;
        const thighAngle = moveAngle + Math.PI / 2 + thighSwing; // hangs down + swing
        const kneeX = hipX + Math.cos(thighAngle) * thighLen * 0.3 + Math.cos(moveAngle) * Math.sin(phase) * 4;
        const kneeY = hipY + thighLen;

        // Thigh (wider, darker)
        ctx.strokeStyle = '#2255AA';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.stroke();

        // Knee joint
        ctx.fillStyle = '#3A4A6A';
        ctx.beginPath();
        ctx.arc(kneeX, kneeY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Shin segment
        const shinLen = 6;
        const shinAngle = thighAngle + shinDelay;
        const ankleX = kneeX + Math.cos(shinAngle) * shinLen * 0.2 + Math.cos(moveAngle) * Math.sin(phase - 0.5) * 2;
        const ankleY = kneeY + shinLen;

        // Shin (thinner)
        ctx.strokeStyle = '#2A5599';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(kneeX, kneeY);
        ctx.lineTo(ankleX, ankleY);
        ctx.stroke();
        ctx.lineCap = 'butt';

        // Boot (angular, dark)
        ctx.save();
        ctx.translate(ankleX, ankleY);
        ctx.rotate(isMoving ? moveAngle + Math.sin(phase) * 0.3 : 0);
        ctx.fillStyle = '#1A1A2E';
        // Boot shape (angular, not just a rect)
        ctx.beginPath();
        ctx.moveTo(-3.5, -2);
        ctx.lineTo(5, -2);
        ctx.lineTo(6, 0);
        ctx.lineTo(5, 3);
        ctx.lineTo(-3, 3);
        ctx.lineTo(-3.5, 0);
        ctx.closePath();
        ctx.fill();
        // Boot sole highlight
        ctx.fillStyle = '#2A2A3E';
        ctx.fillRect(-3, 2, 7.5, 1.2);
        // Boot lace/strap
        ctx.fillStyle = '#44382E';
        ctx.fillRect(-2, -1, 5, 1);
        ctx.restore();
    }

    // ==========================================
    // --- TORSO (trapezoid plate carrier)    ---
    // ==========================================
    ctx.save();
    ctx.translate(x, y + breathe);
    ctx.rotate(bodyTilt);

    const shoulderW = radius * 1.25;
    const waistW = radius * 0.8;
    const torsoH = radius * 1.1;

    // Main torso trapezoid
    const torsoColor = hpRatio < 0.15 ? '#2A4488' : '#3366AA';
    ctx.fillStyle = torsoColor;
    ctx.beginPath();
    ctx.moveTo(-shoulderW, -torsoH * 0.5);
    ctx.lineTo(shoulderW, -torsoH * 0.5);
    ctx.lineTo(waistW, torsoH * 0.5);
    ctx.lineTo(-waistW, torsoH * 0.5);
    ctx.closePath();
    ctx.fill();

    // --- Plate carrier / tactical vest ---
    // Center panel (darker)
    ctx.fillStyle = '#2255AA';
    ctx.beginPath();
    ctx.moveTo(-7, -torsoH * 0.45);
    ctx.lineTo(7, -torsoH * 0.45);
    ctx.lineTo(6, torsoH * 0.45);
    ctx.lineTo(-6, torsoH * 0.45);
    ctx.closePath();
    ctx.fill();

    // Vest edge strips (lighter)
    ctx.fillStyle = '#4488CC';
    // Left strip
    ctx.fillRect(-shoulderW + 1, -torsoH * 0.4, 2.5, torsoH * 0.8);
    // Right strip
    ctx.fillRect(shoulderW - 3.5, -torsoH * 0.4, 2.5, torsoH * 0.8);

    // Center vest seam
    ctx.strokeStyle = '#1A4488';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -torsoH * 0.45);
    ctx.lineTo(0, torsoH * 0.45);
    ctx.stroke();

    // Ammo pouches on sides (small rects)
    ctx.fillStyle = '#44382E';
    // Left pouches
    ctx.fillRect(-shoulderW + 1.5, -2, 4, 5);
    ctx.fillRect(-shoulderW + 1.5, 4, 4, 4);
    // Right pouches
    ctx.fillRect(shoulderW - 5.5, -2, 4, 5);
    ctx.fillRect(shoulderW - 5.5, 4, 4, 4);
    // Pouch flap lines
    ctx.strokeStyle = '#332A1E';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-shoulderW + 1.5, -0.5);
    ctx.lineTo(-shoulderW + 5.5, -0.5);
    ctx.moveTo(shoulderW - 5.5, -0.5);
    ctx.lineTo(shoulderW - 1.5, -0.5);
    ctx.stroke();

    // Belt line
    ctx.fillStyle = '#44382E';
    ctx.fillRect(-waistW + 1, torsoH * 0.35, waistW * 2 - 2, 2.5);
    // Belt buckle
    ctx.fillStyle = '#888877';
    ctx.fillRect(-2, torsoH * 0.35, 4, 2.5);

    // --- Damage state: scratch marks on vest ---
    if (hpRatio < 0.70 && hpRatio >= 0.40) {
        ctx.strokeStyle = '#1A3366';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-4, -3); ctx.lineTo(2, 2);
        ctx.moveTo(3, -5); ctx.lineTo(5, 0);
        ctx.stroke();
    } else if (hpRatio < 0.40) {
        // More scratches + crack lines
        ctx.strokeStyle = '#1A2244';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-5, -4); ctx.lineTo(3, 3);
        ctx.moveTo(4, -6); ctx.lineTo(6, 1);
        ctx.moveTo(-3, 2); ctx.lineTo(4, 6);
        ctx.stroke();
        // Armor crack (jagged line through vest) at <20%
        if (hpRatio < 0.20) {
            ctx.strokeStyle = '#FF4422';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-6, -torsoH * 0.3);
            ctx.lineTo(-2, -torsoH * 0.1);
            ctx.lineTo(1, -torsoH * 0.25);
            ctx.lineTo(4, 0);
            ctx.lineTo(2, torsoH * 0.15);
            ctx.lineTo(6, torsoH * 0.3);
            ctx.stroke();
        }
    }

    // --- Backpack (subtle rect behind body, visible based on aim direction) ---
    // Only show when facing "away" (aim angle is toward top of screen)
    const aimNormalized = ((aimAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const facingUp = aimNormalized > Math.PI * 0.5 && aimNormalized < Math.PI * 1.5;
    if (facingUp) {
        ctx.fillStyle = '#2A4A3A';
        ctx.fillRect(-5, -torsoH * 0.3, 10, torsoH * 0.6);
        ctx.strokeStyle = '#1A3A2A';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-5, -torsoH * 0.3, 10, torsoH * 0.6);
        // Backpack straps
        ctx.fillStyle = '#44382E';
        ctx.fillRect(-6, -torsoH * 0.3, 1.5, torsoH * 0.4);
        ctx.fillRect(4.5, -torsoH * 0.3, 1.5, torsoH * 0.4);
    }

    // --- Shoulder pads (angular, raised) ---
    // Left shoulder pad
    ctx.fillStyle = hasEvolved ? '#4A6A3A' : '#2A4A6A';
    ctx.beginPath();
    ctx.moveTo(-shoulderW - 1, -torsoH * 0.5 - 2);
    ctx.lineTo(-shoulderW + 5, -torsoH * 0.5 - 3);
    ctx.lineTo(-shoulderW + 5, -torsoH * 0.5 + 3);
    ctx.lineTo(-shoulderW - 1, -torsoH * 0.5 + 2);
    ctx.closePath();
    ctx.fill();
    // Right shoulder pad
    ctx.beginPath();
    ctx.moveTo(shoulderW + 1, -torsoH * 0.5 - 2);
    ctx.lineTo(shoulderW - 5, -torsoH * 0.5 - 3);
    ctx.lineTo(shoulderW - 5, -torsoH * 0.5 + 3);
    ctx.lineTo(shoulderW + 1, -torsoH * 0.5 + 2);
    ctx.closePath();
    ctx.fill();

    // Shoulder pad edge highlights
    ctx.strokeStyle = '#4488CC';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-shoulderW - 1, -torsoH * 0.5 - 2);
    ctx.lineTo(-shoulderW + 5, -torsoH * 0.5 - 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shoulderW + 1, -torsoH * 0.5 - 2);
    ctx.lineTo(shoulderW - 5, -torsoH * 0.5 - 3);
    ctx.stroke();

    // Evolved golden trim on shoulder pads
    if (hasEvolved) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.6 + Math.sin(gameTime * 2) * 0.2;
        ctx.beginPath();
        ctx.moveTo(-shoulderW - 1, -torsoH * 0.5 - 2);
        ctx.lineTo(-shoulderW + 5, -torsoH * 0.5 - 3);
        ctx.lineTo(-shoulderW + 5, -torsoH * 0.5 + 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(shoulderW + 1, -torsoH * 0.5 - 2);
        ctx.lineTo(shoulderW - 5, -torsoH * 0.5 - 3);
        ctx.lineTo(shoulderW - 5, -torsoH * 0.5 + 3);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        if (invincible > 0) ctx.globalAlpha = Math.floor(invincible * 10) % 2 === 0 ? 0.3 : 1.0;
    }

    ctx.restore(); // end torso transform

    // ==========================================
    // --- SUPPORT ARM (left arm)             ---
    // ==========================================
    ctx.save();
    ctx.translate(x, y + breathe);
    // Support arm position depends on weapon class
    if (weaponClass === 'rifle' || weaponClass === 'heavy') {
        ctx.rotate(aimAngle); // follows weapon
    }
    drawSupportArm(weaponClass, aimAngle, recoil);
    ctx.restore();

    // ==========================================
    // --- GUN ARM (right arm, weapon)        ---
    // ==========================================
    ctx.save();
    ctx.translate(x, y + breathe);
    ctx.rotate(aimAngle);
    drawPlayerWeapon(primaryWeaponId, recoil);
    ctx.restore();

    // ==========================================
    // --- HEAD (tactical helmet with visor)  ---
    // ==========================================
    const headCenterY = y + breathe - radius - 5;

    // Neck (connecting torso to head)
    ctx.fillStyle = '#2A3A5A';
    ctx.fillRect(x - 2.5, headCenterY + 7, 5, 5);

    // The helmet rotates toward aimAngle
    ctx.save();
    ctx.translate(x, headCenterY);
    ctx.rotate(aimAngle * 0.15); // subtle rotation toward aim (not full, it's top-down)

    // --- Helmet base (rounded rect, not a circle) ---
    const helmW = 9;
    const helmH = 10;
    const helmR = 3; // corner radius
    ctx.fillStyle = hpRatio < 0.15 ? '#1E2A42' : '#2A3A5A';
    ctx.beginPath();
    ctx.moveTo(-helmW + helmR, -helmH);
    ctx.lineTo(helmW - helmR, -helmH);
    ctx.quadraticCurveTo(helmW, -helmH, helmW, -helmH + helmR);
    ctx.lineTo(helmW, helmH - helmR);
    ctx.quadraticCurveTo(helmW, helmH, helmW - helmR, helmH);
    ctx.lineTo(-helmW + helmR, helmH);
    ctx.quadraticCurveTo(-helmW, helmH, -helmW, helmH - helmR);
    ctx.lineTo(-helmW, -helmH + helmR);
    ctx.quadraticCurveTo(-helmW, -helmH, -helmW + helmR, -helmH);
    ctx.closePath();
    ctx.fill();

    // Helmet outline / brim edge
    ctx.strokeStyle = '#1E2A42';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Helmet brim (front lip)
    ctx.fillStyle = '#222E44';
    ctx.beginPath();
    ctx.moveTo(-helmW - 0.5, -2);
    ctx.lineTo(helmW + 0.5, -2);
    ctx.lineTo(helmW + 1, 0);
    ctx.lineTo(-helmW - 1, 0);
    ctx.closePath();
    ctx.fill();

    // Helmet top detail (raised center ridge)
    ctx.fillStyle = '#344A6A';
    ctx.fillRect(-1.5, -helmH + 1, 3, helmH);

    // Helmet side vents
    ctx.fillStyle = '#1E2A42';
    ctx.fillRect(-helmW + 1, -helmH + 3, 2, 3);
    ctx.fillRect(helmW - 3, -helmH + 3, 2, 3);

    // --- Visor slit (THE face — thin bright horizontal line) ---
    const visorFlicker = (hpRatio < 0.40) ? (Math.sin(gameTime * 20) > 0.3 ? 1 : 0.3) : 1;
    ctx.globalAlpha = visorFlicker;

    // Visor glow (behind visor)
    ctx.globalAlpha = visorFlicker * 0.3;
    ctx.fillStyle = visorColor;
    ctx.beginPath();
    ctx.ellipse(0, 1, helmW + 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Visor slit itself
    ctx.globalAlpha = visorFlicker * 0.9;
    ctx.fillStyle = visorColor;
    ctx.fillRect(-helmW + 2, -0.5, helmW * 2 - 4, 2.5);

    // Visor bright center
    ctx.globalAlpha = visorFlicker;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-4, 0, 8, 1.5);

    // Low HP: red warning glow over whole helmet
    if (hpRatio < 0.20) {
        ctx.globalAlpha = 0.15 + Math.sin(gameTime * 6) * 0.1;
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.moveTo(-helmW + helmR, -helmH);
        ctx.lineTo(helmW - helmR, -helmH);
        ctx.quadraticCurveTo(helmW, -helmH, helmW, -helmH + helmR);
        ctx.lineTo(helmW, helmH - helmR);
        ctx.quadraticCurveTo(helmW, helmH, helmW - helmR, helmH);
        ctx.lineTo(-helmW + helmR, helmH);
        ctx.quadraticCurveTo(-helmW, helmH, -helmW, helmH - helmR);
        ctx.lineTo(-helmW, -helmH + helmR);
        ctx.quadraticCurveTo(-helmW, -helmH, -helmW + helmR, -helmH);
        ctx.closePath();
        ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    // Evolved golden trim on helmet
    if (hasEvolved) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.5 + Math.sin(gameTime * 2) * 0.2;
        ctx.beginPath();
        ctx.moveTo(-helmW + helmR, -helmH);
        ctx.lineTo(helmW - helmR, -helmH);
        ctx.quadraticCurveTo(helmW, -helmH, helmW, -helmH + helmR);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    // Chin guard (small arc below helmet)
    ctx.fillStyle = '#2A3A5A';
    ctx.beginPath();
    ctx.arc(0, helmH + 1, 5, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#222E44';
    ctx.beginPath();
    ctx.arc(0, helmH + 1, 5, 0.3, Math.PI - 0.3);
    ctx.fill();

    ctx.restore(); // end helmet transform

    // ==========================================
    // --- LOW HP RED TINT OVERLAY            ---
    // ==========================================
    if (hpRatio < 0.30) {
        const redAlpha = hpRatio < 0.15 ? 0.2 : 0.1;
        ctx.globalAlpha = redAlpha;
        ctx.fillStyle = '#FF0000';
        // Over torso area
        ctx.beginPath();
        ctx.ellipse(x, y + breathe, radius * 1.2, radius * 1.0, 0, 0, Math.PI * 2);
        ctx.fill();
    }

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

    // --- Status visual indicators (034) ---

    // Burning: orange tint overlay + 2 small rising particles
    if (e.burning > 0) {
        ctx.globalAlpha = 0.25 + e.burningStacks * 0.08;
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        // Spawn occasional fire particles (throttled by randomness to keep cheap)
        if (Math.random() < 0.15) {
            spawnParticle(
                e.x + randomRange(-e.radius * 0.5, e.radius * 0.5),
                e.y - e.radius * 0.3,
                randomRange(-10, 10), randomRange(-40, -20),
                randomRange(1.5, 3), '#FF8833',
                randomRange(0.2, 0.4), true, -10
            );
        }
    }

    // Frozen: blue tint + 4 small ice crystal lines
    if (e.frozen > 0) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#88CCFF';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#AADDFF';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
            const a = (Math.PI * 2 / 4) * i + gameTime * 0.5;
            const inner = e.radius * 0.7;
            const outer = e.radius + 3;
            ctx.beginPath();
            ctx.moveTo(e.x + Math.cos(a) * inner, e.y + Math.sin(a) * inner);
            ctx.lineTo(e.x + Math.cos(a) * outer, e.y + Math.sin(a) * outer);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }

    // Poisoned: green tint + occasional bubble
    if (e.poisoned > 0) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#44FF44';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        if (Math.random() < 0.08) {
            spawnParticle(
                e.x + randomRange(-e.radius * 0.4, e.radius * 0.4),
                e.y - e.radius * 0.2,
                randomRange(-8, 8), randomRange(-30, -15),
                randomRange(1, 2.5), '#66FF44',
                randomRange(0.3, 0.6), true, -5
            );
        }
    }

    // Electrified: blue spark dots flickering around enemy
    if (e.electrified) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#88CCFF';
        for (let i = 0; i < 3; i++) {
            const a = gameTime * 12 + i * (Math.PI * 2 / 3);
            const sparkR = e.radius + 2 + Math.sin(gameTime * 20 + i * 2) * 3;
            const sx = e.x + Math.cos(a) * sparkR;
            const sy = e.y + Math.sin(a) * sparkR;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }

    // Weakened: darker tint
    if (e.weakened > 0) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Frostburn combo (037): purple tint overlay
    if (e.frostburn) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#AA44FF';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // --- End status indicators ---

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
        p.type === 'firezone' || p.type === 'plaguezone' || p.type === 'frostdot' ||
        p.type === 'holywaterzone') return;

    const trailColor = p.color || '#FFDD44';
    // Visual upgrade (039): Lv3+ = brighter/longer trail, Lv6+ = even more
    const vl = p.visualLevel || 0;
    const alphaBoost = vl >= 2 ? 0.7 : (vl >= 1 ? 0.55 : 0.4);

    for (let i = 0; i < p.trailCount; i++) {
        // Read from ring buffer: oldest to newest
        const idx = (p.trailHead - p.trailCount + i + 6) % 6;
        const age = (p.trailCount - i) / p.trailCount; // 1 = oldest, 0 = newest
        const alpha = (1 - age) * alphaBoost;
        const r = p.radius * (1 - age * 0.5);
        if (alpha < 0.02) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = trailColor;
        ctx.beginPath();
        ctx.arc(p.trailX[idx], p.trailY[idx], Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
    }

    // Visual upgrade (039) Lv6+: extra glow on trail
    if (vl >= 2 && p.trailCount > 2) {
        const newestIdx = (p.trailHead - 1 + 6) % 6;
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = trailColor;
        ctx.beginPath();
        ctx.arc(p.trailX[newestIdx], p.trailY[newestIdx], p.radius * 2.5, 0, Math.PI * 2);
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
        case 'sawblade':
            drawSawblade(p);
            return;
        default:
            drawNormalProjectile(p);
    }
}

function drawNormalProjectile(p) {
    const vl = p.visualLevel || 0;
    // Glow — intensifies with visual level (039)
    const glowAlpha = vl >= 2 ? 0.4 : (vl >= 1 ? 0.32 : 0.25);
    const glowMult = vl >= 2 ? 3.5 : 3;
    ctx.globalAlpha = glowAlpha;
    ctx.fillStyle = p.color || COLOR_BULLET;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * glowMult, 0, Math.PI * 2);
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

    // (028) Rising flame particles — ~2-3 per 0.3s
    if (Math.random() < 0.15) {
        const angle = randomRange(0, Math.PI * 2);
        const dist = randomRange(0, r * 0.8);
        const px = p.x + Math.cos(angle) * dist;
        const py = p.y + Math.sin(angle) * dist;
        const colors = ['#FF6600', '#FF4400', '#FFAA22'];
        spawnParticle(px, py, randomRange(-10, 10), randomRange(-40, -80),
            randomRange(2, 4), colors[Math.floor(Math.random() * 3)],
            randomRange(0.3, 0.6), true, 0);
    }
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

    // (030) Plague bubble particles — 1-2 rising every ~0.5s
    if (Math.random() < 0.06) {
        const angle = randomRange(0, Math.PI * 2);
        const dist = randomRange(0, r * 0.7);
        const px = p.x + Math.cos(angle) * dist;
        const py = p.y + Math.sin(angle) * dist;
        const colors = ['#88FF22', '#66FF00', '#AAFF44'];
        spawnParticle(px, py, randomRange(-5, 5), randomRange(-25, -50),
            randomRange(1.5, 3), colors[Math.floor(Math.random() * 3)],
            randomRange(0.4, 0.8), true, 0);
    }
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

    // (029) Frost mist particles — 1-2 drifting slowly within zone
    if (Math.random() < 0.08) {
        const angle = randomRange(0, Math.PI * 2);
        const dist = randomRange(0, r * 0.7);
        const px = p.x + Math.cos(angle) * dist;
        const py = p.y + Math.sin(angle) * dist;
        const colors = ['#AADDFF', '#88CCFF', '#CCEEFF'];
        spawnParticle(px, py, randomRange(-15, 15), randomRange(-15, 15),
            randomRange(2, 5), colors[Math.floor(Math.random() * 3)],
            randomRange(0.5, 1.0), true, 0);
    }
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

// --- Sawblade projectile (042) ---
function drawSawblade(p) {
    const spin = gameTime * 15; // fast spinning
    const r = p.radius;

    // Glow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = p.color || '#CCCCCC';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Blade disc
    ctx.globalAlpha = 1.0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(spin);

    // Outer disc
    ctx.fillStyle = '#AAAAAA';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Teeth — 6 triangular notches
    ctx.fillStyle = p.color || '#CCCCCC';
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 / 6) * i;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
        ctx.lineTo(Math.cos(a - 0.3) * r * 1.2, Math.sin(a - 0.3) * r * 1.2);
        ctx.lineTo(Math.cos(a + 0.3) * r * 1.2, Math.sin(a + 0.3) * r * 1.2);
        ctx.closePath();
        ctx.fill();
    }

    // Center hole
    ctx.fillStyle = '#666666';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// --- Holy Water zone (041) ---
function drawHolyWaterZone(p) {
    const fade = 1 - (p.lifetime / p.maxLifetime);
    const pulse = 1 + Math.sin(gameTime * 3) * 0.06;
    const r = p.radius * pulse;

    // Outer glow — blue-white
    ctx.globalAlpha = fade * 0.12;
    ctx.fillStyle = '#88DDFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Main zone
    ctx.globalAlpha = fade * 0.2;
    ctx.fillStyle = p.color || '#44AAFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.globalAlpha = fade * 0.15;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle ring
    ctx.globalAlpha = fade * 0.5;
    ctx.strokeStyle = '#88DDFF';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, gameTime * 2 % (Math.PI * 2), gameTime * 2 % (Math.PI * 2) + Math.PI * 1.5);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 1.0;
}

// --- Whip sweep arc visual (040) ---
function drawSweepArc(sweep) {
    const t = sweep.timer / sweep.maxTimer; // 1 = just fired, 0 = gone
    const halfArc = sweep.arc / 2;

    ctx.save();
    ctx.translate(sweep.x, sweep.y);

    // Fading arc fill
    ctx.globalAlpha = t * 0.3;
    ctx.fillStyle = sweep.color || '#CC88FF';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, sweep.range, sweep.angle - halfArc, sweep.angle + halfArc);
    ctx.closePath();
    ctx.fill();

    // Arc edge line
    ctx.globalAlpha = t * 0.6;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, sweep.range, sweep.angle - halfArc, sweep.angle + halfArc);
    ctx.stroke();

    // Slash line across the arc (at the sweep range edge)
    ctx.globalAlpha = t * 0.8;
    ctx.strokeStyle = sweep.color || '#CC88FF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(
        Math.cos(sweep.angle - halfArc * 0.8) * sweep.range * 0.3,
        Math.sin(sweep.angle - halfArc * 0.8) * sweep.range * 0.3
    );
    ctx.lineTo(
        Math.cos(sweep.angle + halfArc * 0.8) * sweep.range,
        Math.sin(sweep.angle + halfArc * 0.8) * sweep.range
    );
    ctx.stroke();

    ctx.restore();
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
