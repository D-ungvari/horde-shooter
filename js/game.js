import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';
import { initInput, resetFrameInput, isKeyDown, getMouse, updateCamera as updateInputCamera } from './input.js';
import { createCamera, updateCamera, screenToWorld } from './camera.js';
import { createPlayer, updatePlayer, damagePlayer } from './player.js';
import { initRenderer, renderGame, drawCrosshair } from './renderer.js';
import { updateWeapons, resetWeaponCooldowns } from './weapons.js';
import { updateProjectiles, getProjectilePool, clearProjectiles } from './projectile.js';
import { updateEnemies, getEnemyPool, clearEnemies, releaseEnemy } from './enemy.js';
import { resetSpawner, updateSpawner } from './spawner.js';
import { clearSpatialHash, insertIntoHash, queryHash, circlesOverlap, distSq } from './physics.js';
import { formatTime } from './utils.js';

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
let lastTime;
let survivalTime;
let escapeHeld = false;

// Pool references
let enemyPool, projectilePool;

export function initGame() {
    canvas = document.getElementById('game-canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx = canvas.getContext('2d');

    camera = createCamera();

    const cameraAPI = {
        screenToWorld: (sx, sy) => screenToWorld(camera, sx, sy),
    };
    initInput(canvas, cameraAPI);
    initRenderer(ctx);

    enemyPool = getEnemyPool();
    projectilePool = getProjectilePool();

    state = STATE.MENU;
    showMenu();
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

function startPlaying() {
    player = createPlayer(0, 0);
    player.weapons.push({ id: 'pistol', level: 1 });

    camera.x = player.x;
    camera.y = player.y;
    survivalTime = 0;

    clearEnemies();
    clearProjectiles();
    resetWeaponCooldowns();
    resetSpawner();

    state = STATE.PLAYING;
    hideAllOverlays();
}

function showMenu() {
    document.getElementById('menu-screen').style.display = 'flex';
}

function hideAllOverlays() {
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('pause-screen').style.display = 'none';
    document.getElementById('gameover-screen').style.display = 'none';
    document.getElementById('levelup-screen').style.display = 'none';
}

function showGameOver() {
    document.getElementById('gameover-screen').style.display = 'flex';
    document.getElementById('final-score').textContent = player.killCount * 100;
    document.getElementById('final-kills').textContent = player.killCount;
    document.getElementById('final-time').textContent = formatTime(survivalTime);
}

function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (state === STATE.MENU) {
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    if (state === STATE.PLAYING) {
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
        render(0);
    } else if (state === STATE.GAME_OVER) {
        render(0);
    }

    resetFrameInput();
    requestAnimationFrame(loop);
}

function update(dt) {
    // Player movement
    updatePlayer(player, dt);

    // Camera follow
    updateCamera(camera, player, dt);
    const cameraAPI = {
        screenToWorld: (sx, sy) => screenToWorld(camera, sx, sy),
    };
    updateInputCamera(cameraAPI);

    // Weapons fire
    const mouse = getMouse();
    if (mouse.down || mouse.clicked) {
        updateWeapons(player, dt);
    } else {
        // Still tick cooldowns even when not firing
        updateWeapons(player, dt);
    }

    // Move projectiles
    updateProjectiles(dt);

    // Enemy spawning + AI
    updateSpawner(player, dt);
    updateEnemies(player, dt);

    // --- Spatial hash collision phase ---
    clearSpatialHash();

    // Insert enemies into hash
    enemyPool.forEach(e => {
        insertIntoHash(e);
    });

    // Projectile vs Enemy collisions
    projectilePool.forEach(p => {
        const nearby = queryHash(p.x, p.y, p.radius + 30);
        for (const e of nearby) {
            if (!e.active) continue;
            if (p.hitSet.has(e._poolIndex)) continue;
            if (circlesOverlap(p, e)) {
                // Hit!
                e.health -= p.damage;
                p.hitSet.add(e._poolIndex);

                if (e.health <= 0) {
                    player.killCount++;
                    // TODO: spawn XP gems, particles, sound
                    releaseEnemy(e);
                }

                // Pierce check
                if (p.pierce <= 0) {
                    projectilePool.release(p);
                    break;
                }
                p.pierce--;
            }
        }
    });

    // Enemy vs Player collisions
    const nearPlayer = queryHash(player.x, player.y, player.radius + 30);
    for (const e of nearPlayer) {
        if (!e.active) continue;
        if (circlesOverlap(player, e)) {
            damagePlayer(player, e.damage);
        }
    }

    // Despawn far enemies
    enemyPool.forEach(e => {
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (dx * dx + dy * dy > 2000 * 2000) {
            releaseEnemy(e);
        }
    });

    // Death check
    if (player.health <= 0) {
        state = STATE.GAME_OVER;
        showGameOver();
    }
}

function render(dt) {
    // Pass pool arrays for rendering
    renderGame(camera, player,
        enemyPool.getAll(),
        projectilePool.getAll(),
        null, // xpGems - TODO
        dt, state);

    // Crosshair
    drawCrosshair(ctx);

    // Timer
    if (survivalTime !== undefined && state !== STATE.MENU) {
        ctx.fillStyle = '#aaa';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(survivalTime), CANVAS_WIDTH / 2, 24);
        ctx.textAlign = 'left';
    }
}

export function getState() { return state; }
window.__startGame = startPlaying;
