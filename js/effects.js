// Particle effects, damage numbers, screen shake, screen flash
import { createPool } from './objectPool.js';
import { MAX_PARTICLES, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';
import { randomRange, v2FromAngle } from './utils.js';

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

// --- Damage Numbers ---
const damageNumbers = [];
const MAX_DAMAGE_NUMBERS = 60;

// --- Screen Shake ---
let shakeIntensity = 0;
let shakeDuration = 0;
let shakeOffsetX = 0;
let shakeOffsetY = 0;

// --- Screen Flash ---
let flashColor = '#FFFFFF';
let flashAlpha = 0;
let flashDecay = 3;

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

export function renderEffects(ctx, camera) {
    // Particles (world space — called inside camera transform)
    particlePool.forEach(p => {
        const fade = 1 - (p.life / p.maxLife);
        const r = p.shrink ? p.radius * fade : p.radius;
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Damage numbers (world space)
    for (const d of damageNumbers) {
        const fade = 1 - (d.life / d.maxLife);
        ctx.globalAlpha = fade;
        ctx.fillStyle = d.color;
        ctx.font = `bold ${d.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(d.text, d.x, d.y);
    }
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';
}

export function renderScreenEffects(ctx) {
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
    damageNumbers.length = 0;
    shakeIntensity = 0;
    shakeDuration = 0;
    shakeOffsetX = 0;
    shakeOffsetY = 0;
    flashAlpha = 0;
}

// === Spawn helpers ===

export function spawnKillParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
        const p = particlePool.acquire();
        if (!p) return;
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(60, 180);
        const dir = v2FromAngle(angle);
        p.x = x + randomRange(-5, 5);
        p.y = y + randomRange(-5, 5);
        p.vx = dir.x * speed;
        p.vy = dir.y * speed;
        p.radius = randomRange(2, 5);
        p.color = color;
        p.life = 0;
        p.maxLife = randomRange(0.3, 0.7);
        p.shrink = true;
        p.gravity = randomRange(0, 100);
    }
}

export function spawnBossDeathParticles(x, y, color) {
    spawnKillParticles(x, y, color, 30);
    spawnKillParticles(x, y, '#FFD700', 15);
    spawnKillParticles(x, y, '#FFFFFF', 10);
}

export function spawnXPPickupFlash(x, y) {
    for (let i = 0; i < 3; i++) {
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
    for (let i = 0; i < 4; i++) {
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

export function spawnDamageNumber(x, y, text, color = '#FFFFFF', size = 14) {
    if (damageNumbers.length >= MAX_DAMAGE_NUMBERS) {
        damageNumbers.shift();
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
    shakeIntensity = Math.max(shakeIntensity, intensity);
    shakeDuration = Math.max(shakeDuration, duration);
}

export function triggerFlash(color = '#FF0000', alpha = 0.4, decay = 3) {
    flashColor = color;
    flashAlpha = alpha;
    flashDecay = decay;
}

export function getShakeOffset() {
    return { x: shakeOffsetX, y: shakeOffsetY };
}
