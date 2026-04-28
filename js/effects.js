// Particle effects, damage numbers, screen shake, screen flash
import { createPool } from './objectPool.js';
import { MAX_PARTICLES, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';
import { randomRange, v2FromAngle } from './utils.js';
import { getSettings } from './settings.js';

function mixHex(a, b, t) {
    if (!a || a[0] !== '#' || a.length < 7) return a;
    if (!b || b[0] !== '#' || b.length < 7) return b;
    const ar = parseInt(a.slice(1,3),16), ag = parseInt(a.slice(3,5),16), ab = parseInt(a.slice(5,7),16);
    const br = parseInt(b.slice(1,3),16), bg = parseInt(b.slice(3,5),16), bb = parseInt(b.slice(5,7),16);
    const r = Math.round(ar + (br-ar)*t), g = Math.round(ag + (bg-ag)*t), bl = Math.round(ab + (bb-ab)*t);
    return '#' + [r,g,bl].map(v => v.toString(16).padStart(2,'0')).join('');
}

// --- Particle Pool ---
function createParticleObj() {
    return {
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        radius: 3,
        color: '#FFFFFF',
        life: 0,
        maxLife: 1.0,
        shrink: true,
        gravity: 0,
    };
}

const particlePool = createPool(createParticleObj, MAX_PARTICLES);

// --- Shockwave Rings ---
const shockwaves = [];
const MAX_SHOCKWAVES = 10;

// --- Damage Numbers ---
const damageNumbers = [];
const MAX_DAMAGE_NUMBERS = 100;

// --- Screen Shake ---
let shakeIntensity = 0;
let shakeDuration = 0;
let shakeOffsetX = 0;
let shakeOffsetY = 0;

// --- Screen Flash ---
let flashColor = '#FFFFFF';
let flashAlpha = 0;
let flashDecay = 3;
let fogOverlayAlpha = 0;

// --- Explosions (027) ---
const explosions = [];
const MAX_EXPLOSIONS = 15;

// --- Ground Scars (032) ---
const groundScars = [];
const MAX_GROUND_SCARS = 30;

function getParticleScale() {
    return Math.max(0, getSettings().particleScale ?? 1);
}

function scaledCount(baseCount, minCount = 1) {
    return Math.max(minCount, Math.round(baseCount * getParticleScale()));
}

// === Public API ===

export function updateEffects(dt) {
    // Particles
    particlePool.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.life += dt;
        if (p.life >= p.maxLife) {
            particlePool.release(p);
        }
    });

    // Damage numbers
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
        const d = damageNumbers[i];
        d.y -= 40 * dt;
        d.life += dt;
        if (d.life >= d.maxLife) {
            damageNumbers.splice(i, 1);
        }
    }

    // Shockwave rings
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const s = shockwaves[i];
        s.life += dt;
        s.currentRadius += s.expandSpeed * dt;
        if (s.life >= s.maxLife) {
            shockwaves.splice(i, 1);
        }
    }

    // Explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        ex.life += dt;
        if (ex.life >= ex.maxLife) {
            explosions.splice(i, 1);
        }
    }

    // Ground scars
    for (let i = groundScars.length - 1; i >= 0; i--) {
        const gs = groundScars[i];
        gs.life += dt;
        if (gs.life >= gs.maxLife) {
            groundScars.splice(i, 1);
        }
    }

    // Screen shake
    if (shakeDuration > 0) {
        shakeDuration -= dt;
        shakeOffsetX = (Math.random() - 0.5) * shakeIntensity * 2;
        shakeOffsetY = (Math.random() - 0.5) * shakeIntensity * 2;
        shakeIntensity *= 0.9;
    } else {
        shakeOffsetX = 0;
        shakeOffsetY = 0;
    }

    // Screen flash
    if (flashAlpha > 0) {
        flashAlpha -= dt * flashDecay;
        if (flashAlpha < 0) flashAlpha = 0;
    }
}

