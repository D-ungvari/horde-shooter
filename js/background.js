import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';
import { BIOMES } from './biomes.js';
import { randomRange } from './utils.js';

const TILE_SIZE = 64;

// Pre-generate a noise grid for ground variation
const NOISE_SIZE = 64;
const noiseGrid = [];
for (let i = 0; i < NOISE_SIZE * NOISE_SIZE; i++) {
    noiseGrid.push(Math.random());
}

function getNoise(tx, ty) {
    const x = ((tx % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
    const y = ((ty % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
    return noiseGrid[y * NOISE_SIZE + x];
}

// --- Ambient particles (viewport-local, purely visual) ---

const ambientParticles = [];
let currentAmbientBiome = null;

function initAmbient(biomeDef, camera) {
    ambientParticles.length = 0;
    currentAmbientBiome = biomeDef.id;
    const amb = biomeDef.ambient;
    for (let i = 0; i < amb.count; i++) {
        ambientParticles.push(createAmbientParticle(biomeDef, camera, true));
    }
}

function createAmbientParticle(biomeDef, camera, randomAge) {
    const amb = biomeDef.ambient;
    return {
        x: camera.x + randomRange(-CANVAS_WIDTH * 0.6, CANVAS_WIDTH * 0.6),
        y: camera.y + randomRange(-CANVAS_HEIGHT * 0.6, CANVAS_HEIGHT * 0.6),
        size: randomRange(amb.size[0], amb.size[1]),
        alpha: randomRange(amb.alpha * 0.3, amb.alpha),
        speed: randomRange(amb.speed * 0.5, amb.speed),
        angle: randomRange(0, Math.PI * 2),
        phase: randomRange(0, Math.PI * 2),
        age: randomAge ? randomRange(0, 5) : 0,
        maxAge: randomRange(3, 8),
    };
}

export function updateAmbient(camera, biomeId, dt) {
    const biomeDef = BIOMES[biomeId] || BIOMES.graveyard;
    if (currentAmbientBiome !== biomeDef.id) {
        initAmbient(biomeDef, camera);
    }
    const amb = biomeDef.ambient;

    for (let i = ambientParticles.length - 1; i >= 0; i--) {
        const p = ambientParticles[i];
        p.age += dt;

        switch (amb.type) {
            case 'mist':
                // Slow drift
                p.x += Math.cos(p.phase + p.age * 0.3) * p.speed * dt;
                p.y += Math.sin(p.phase + p.age * 0.2) * p.speed * 0.5 * dt;
                break;
            case 'ember':
                // Rise upward with slight sway
                p.y -= p.speed * dt;
                p.x += Math.sin(p.phase + p.age * 2) * 10 * dt;
                break;
            case 'spark':
                // Quick random flicker movement
                p.x += Math.cos(p.angle) * p.speed * dt;
                p.y += Math.sin(p.angle) * p.speed * dt;
                if (Math.random() < 0.05) p.angle = randomRange(0, Math.PI * 2);
                break;
        }

        // Respawn if too far from camera or expired
        const dx = p.x - camera.x;
        const dy = p.y - camera.y;
        if (p.age > p.maxAge || Math.abs(dx) > CANVAS_WIDTH * 0.7 || Math.abs(dy) > CANVAS_HEIGHT * 0.7) {
            ambientParticles[i] = createAmbientParticle(biomeDef, camera, false);
        }
    }
}

export function drawAmbientParticles(ctx, biomeId) {
    const biomeDef = BIOMES[biomeId] || BIOMES.graveyard;
    const amb = biomeDef.ambient;

    for (const p of ambientParticles) {
        const fadeFrac = 1 - Math.abs(p.age / p.maxAge - 0.5) * 2; // fade in/out
        const alpha = p.alpha * Math.max(0, fadeFrac);
        if (alpha < 0.01) continue;

        ctx.globalAlpha = alpha;

        if (amb.type === 'spark') {
            // Draw as small glowing line
            ctx.strokeStyle = amb.color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.x - p.size, p.y);
            ctx.lineTo(p.x + p.size, p.y);
            ctx.stroke();
        } else {
            ctx.fillStyle = amb.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1.0;
}

// --- Background tiles ---

export function drawBackground(ctx, camera, biomeId) {
    const biomeDef = BIOMES[biomeId] || BIOMES.graveyard;
    const tileColors = biomeDef.tileColors;

    const startX = Math.floor((camera.x - camera.halfW) / TILE_SIZE) - 1;
    const startY = Math.floor((camera.y - camera.halfH) / TILE_SIZE) - 1;
    const endX = startX + Math.ceil(CANVAS_WIDTH / TILE_SIZE) + 3;
    const endY = startY + Math.ceil(CANVAS_HEIGHT / TILE_SIZE) + 3;

    for (let tx = startX; tx <= endX; tx++) {
        for (let ty = startY; ty <= endY; ty++) {
            const wx = tx * TILE_SIZE;
            const wy = ty * TILE_SIZE;
            const noise = getNoise(tx, ty);

            // Base tile color
            const colorIdx = Math.floor(noise * tileColors.length);
            ctx.fillStyle = tileColors[colorIdx];
            ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);

            // Subtle grid lines
            ctx.strokeStyle = biomeDef.gridColor;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(wx, wy, TILE_SIZE, TILE_SIZE);

            // Biome-specific detail patches
            if (noise > biomeDef.detailThreshold) {
                if (biomeDef.id === 'volcano') {
                    // Lava crack lines
                    ctx.strokeStyle = biomeDef.detailColor;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(wx + 10 + noise * 30, wy + 10);
                    ctx.lineTo(wx + 30 + noise * 20, wy + 50);
                    ctx.stroke();
                    // Glow
                    ctx.globalAlpha = 0.15;
                    ctx.fillStyle = '#FF4400';
                    ctx.beginPath();
                    ctx.arc(wx + 25 + noise * 10, wy + 30, 10, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                } else if (biomeDef.id === 'void') {
                    // Energy rift — thin glowing line
                    ctx.strokeStyle = biomeDef.detailColor;
                    ctx.lineWidth = 1;
                    const rw = 4 + noise * 20;
                    ctx.beginPath();
                    ctx.moveTo(wx + 15, wy + 20 + noise * 20);
                    ctx.lineTo(wx + 15 + rw, wy + 20 + noise * 20 + (noise - 0.5) * 10);
                    ctx.stroke();
                    // Rift glow
                    ctx.globalAlpha = 0.1;
                    ctx.fillStyle = '#4444FF';
                    ctx.beginPath();
                    ctx.arc(wx + 15 + rw * 0.5, wy + 20 + noise * 20, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                } else {
                    // Moss patch (graveyard default)
                    ctx.fillStyle = biomeDef.detailColor;
                    ctx.beginPath();
                    ctx.arc(wx + TILE_SIZE * 0.5, wy + TILE_SIZE * 0.5, 6 + noise * 8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            if (noise < 0.08) {
                // Small stone / debris
                ctx.fillStyle = biomeDef.stoneColor;
                ctx.beginPath();
                ctx.arc(wx + 20 + noise * 20, wy + 20 + noise * 20, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}
