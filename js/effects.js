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

// --- Shockwave Rings ---
const shockwaves = [];
const MAX_SHOCKWAVES = 10;

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

    // Shockwave rings
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const s = shockwaves[i];
        s.life += dt;
        s.currentRadius += s.expandSpeed * dt;
        if (s.life >= s.maxLife) {
            shockwaves.splice(i, 1);
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
    shakeIntensity = 0;
    shakeDuration = 0;
    shakeOffsetX = 0;
    shakeOffsetY = 0;
    flashAlpha = 0;
}

// === Spawn helpers ===

export function spawnKillParticles(x, y, color, count = 16) {
    // Main burst in enemy color
    for (let i = 0; i < count; i++) {
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
    const sparkCount = Math.min(5, Math.floor(count / 3));
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

export function spawnDamageNumber(x, y, text, color, size) {
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
    shakeIntensity = Math.max(shakeIntensity, intensity);
    shakeDuration = Math.max(shakeDuration, duration);
}

export function triggerFlash(color = '#FF0000', alpha = 0.4, decay = 3) {
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
