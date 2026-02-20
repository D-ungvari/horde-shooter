import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

const TILE_SIZE = 64;
const GRASS_COLORS = ['#1a2a1a', '#1e2e1e', '#1c2c1c', '#182818'];

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

export function drawBackground(ctx, camera, biome) {
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
            const colorIdx = Math.floor(noise * GRASS_COLORS.length);
            ctx.fillStyle = GRASS_COLORS[colorIdx];
            ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);

            // Subtle grid lines
            ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(wx, wy, TILE_SIZE, TILE_SIZE);

            // Occasional moss/stone details
            if (noise > 0.85) {
                ctx.fillStyle = 'rgba(60, 80, 60, 0.4)';
                ctx.beginPath();
                ctx.arc(wx + TILE_SIZE * 0.5, wy + TILE_SIZE * 0.5, 6 + noise * 8, 0, Math.PI * 2);
                ctx.fill();
            }

            if (noise < 0.08) {
                // Small stone
                ctx.fillStyle = '#2a2a2a';
                ctx.beginPath();
                ctx.arc(wx + 20 + noise * 20, wy + 20 + noise * 20, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}
