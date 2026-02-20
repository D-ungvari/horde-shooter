import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';
import { initInput, resetFrameInput, isKeyDown, updateCamera as updateInputCamera } from './input.js';
import { createCamera, updateCamera, screenToWorld } from './camera.js';
import { createPlayer, updatePlayer } from './player.js';
import { initRenderer, renderGame, drawCrosshair } from './renderer.js';

const STATE = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    LEVEL_UP: 'LEVEL_UP',
    DYING: 'DYING',
    GAME_OVER: 'GAME_OVER',
};

let canvas, ctx;
let state;
let player, camera;
let enemies, projectiles, xpGems;
let lastTime;
let survivalTime;
let escapeHeld = false;

export function initGame() {
    canvas = document.getElementById('game-canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx = canvas.getContext('2d');

    camera = createCamera();

    // Pass camera methods to input for screen-to-world conversion
    const cameraAPI = {
        screenToWorld: (sx, sy) => screenToWorld(camera, sx, sy),
    };
    initInput(canvas, cameraAPI);
    initRenderer(ctx);

    state = STATE.MENU;
    showMenu();
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

function startPlaying() {
    player = createPlayer(0, 0);
    // Give starting weapon: pistol
    player.weapons.push({ id: 'pistol', level: 1 });

    camera.x = player.x;
    camera.y = player.y;
    enemies = [];
    projectiles = [];
    xpGems = [];
    survivalTime = 0;
    state = STATE.PLAYING;
    hideMenu();
}

function showMenu() {
    document.getElementById('menu-screen').style.display = 'flex';
}

function hideMenu() {
    document.getElementById('menu-screen').style.display = 'none';
}

function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (state === STATE.MENU) {
        // Draw a static background for the menu
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    if (state === STATE.PLAYING) {
        // Pause check
        if (isKeyDown('escape') && !escapeHeld) {
            escapeHeld = true;
            state = STATE.PAUSED;
            document.getElementById('pause-screen').style.display = 'flex';
        }
        if (!isKeyDown('escape')) escapeHeld = false;

        if (state === STATE.PLAYING) {
            survivalTime += dt;
            update(dt);
            render(dt);
        }
    } else if (state === STATE.PAUSED) {
        if (isKeyDown('escape') && !escapeHeld) {
            escapeHeld = true;
            document.getElementById('pause-screen').style.display = 'none';
            state = STATE.PLAYING;
            lastTime = performance.now();
        }
        if (!isKeyDown('escape')) escapeHeld = false;
        // Still render the paused frame
        render(dt);
    } else if (state === STATE.DYING) {
        // TODO: death animation
    } else if (state === STATE.GAME_OVER) {
        // TODO: game over screen
    }

    resetFrameInput();
    requestAnimationFrame(loop);
}

function update(dt) {
    updatePlayer(player, dt);

    // Update camera to follow player
    updateCamera(camera, player, dt);

    // Update input camera reference for mouse world conversion
    const cameraAPI = {
        screenToWorld: (sx, sy) => screenToWorld(camera, sx, sy),
    };
    updateInputCamera(cameraAPI);

    // TODO: weapon firing, projectiles, enemies, spawner, XP, collisions
}

function render(dt) {
    renderGame(camera, player, enemies, projectiles, xpGems, dt, state);

    // Crosshair (screen space)
    drawCrosshair(ctx);

    // Survival timer (screen space)
    if (survivalTime !== undefined) {
        const m = Math.floor(survivalTime / 60);
        const s = Math.floor(survivalTime % 60);
        ctx.fillStyle = '#aaa';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${m}:${s.toString().padStart(2, '0')}`, CANVAS_WIDTH / 2, 24);
        ctx.textAlign = 'left';
    }
}

// --- Public functions for menu/UI wiring ---

export function getState() { return state; }

// Called from UI
window.__startGame = startPlaying;
