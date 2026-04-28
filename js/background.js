import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';
import { BIOMES } from './biomes.js';
import { randomRange } from './utils.js';
import { getActiveHazards } from './hazards.js';

const TILE_SIZE = 64;

function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    return `rgba(${r},${g},${b},${a})`;
}

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

// Second noise lookup offset for variety
function getNoise2(tx, ty) {
    return getNoise(tx + 100, ty + 100);
}
function getNoise3(tx, ty) {
    return getNoise(tx + 47, ty + 213);
}

// --- Graveyard props ---

function drawGraveyardProps(ctx, wx, wy, n, n2, n3, propColors) {
    // Tombstone: ~1 per 8 tiles (n > 0.88)
    if (n > 0.88) {
        const tx0 = wx + 20 + n2 * 24;
        const ty0 = wy + 18 + n3 * 20;
        // Tombstone body (rounded rect approximation)
        ctx.fillStyle = propColors.stone;
        ctx.beginPath();
        ctx.moveTo(tx0 - 4, ty0 + 12);
        ctx.lineTo(tx0 - 4, ty0 + 2);
        ctx.quadraticCurveTo(tx0 - 4, ty0 - 2, tx0, ty0 - 2);
        ctx.quadraticCurveTo(tx0 + 4, ty0 - 2, tx0 + 4, ty0 + 2);
        ctx.lineTo(tx0 + 4, ty0 + 12);
        ctx.closePath();
        ctx.fill();
        // Highlight edge
        ctx.strokeStyle = propColors.stoneHighlight;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(tx0 - 4, ty0 + 12);
        ctx.lineTo(tx0 - 4, ty0 + 2);
        ctx.quadraticCurveTo(tx0 - 4, ty0 - 2, tx0, ty0 - 2);
        ctx.stroke();
        // Cross on top
        ctx.strokeStyle = propColors.stoneHighlight;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx0, ty0);
        ctx.lineTo(tx0, ty0 + 7);
        ctx.moveTo(tx0 - 2.5, ty0 + 2.5);
        ctx.lineTo(tx0 + 2.5, ty0 + 2.5);
        ctx.stroke();
        return; // tombstone is the main prop for this tile
    }

    // Cracked ground: n > 0.75 && n < 0.82
    if (n > 0.75 && n < 0.82) {
        ctx.strokeStyle = propColors.crack;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.6;
        const cx = wx + 10 + n2 * 44;
        const cy = wy + 10 + n3 * 44;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 8 + n * 10, cy + 5 - n2 * 10);
        ctx.lineTo(cx + 14 + n2 * 8, cy + 2 + n3 * 8);
        ctx.stroke();
        // branch crack
        ctx.beginPath();
        ctx.moveTo(cx + 8 + n * 10, cy + 5 - n2 * 10);
        ctx.lineTo(cx + 6 + n3 * 12, cy + 12 + n * 6);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    // Bone fragments: n2 > 0.85 && n2 < 0.92
    if (n2 > 0.85 && n2 < 0.92) {
        ctx.strokeStyle = propColors.detail2;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.12;
        const bx = wx + 8 + n3 * 40;
        const by = wy + 30 + n * 20;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + 5 + n * 4, by + 2 - n2 * 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + 3, by + 4);
        ctx.lineTo(bx + 7, by + 2 + n3 * 3);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    // Dead grass tufts: n3 > 0.8
    if (n3 > 0.8) {
        ctx.strokeStyle = propColors.detail1;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.5;
        const gx = wx + n * 50 + 6;
        const gy = wy + TILE_SIZE - 4 + n2 * 4;
        for (let i = 0; i < 3; i++) {
            const angle = -Math.PI * 0.5 + (i - 1) * 0.35 + (n2 - 0.5) * 0.3;
            ctx.beginPath();
            ctx.moveTo(gx + i * 3, gy);
            ctx.lineTo(gx + i * 3 + Math.cos(angle) * 5, gy + Math.sin(angle) * 5);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }

    // Fog wisps: n > 0.55 && n < 0.6
    if (n > 0.55 && n < 0.6) {
        ctx.fillStyle = propColors.glow;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.ellipse(wx + 10 + n2 * 40, wy + 45 + n3 * 10, 18 + n * 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Moss patch (kept from original but with threshold check)
    if (n > 0.85) {
        ctx.fillStyle = 'rgba(60, 80, 60, 0.4)';
        ctx.beginPath();
        ctx.arc(wx + TILE_SIZE * 0.5, wy + TILE_SIZE * 0.5, 6 + n * 8, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- Volcano props ---

function drawVolcanoProps(ctx, wx, wy, n, n2, n3, propColors) {
    // Lava cracks (enhanced from original): n > 0.82
    if (n > 0.82) {
        ctx.strokeStyle = propColors.crack;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(wx + 10 + n * 30, wy + 10);
        ctx.lineTo(wx + 30 + n * 20, wy + 50);
        ctx.stroke();
        // Wider glow around crack
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = propColors.glow;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(wx + 10 + n * 30, wy + 10);
        ctx.lineTo(wx + 30 + n * 20, wy + 50);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 1;
    }

    // Lava pools: n > 0.92
    if (n > 0.92) {
        const px = wx + 15 + n2 * 30;
        const py = wy + 20 + n3 * 20;
        const pr = 4 + n * 5;
        // Outer glow
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = propColors.glow;
        ctx.beginPath();
        ctx.arc(px, py, pr + 4, 0, Math.PI * 2);
        ctx.fill();
        // Pool
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = propColors.lava;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        // Bright center
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#FF8844';
        ctx.beginPath();
        ctx.arc(px, py, pr * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Cooled rock formations: n2 > 0.82 && n2 < 0.9
    if (n2 > 0.82 && n2 < 0.9) {
        ctx.fillStyle = propColors.stone;
        ctx.globalAlpha = 0.7;
        const rx = wx + 6 + n * 40;
        const ry = wy + 10 + n3 * 35;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + 4 + n2 * 3, ry - 3);
        ctx.lineTo(rx + 7 + n * 4, ry + 1);
        ctx.lineTo(rx + 3, ry + 4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Ash piles: n3 > 0.85
    if (n3 > 0.85) {
        ctx.fillStyle = propColors.detail2;
        ctx.globalAlpha = 0.25;
        const ax = wx + 20 + n * 24;
        const ay = wy + 40 + n2 * 15;
        ctx.beginPath();
        ctx.arc(ax, ay, 5 + n3 * 3, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Obsidian shards: n > 0.65 && n < 0.7
    if (n > 0.65 && n < 0.7) {
        const sx = wx + 35 + n2 * 20;
        const sy = wy + 15 + n3 * 30;
        ctx.fillStyle = propColors.obsidian;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 3, sy - 6);
        ctx.lineTo(sx + 5, sy - 1);
        ctx.lineTo(sx + 2, sy + 2);
        ctx.closePath();
        ctx.fill();
        // Slight purple sheen highlight
        ctx.strokeStyle = '#3a1a5a';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx + 3, sy - 6);
        ctx.lineTo(sx + 5, sy - 1);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    // Ember glow spots: n2 > 0.7 && n2 < 0.76
    if (n2 > 0.7 && n2 < 0.76) {
        ctx.fillStyle = propColors.glow;
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.arc(wx + 30 + n * 20, wy + 30 + n3 * 20, 8 + n2 * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// --- Void props ---

function drawVoidProps(ctx, wx, wy, n, n2, n3, propColors) {
    // Crystal formations: n > 0.88
    if (n > 0.88) {
        const cx = wx + 20 + n2 * 24;
        const cy = wy + 15 + n3 * 25;
        const csize = 4 + n * 5;
        // Glow behind crystal
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = propColors.glow;
        ctx.beginPath();
        ctx.arc(cx, cy, csize + 4, 0, Math.PI * 2);
        ctx.fill();
        // Crystal body (diamond)
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = propColors.crystal;
        ctx.beginPath();
        ctx.moveTo(cx, cy - csize);
        ctx.lineTo(cx + csize * 0.6, cy);
        ctx.lineTo(cx, cy + csize * 0.7);
        ctx.lineTo(cx - csize * 0.6, cy);
        ctx.closePath();
        ctx.fill();
        // Bright edge
        ctx.strokeStyle = propColors.detail1;
        ctx.lineWidth = 0.7;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - csize);
        ctx.lineTo(cx + csize * 0.6, cy);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Second smaller crystal if noise allows
        if (n2 > 0.5) {
            const cx2 = cx + 6 + n3 * 4;
            const cy2 = cy + 3;
            const cs2 = csize * 0.5;
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = propColors.detail2;
            ctx.beginPath();
            ctx.moveTo(cx2, cy2 - cs2);
            ctx.lineTo(cx2 + cs2 * 0.5, cy2);
            ctx.lineTo(cx2, cy2 + cs2 * 0.5);
            ctx.lineTo(cx2 - cs2 * 0.5, cy2);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
        return;
    }

    // Enhanced void rifts: n > 0.80 && n < 0.88
    if (n > 0.80) {
        ctx.strokeStyle = propColors.glow;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5;
        const rw = 6 + n * 20;
        const ry = wy + 20 + n * 20;
        // Jagged rift line
        ctx.beginPath();
        ctx.moveTo(wx + 12, ry);
        ctx.lineTo(wx + 12 + rw * 0.3, ry + (n2 - 0.5) * 8);
        ctx.lineTo(wx + 12 + rw * 0.6, ry - (n3 - 0.5) * 6);
        ctx.lineTo(wx + 12 + rw, ry + (n - 0.5) * 10);
        ctx.stroke();
        // Bright edge glow
        ctx.strokeStyle = '#8888FF';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(wx + 12, ry - 1);
        ctx.lineTo(wx + 12 + rw * 0.3, ry + (n2 - 0.5) * 8 - 1);
        ctx.lineTo(wx + 12 + rw * 0.6, ry - (n3 - 0.5) * 6 - 1);
        ctx.lineTo(wx + 12 + rw, ry + (n - 0.5) * 10 - 1);
        ctx.stroke();
        // Rift glow area
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = propColors.glow;
        ctx.beginPath();
        ctx.arc(wx + 12 + rw * 0.5, ry, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Floating debris: n2 > 0.85
    if (n2 > 0.85) {
        ctx.globalAlpha = 0.30 + n3 * 0.15;
        ctx.fillStyle = propColors.stone;
        const dx = wx + 10 + n * 40;
        const dy = wy + 10 + n3 * 40;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(n2 * Math.PI * 0.5);
        ctx.fillRect(-2.5, -2.5, 5, 5);
        ctx.restore();
        ctx.globalAlpha = 1.0;
    }

    // Rune circles: n > 0.4 && n < 0.44
    if (n > 0.4 && n < 0.44) {
        ctx.strokeStyle = propColors.rune;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.22;
        const rcx = wx + TILE_SIZE * 0.5;
        const rcy = wy + TILE_SIZE * 0.5;
        const rr = 8 + n2 * 6;
        // Outer circle
        ctx.beginPath();
        ctx.arc(rcx, rcy, rr, 0, Math.PI * 2);
        ctx.stroke();
        // Inner circle
        ctx.beginPath();
        ctx.arc(rcx, rcy, rr * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        // Radial lines (4 of them)
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + n3 * Math.PI;
            ctx.beginPath();
            ctx.moveTo(rcx + Math.cos(a) * rr * 0.5, rcy + Math.sin(a) * rr * 0.5);
            ctx.lineTo(rcx + Math.cos(a) * rr, rcy + Math.sin(a) * rr);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }

    // Star-like ground sparkles: n3 > 0.88
    if (n3 > 0.88) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.15 + n * 0.1;
        const sx = wx + 8 + n2 * 48;
        const sy = wy + 8 + n * 48;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        ctx.fill();
        // Second sparkle on some tiles
        if (n2 > 0.92) {
            ctx.beginPath();
            ctx.arc(sx + 15 + n3 * 10, sy + 10 - n * 8, 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }
}

// --- Tile color variation ---

function drawTileVariation(ctx, wx, wy, n, n2, tileColors) {
    // Draw a subtle shade variation circle/rect within the tile
    // This breaks up the perfectly uniform tile squares
    const varAlpha = 0.08 + n2 * 0.08;
    ctx.globalAlpha = varAlpha;
    const altIdx = Math.floor(n2 * tileColors.length);
    ctx.fillStyle = tileColors[altIdx];
    const vx = wx + 8 + n * 40;
    const vy = wy + 8 + n2 * 40;
    if (n > 0.5) {
        // Circle variation
        ctx.beginPath();
        ctx.arc(vx, vy, 10 + n * 8, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Rect variation
        ctx.fillRect(vx - 8, vy - 6, 16 + n2 * 10, 12 + n * 8);
    }
    ctx.globalAlpha = 1.0;
}

function drawLavaHazard(ctx, h) {
    const t = h.life / h.maxLife;
    const pulse = 0.65 + Math.sin((h.life * 9) + h.intensity) * 0.35;

    ctx.globalAlpha = (1 - t) * 0.55;
    ctx.strokeStyle = '#FF5522';
    ctx.lineWidth = 2 + pulse * 2;
    ctx.beginPath();
    const seg = 8;
    for (let i = 0; i <= seg; i++) {
        const p = i / seg;
        const x = h.x - h.radius + p * h.radius * 2;
        const y = h.y + Math.sin((p * Math.PI * 3) + h.intensity * 2) * (h.radius * 0.25);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.globalAlpha = (1 - t) * 0.2;
    ctx.fillStyle = '#FFAA44';
    for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = randomRange(0, h.radius * 0.45);
        ctx.beginPath();
        ctx.arc(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r, randomRange(1, 2.2), 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawFogHazard(ctx, h) {
    const t = h.life / h.maxLife;
    const alpha = (1 - t) * 0.22;
    const puffs = 6;
    for (let i = 0; i < puffs; i++) {
        const ang = (Math.PI * 2 / puffs) * i + h.life * 0.25;
        const r = h.radius * (0.35 + (i % 2) * 0.18);
        const px = h.x + Math.cos(ang) * (h.radius * 0.3);
        const py = h.y + Math.sin(ang) * (h.radius * 0.24);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#B4B8B4';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawRiftHazard(ctx, h) {
    const t = h.life / h.maxLife;
    const fade = 1 - t;
    const spin = h.life * 3;

    ctx.globalAlpha = fade * 0.42;
    ctx.fillStyle = '#1C103A';
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#8D7BFF';
    ctx.lineWidth = 2;
    ctx.globalAlpha = fade * 0.7;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * (0.4 + i * 0.22), spin + i, spin + i + Math.PI * 1.1);
        ctx.stroke();
    }

    ctx.globalAlpha = fade * 0.35;
    ctx.fillStyle = '#EEE8FF';
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
}

function drawHazards(ctx) {
    const hazards = getActiveHazards();
    for (let i = 0; i < hazards.length; i++) {
        const h = hazards[i];
        if (h.type === 'lava_crack') {
            drawLavaHazard(ctx, h);
        } else if (h.type === 'graveyard_fog') {
            drawFogHazard(ctx, h);
        } else if (h.type === 'void_rift') {
            drawRiftHazard(ctx, h);
        }
    }
    ctx.globalAlpha = 1.0;
}

export function drawBackground(ctx, camera, biomeId) {
    const biomeDef = BIOMES[biomeId] || BIOMES.graveyard;
    const tileColors = biomeDef.tileColors;
    const propColors = biomeDef.propColors;

    const startX = Math.floor((camera.x - camera.halfW) / TILE_SIZE) - 1;
    const startY = Math.floor((camera.y - camera.halfH) / TILE_SIZE) - 1;
    const endX = startX + Math.ceil(CANVAS_WIDTH / TILE_SIZE) + 3;
    const endY = startY + Math.ceil(CANVAS_HEIGHT / TILE_SIZE) + 3;

    for (let tx = startX; tx <= endX; tx++) {
        for (let ty = startY; ty <= endY; ty++) {
            const wx = tx * TILE_SIZE;
            const wy = ty * TILE_SIZE;
            const n = getNoise(tx, ty);
            const n2 = getNoise2(tx, ty);
            const n3 = getNoise3(tx, ty);

            // Base tile color
            const colorIdx = Math.floor(n * tileColors.length);
            ctx.fillStyle = tileColors[colorIdx];
            ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);

            // Subtle intra-tile color variation
            drawTileVariation(ctx, wx, wy, n, n2, tileColors);

            // Subtle grid lines
            ctx.strokeStyle = biomeDef.gridColor;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(wx, wy, TILE_SIZE, TILE_SIZE);

            // Small stone / debris (shared across biomes)
            if (n < 0.08) {
                ctx.fillStyle = biomeDef.stoneColor;
                ctx.beginPath();
                ctx.arc(wx + 20 + n * 20, wy + 20 + n * 20, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Biome-specific environmental props
            if (biomeDef.id === 'graveyard') {
                drawGraveyardProps(ctx, wx, wy, n, n2, n3, propColors);
            } else if (biomeDef.id === 'volcano') {
                drawVolcanoProps(ctx, wx, wy, n, n2, n3, propColors);
            } else if (biomeDef.id === 'void') {
                drawVoidProps(ctx, wx, wy, n, n2, n3, propColors);
            }
        }
    }

    // Atmospheric fog overlay (biome-tinted depth)
    const fogColor = biomeDef.propColors.glow || '#446644';
    const cx = camera.x, cy = camera.y;
    const fogGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.7);
    fogGrad.addColorStop(0, 'rgba(0,0,0,0)');
    fogGrad.addColorStop(1, hexToRgba(fogColor, 0.18));
    ctx.fillStyle = fogGrad;
    ctx.fillRect(cx - CANVAS_WIDTH, cy - CANVAS_HEIGHT, CANVAS_WIDTH * 2, CANVAS_HEIGHT * 2);

    drawHazards(ctx);
}