export function renderGroundScars(ctx) {
    // Ground scars (032) — drawn early in render order, before enemies
    for (const gs of groundScars) {
        const fade = 1 - (gs.life / gs.maxLife);
        ctx.globalAlpha = gs.alpha * fade;
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(gs.x, gs.y, gs.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

export function renderEffects(ctx, camera) {
    // Explosions (027) — expanding circle + core flash
    for (const ex of explosions) {
        const t = ex.life / ex.maxLife;
        // Expanding circle: 0 → blast radius over 150ms
        const expandT = Math.min(ex.life / 0.15, 1);
        const circleR = ex.radius * expandT;
        ctx.globalAlpha = (1 - t) * 0.4;
        ctx.fillStyle = ex.color;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, circleR, 0, Math.PI * 2);
        ctx.fill();
        // Shockwave ring at 1.5x expansion speed
        const ringT = Math.min(ex.life / 0.1, 1); // 1.5x faster → reaches radius in 100ms
        const ringR = ex.radius * ringT;
        ctx.globalAlpha = (1 - t) * 0.6;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1, 3 * (1 - t));
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
        // Core flash: bright white, 10px, fades over 50ms
        const flashT = Math.min(ex.life / 0.05, 1);
        ctx.globalAlpha = (1 - flashT) * 0.9;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, 10 * (1 - flashT * 0.5), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Particles (world space — called inside camera transform)
    particlePool.forEach(p => {
        const fade = 1 - (p.life / p.maxLife);
        const r = p.shrink ? p.radius * fade : p.radius;
        ctx.globalAlpha = fade;
        const lifeFrac = p.life / p.maxLife;
        let drawColor = p.color;
        if (lifeFrac > 0.7) {
            // mix toward white in last 30% of life
            const t = (lifeFrac - 0.7) / 0.3 * 0.6;
            drawColor = mixHex(p.color, '#FFFFFF', t);
        }
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Shockwave rings (world space)
    for (const s of shockwaves) {
        const fade = 1 - (s.life / s.maxLife);
        ctx.globalAlpha = fade * 0.6;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(1, 3 * fade);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.currentRadius, 0, Math.PI * 2);
        ctx.stroke();
        // Inner fill
        ctx.globalAlpha = fade * 0.1;
        ctx.fillStyle = s.color;
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Damage numbers (world space) with scale-in animation
    for (const d of damageNumbers) {
        const fade = 1 - (d.life / d.maxLife);
        // Scale-in: 0.5 → 1.2 over first 0.08s, then settle to 1.0
        let scale;
        if (d.life < 0.04) {
            scale = 0.5 + (d.life / 0.04) * 0.7; // 0.5 → 1.2
        } else if (d.life < 0.12) {
            scale = 1.2 - ((d.life - 0.04) / 0.08) * 0.2; // 1.2 → 1.0
        } else {
            scale = 1.0;
        }
        const scaledSize = Math.round(d.size * scale);
        ctx.globalAlpha = fade;
        ctx.fillStyle = d.color;
        ctx.font = `bold ${scaledSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(d.text, d.x, d.y);
    }
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';
}

export function renderScreenEffects(ctx) {
    if (fogOverlayAlpha > 0) {
        ctx.fillStyle = '#5E6064';
        ctx.globalAlpha = Math.min(0.25, fogOverlayAlpha);
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.globalAlpha = 1.0;
    }

    // Screen flash (screen space — called after camera restore)
    if (flashAlpha > 0) {
        ctx.fillStyle = flashColor;
        ctx.globalAlpha = Math.min(flashAlpha, 1);
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.globalAlpha = 1.0;
    }
}

export function resetEffects() {
    particlePool.clear();
    shockwaves.length = 0;
    damageNumbers.length = 0;
    explosions.length = 0;
    groundScars.length = 0;
    shakeIntensity = 0;
    shakeDuration = 0;
    shakeOffsetX = 0;
    shakeOffsetY = 0;
    flashAlpha = 0;
    fogOverlayAlpha = 0;
    announcement = null;
    killStreak = 0;
    streakDisplayTimer = 0;
}

export function setFogOverlayAlpha(alpha) {
    fogOverlayAlpha = Math.max(0, Math.min(1, alpha || 0));
}

// === Spawn helpers ===

export function spawnKillParticles(x, y, color, count = 22) {
    const scaled = scaledCount(count, 2);

    // Main burst in enemy color
    for (let i = 0; i < scaled; i++) {
        const p = particlePool.acquire();
        if (!p) return;
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(80, 200);
        const dir = v2FromAngle(angle);
        p.x = x + randomRange(-5, 5);
        p.y = y + randomRange(-5, 5);
        p.vx = dir.x * speed;
        p.vy = dir.y * speed;
        p.radius = randomRange(2, 6);
        p.color = color;
        p.life = 0;
        p.maxLife = randomRange(0.3, 0.8);
        p.shrink = true;
        p.gravity = randomRange(20, 120);
    }
    // White sparks
    const sparkCount = Math.min(5, Math.max(1, Math.floor(scaled / 3)));
    for (let i = 0; i < sparkCount; i++) {
        const p = particlePool.acquire();
        if (!p) return;
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(100, 250);
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.radius = randomRange(1, 2.5);
        p.color = '#FFFFFF';
        p.life = 0;
        p.maxLife = randomRange(0.15, 0.35);
        p.shrink = true;
        p.gravity = 0;
    }
}

export function spawnBossDeathParticles(x, y, color) {
    spawnKillParticles(x, y, color, 30);
    spawnKillParticles(x, y, '#FFD700', 15);
    spawnKillParticles(x, y, '#FFFFFF', 10);
}

export function spawnXPPickupFlash(x, y) {
    const count = scaledCount(3, 1);
    for (let i = 0; i < count; i++) {
        const p = particlePool.acquire();
        if (!p) return;
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(20, 60);
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 30;
        p.radius = randomRange(1.5, 3);
        p.color = '#44FF88';
        p.life = 0;
        p.maxLife = 0.3;
        p.shrink = true;
        p.gravity = 0;
    }
}

export function spawnHitParticles(x, y, color = '#FF4444') {
    const count = scaledCount(6, 1);
    for (let i = 0; i < count; i++) {
        const p = particlePool.acquire();
        if (!p) return;
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(40, 100);
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.radius = randomRange(1.5, 3);
        p.color = color;
        p.life = 0;
        p.maxLife = 0.25;
        p.shrink = true;
        p.gravity = 0;
    }
}

export function spawnDamageNumber(x, y, text, color, size) {
    if (!getSettings().damageNumbersEnabled) return;
    if (damageNumbers.length >= MAX_DAMAGE_NUMBERS) {
        damageNumbers.shift();
    }
    // Auto-tier color/size by damage value if not specified
    const dmg = typeof text === 'number' ? text : parseInt(text, 10) || 0;
    if (!color || !size) {
        if (dmg >= 100) { color = color || '#FF2222'; size = size || 22; }
        else if (dmg >= 50) { color = color || '#FF8822'; size = size || 18; }
        else if (dmg >= 25) { color = color || '#FFDD44'; size = size || 16; }
        else if (dmg >= 10) { color = color || '#FFFFFF'; size = size || 14; }
        else { color = color || '#CCCCCC'; size = size || 12; }
    }
    damageNumbers.push({
        x: x + randomRange(-10, 10),
        y: y - 10,
        text: String(text),
        color,
        size,
        life: 0,
        maxLife: 0.8,
    });
}

// === Screen effects ===

export function triggerShake(intensity = 5, duration = 0.2) {
    const shakeScale = Math.max(0, getSettings().shakeScale ?? 1);
    shakeIntensity = Math.max(shakeIntensity, intensity * shakeScale);
    shakeDuration = Math.max(shakeDuration, duration);
}

export function triggerFlash(color = '#FF0000', alpha = 0.4, decay = 3) {
    if (!getSettings().flashEnabled) return;
    flashColor = color;
    flashAlpha = alpha;
    flashDecay = decay;
}

export function spawnShockwave(x, y, maxRadius, color = '#FFFFFF') {
    if (shockwaves.length >= MAX_SHOCKWAVES) shockwaves.shift();
    shockwaves.push({
        x, y,
        currentRadius: 0,
        maxRadius,
        expandSpeed: maxRadius / 0.2, // reach full radius in 200ms
        color,
        life: 0,
        maxLife: 0.25,
    });
}

export function getShakeOffset() {
    return { x: shakeOffsetX, y: shakeOffsetY };
}

// === Explosion effect (027) ===

export function spawnExplosion(x, y, radius, color) {
    if (explosions.length >= MAX_EXPLOSIONS) explosions.shift();
    explosions.push({
        x, y, radius, color,
        life: 0,
        maxLife: 0.2,
    });
    // 6-11 debris particles outward from center
    const debrisCount = scaledCount(6 + Math.floor(Math.random() * 6), 1);
    for (let i = 0; i < debrisCount; i++) {
        const p = particlePool.acquire();
        if (!p) break;
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(100, 250);
        p.x = x + randomRange(-3, 3);
        p.y = y + randomRange(-3, 3);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.radius = randomRange(2, 5);
        p.color = color;
        p.life = 0;
        p.maxLife = randomRange(0.3, 0.6);
        p.shrink = true;
        p.gravity = randomRange(60, 200);
    }
}

// === Ground scar (032) ===

export function spawnGroundScar(x, y, radius) {
    if (groundScars.length >= MAX_GROUND_SCARS) groundScars.shift();
    groundScars.push({
        x, y,
        radius: radius * 0.8,
        alpha: 0.3,
        life: 0,
        maxLife: 3.0,
    });
}

// === Announcement system (reusable banner) ===
let announcement = null; // { text, timer, maxTimer, color }

export function showAnnouncement(text, duration, color) {
    announcement = { text, timer: duration, maxTimer: duration, color: color || '#FFDD44' };
}

export function updateAnnouncement(dt) {
    if (announcement) {
        announcement.timer -= dt;
        if (announcement.timer <= 0) announcement = null;
    }
}

export function renderAnnouncement(ctx, canvasW, canvasH) {
    if (!announcement) return;
    const { text, timer, maxTimer, color } = announcement;
    const t = timer / maxTimer;

    // Fade in (first 20%) and out (last 20%)
    let alpha = 1;
    if (t > 0.8) alpha = (1 - t) / 0.2;  // fade in
    else if (t < 0.2) alpha = t / 0.2;     // fade out

    // Banner background
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, canvasH * 0.38, canvasW, 48);

    // Text with glow
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.fillText(text, canvasW / 2, canvasH * 0.38 + 32);
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';
}

// === Kill streak counter ===
let killStreak = 0;
let streakDisplayTimer = 0; // time since last kill for fade-out

export function incrementStreak() {
    killStreak++;
    streakDisplayTimer = 2.0; // show for 2s after last kill
}

export function resetStreak() {
    killStreak = 0;
    streakDisplayTimer = 0;
}

export function updateStreak(dt) {
    if (streakDisplayTimer > 0) {
        streakDisplayTimer -= dt;
        if (streakDisplayTimer <= 0 && killStreak > 0) {
            // Don't reset streak, just stop displaying — resets on damage
        }
    }
}

export function getKillStreak() { return killStreak; }

export function renderStreak(ctx, canvasW, canvasH, gameTime) {
    if (killStreak < 6) return;
    // Fade out after streakDisplayTimer hits 0
    let alpha = 1;
    if (streakDisplayTimer <= 0) alpha = 0;
    else if (streakDisplayTimer < 0.5) alpha = streakDisplayTimer / 0.5;
    if (alpha <= 0) return;

    let label = `STREAK: ${killStreak}`;
    let color = '#FFDD44';
    let fontSize = 18;
    if (killStreak >= 50) {
        label = `GODLIKE: ${killStreak}`;
        color = '#FF2222';
        fontSize = 26;
    } else if (killStreak >= 25) {
        label = `UNSTOPPABLE: ${killStreak}`;
        color = '#FF6622';
        fontSize = 22;
    } else if (killStreak >= 15) {
        fontSize = 20;
    }

    // Glow intensity scales with streak
    const glowSize = Math.min(30, 10 + killStreak * 0.4);
    const pulse = 0.8 + Math.sin(gameTime * 5) * 0.2;

    ctx.globalAlpha = alpha * pulse;
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'right';
    ctx.shadowColor = color;
    ctx.shadowBlur = glowSize;
    ctx.fillStyle = color;
    ctx.fillText(label, canvasW - 16, canvasH - 20);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';
}

// === Zone particle helpers (028, 029, 030) ===

export function spawnParticle(x, y, vx, vy, radius, color, maxLife, shrink = true, gravity = 0) {
    const p = particlePool.acquire();
    if (!p) return;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.radius = radius;
    p.color = color;
    p.life = 0;
    p.maxLife = maxLife;
    p.shrink = shrink;
    p.gravity = gravity;
}

// === Per-type enemy death effects ===

export function spawnEnemyDeathEffects(enemy) {
    const { x, y, type, isBoss, vx, vy } = enemy;

    switch (type) {
        case 'shambler':
            _deathShambler(x, y);
            break;
        case 'runner':
            _deathRunner(x, y, vx, vy);
            break;
        case 'bat':
            _deathBat(x, y);
            break;
        case 'brute':
            _deathBrute(x, y);
            break;
        case 'spitter':
            _deathSpitter(x, y);
            break;
        case 'swarmer':
            _deathSwarmer(x, y);
            break;
        case 'exploder':
            _deathExploder(x, y);
            break;
    }

    // Boss deaths get extra spectacle regardless of boss type
    if (isBoss) {
        _deathBoss(x, y);
    }
}

// Shambler: slow green-brown goo particles with gravity
function _deathShambler(x, y) {
    const gooColors = ['#446622', '#557733', '#335511', '#668833'];
    for (let i = 0; i < scaledCount(4, 1); i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(30, 80);
        spawnParticle(
            x + randomRange(-4, 4), y + randomRange(-4, 4),
            Math.cos(angle) * speed, Math.sin(angle) * speed,
            randomRange(3, 6),
            gooColors[i % gooColors.length],
            randomRange(0.6, 1.2),
            true,
            randomRange(150, 300) // heavy gravity — falls and splats
        );
    }
    // Small ground mark (reuse ground scar)
    spawnGroundScar(x, y, 12);
}

// Runner: motion-line speed burst in last movement direction
function _deathRunner(x, y, vx, vy) {
    // Normalize the movement direction (fallback to random if stationary)
    let dirX = vx;
    let dirY = vy;
    const mag = Math.sqrt(dirX * dirX + dirY * dirY);
    if (mag > 0.1) {
        dirX /= mag;
        dirY /= mag;
    } else {
        const a = randomRange(0, Math.PI * 2);
        dirX = Math.cos(a);
        dirY = Math.sin(a);
    }
    // 6 thin speed-line particles shooting in movement direction
    for (let i = 0; i < scaledCount(6, 1); i++) {
        const spread = randomRange(-0.3, 0.3);
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        const lx = dirX * cos - dirY * sin;
        const ly = dirX * sin + dirY * cos;
        const speed = randomRange(250, 450);
        spawnParticle(
            x, y,
            lx * speed, ly * speed,
            randomRange(1, 2), // thin
            '#FF6666',
            randomRange(0.1, 0.25), // fast-fading
            true,
            0
        );
    }
}

// Bat: feather particles that flutter downward
function _deathBat(x, y) {
    const featherColors = ['#AA44CC', '#9933BB', '#BB55DD', '#CC66EE', '#8833AA'];
    for (let i = 0; i < scaledCount(5, 1); i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(20, 60);
        spawnParticle(
            x + randomRange(-6, 6), y + randomRange(-6, 6),
            Math.cos(angle) * speed, // slight sideways drift
            randomRange(-20, 10),    // slow upward or slight downward
            randomRange(2, 4),
            featherColors[i % featherColors.length],
            randomRange(0.8, 1.5),   // long-lived — slow flutter
            true,
            randomRange(30, 60)      // gentle gravity for downward float
        );
    }
}

// Brute: heavy armor fragment particles + extra screen shake
function _deathBrute(x, y) {
    const armorColors = ['#FF8800', '#CC6600', '#AA5500', '#BB7722'];
    for (let i = 0; i < scaledCount(4, 1); i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(60, 140);
        spawnParticle(
            x + randomRange(-5, 5), y + randomRange(-5, 5),
            Math.cos(angle) * speed, Math.sin(angle) * speed,
            randomRange(5, 9),   // large fragments
            armorColors[i % armorColors.length],
            randomRange(0.5, 1.0),
            true,
            randomRange(200, 400) // heavy gravity — armor is dense
        );
    }
    // Extra ground-shake on brute death (+2 intensity above standard kill shake)
    triggerShake(4, 0.25);
}

// Spitter: toxic burst — poison cloud + green splatter
function _deathSpitter(x, y) {
    // Poison cloud: large translucent green circle (fading over 0.5s)
    // Implemented as a large, non-shrinking particle that fades via life
    spawnParticle(
        x, y,
        0, 0,
        40,          // 40px radius cloud
        '#33AA22',
        0.5,         // 0.5s fade
        false,       // don't shrink — let alpha fade handle it
        0
    );
    // 6 green splatter particles outward
    for (let i = 0; i < scaledCount(6, 1); i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(80, 180);
        spawnParticle(
            x, y,
            Math.cos(angle) * speed, Math.sin(angle) * speed,
            randomRange(2, 4),
            '#66DD22',
            randomRange(0.3, 0.6),
            true,
            randomRange(40, 120)
        );
    }
}

// Swarmer: tiny dots scattering in all directions very quickly
function _deathSwarmer(x, y) {
    for (let i = 0; i < scaledCount(10, 2); i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(200, 400); // very fast scatter
        spawnParticle(
            x, y,
            Math.cos(angle) * speed, Math.sin(angle) * speed,
            randomRange(0.8, 1.5), // very small
            '#333344',
            randomRange(0.1, 0.3), // very fast fade
            true,
            0
        );
    }
}

// Exploder: bright orange flash circle + rising ember particles
function _deathExploder(x, y) {
    // Orange flash circle (expanding, fading) — large non-shrinking particle
    spawnParticle(
        x, y,
        0, 0,
        35,
        '#FF6600',
        0.25,
        false, // don't shrink — alpha fade handles it
        0
    );
    // 5 rising ember particles
    for (let i = 0; i < scaledCount(5, 1); i++) {
        spawnParticle(
            x + randomRange(-8, 8), y + randomRange(-5, 5),
            randomRange(-20, 20),
            randomRange(-120, -60), // rising upward
            randomRange(1.5, 3),
            '#FF8833',
            randomRange(0.4, 0.8),
            true,
            -30 // negative gravity — embers float up
        );
    }
}

// Boss: screen flash, shockwave rings, gold particle fountain
function _deathBoss(x, y) {
    // Screen-wide white flash (0.15 alpha, fades over ~200ms → decay ~0.75/s)
    triggerFlash('#FFFFFF', 0.15, 0.75);

    // 3 expanding shockwave rings (staggered via slightly different start radii)
    // Since we can't delay spawns, stagger by starting at different radii
    spawnShockwave(x, y, 150, '#FFFFFF');
    spawnShockwave(x, y, 120, '#FFD700');
    spawnShockwave(x, y, 90, '#FFFFFF');

    // Larger explosion
    spawnExplosion(x, y, 100, '#FFD700');

    // Gold particle fountain: 18 gold particles that rise then fall
    for (let i = 0; i < scaledCount(18, 4); i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(40, 120);
        spawnParticle(
            x + randomRange(-10, 10), y + randomRange(-10, 10),
            Math.cos(angle) * speed,
            randomRange(-200, -80), // shoot upward
            randomRange(2, 5),
            '#FFD700',
            randomRange(0.8, 1.5),
            true,
            randomRange(150, 300) // gravity pulls them back down
        );
    }
}
