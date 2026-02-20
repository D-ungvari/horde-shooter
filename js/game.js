import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';
import { initInput, resetFrameInput, isKeyDown, getMouse, updateCamera as updateInputCamera } from './input.js';
import { createCamera, updateCamera, screenToWorld } from './camera.js';
import { createPlayer, updatePlayer, damagePlayer } from './player.js';
import { initRenderer, renderGame, drawCrosshair } from './renderer.js';
import { updateWeapons, resetWeaponCooldowns, getOrbitalPositions } from './weapons.js';
import { updateProjectiles, getProjectilePool, clearProjectiles } from './projectile.js';
import { updateEnemies, getEnemyPool, clearEnemies, releaseEnemy, triggerExplosion } from './enemy.js';
import { resetSpawner, updateSpawner, getAnnouncements } from './spawner.js';
import { clearSpatialHash, insertIntoHash, queryHash, circlesOverlap } from './physics.js';
import { spawnXPBurst, updateXPGems, getXPPool, clearXPGems } from './xp.js';
import { grantXP, recalculateStats } from './stats.js';
import { showLevelUpScreen, hideLevelUpScreen } from './levelUp.js';
import { formatTime } from './utils.js';
import { updateEffects, resetEffects,
    spawnKillParticles, spawnBossDeathParticles, spawnHitParticles,
    spawnXPPickupFlash, spawnDamageNumber,
    triggerShake, triggerFlash } from './effects.js';
import { playEnemyHit, playEnemyDeath, playBossDeath,
    playPlayerHit, playPlayerDeath, playLevelUp, playXPPickup,
    playBossWarning, playExplosion } from './audio.js';

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
let pendingLevelUps = 0;

// Announcements
let activeAnnouncement = null;
let announcementTimer = 0;

// Pool references
let enemyPool, projectilePool, xpPool;

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
    xpPool = getXPPool();

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
    pendingLevelUps = 0;

    clearEnemies();
    clearProjectiles();
    clearXPGems();
    resetWeaponCooldowns();
    resetSpawner();
    resetEffects();
    recalculateStats(player);

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
    document.getElementById('final-score').textContent = player.killCount * 100 + (player.level - 1) * 50;
    document.getElementById('final-kills').textContent = player.killCount;
    document.getElementById('final-time').textContent = formatTime(survivalTime);

    const levelEl = document.getElementById('final-level');
    if (levelEl) levelEl.textContent = player.level;
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

            if (pendingLevelUps > 0) {
                triggerLevelUp();
            }
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
    } else if (state === STATE.LEVEL_UP) {
        render(0);
    } else if (state === STATE.GAME_OVER) {
        render(0);
    }

    resetFrameInput();
    requestAnimationFrame(loop);
}

async function triggerLevelUp() {
    state = STATE.LEVEL_UP;
    playLevelUp();

    while (pendingLevelUps > 0) {
        pendingLevelUps--;
        await showLevelUpScreen(player);
    }

    state = STATE.PLAYING;
    lastTime = performance.now();
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

    // Weapons fire (always tick cooldowns)
    updateWeapons(player, dt);

    // Move projectiles (pass player for boomerang return)
    updateProjectiles(dt, player);

    // Enemy spawning + AI
    updateSpawner(player, dt);
    updateEnemies(player, dt);

    // Process announcements
    const newAnnouncements = getAnnouncements();
    if (newAnnouncements.length > 0) {
        activeAnnouncement = newAnnouncements[newAnnouncements.length - 1].text;
        announcementTimer = 2.5;
        if (activeAnnouncement.includes('BOSS') || activeAnnouncement.includes('FINAL')) {
            playBossWarning();
        }
    }
    if (announcementTimer > 0) {
        announcementTimer -= dt;
        if (announcementTimer <= 0) {
            activeAnnouncement = null;
        }
    }

    // XP gem magnet + collection
    const collectedXP = updateXPGems(player, dt);
    if (collectedXP > 0) {
        playXPPickup();
        spawnXPPickupFlash(player.x, player.y);
        const levelUps = grantXP(player, collectedXP);
        if (levelUps > 0) {
            pendingLevelUps += levelUps;
        }
    }

    // Update effects (particles, damage numbers, screen shake)
    updateEffects(dt);

    // --- Spatial hash collision phase ---
    clearSpatialHash();

    // Insert enemies into hash
    enemyPool.forEach(e => {
        insertIntoHash(e);
    });

    // Player projectile vs Enemy collisions
    projectilePool.forEach(p => {
        // Skip enemy projectiles — they hit the player, not enemies
        if (p.type === 'enemy') return;
        // Skip visual-only projectiles
        if (p.type === 'lightning' || p.type === 'frostburst') return;
        if (p.damage <= 0) return;

        const nearby = queryHash(p.x, p.y, p.radius + 30);
        for (const e of nearby) {
            if (!e.active) continue;
            if (p.hitSet.has(e._poolIndex)) continue;
            if (circlesOverlap(p, e)) {
                e.health -= p.damage;
                p.hitSet.add(e._poolIndex);

                // Hit effects
                spawnHitParticles(e.x, e.y, e.color);
                spawnDamageNumber(e.x, e.y, Math.round(p.damage));

                if (e.health <= 0) {
                    player.killCount++;

                    // Death effects + audio
                    if (e.isBoss) {
                        spawnBossDeathParticles(e.x, e.y, e.color);
                        playBossDeath();
                        triggerShake(8, 0.4);
                        triggerFlash('#FFFFFF', 0.3, 2);
                    } else {
                        spawnKillParticles(e.x, e.y, e.color);
                        playEnemyDeath();
                    }

                    // Exploder death AoE
                    if (e.type === 'exploder' && e.explosionRadius > 0) {
                        playExplosion();
                        triggerShake(5, 0.2);
                        const explosionDmg = triggerExplosion(e, player);
                        if (explosionDmg > 0) {
                            damagePlayer(player, explosionDmg);
                        }
                    }

                    spawnXPBurst(e.x, e.y, e.xpValue);
                    releaseEnemy(e);
                } else {
                    playEnemyHit();
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

    // Enemy projectile vs Player collisions
    projectilePool.forEach(p => {
        if (p.type !== 'enemy') return;
        const dx = p.x - player.x;
        const dy = p.y - player.y;
        const radSum = p.radius + player.radius;
        if (dx * dx + dy * dy < radSum * radSum) {
            const hit = damagePlayer(player, p.damage);
            if (hit) {
                triggerShake(3, 0.15);
                triggerFlash('#FF0000', 0.2, 3);
                playPlayerHit();
                spawnDamageNumber(player.x, player.y, Math.round(p.damage), '#FF4444', 16);
                projectilePool.release(p);
            }
        }
    });

    // Enemy vs Player body collisions
    const nearPlayer = queryHash(player.x, player.y, player.radius + 30);
    for (const e of nearPlayer) {
        if (!e.active) continue;
        if (circlesOverlap(player, e)) {
            const hit = damagePlayer(player, e.damage);
            if (hit) {
                triggerShake(3, 0.15);
                triggerFlash('#FF0000', 0.15, 3);
                playPlayerHit();
            }
        }
    }

    // Despawn far enemies (never despawn bosses)
    enemyPool.forEach(e => {
        if (e.isBoss) return;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (dx * dx + dy * dy > 2000 * 2000) {
            releaseEnemy(e);
        }
    });

    // Death check
    if (player.health <= 0) {
        triggerShake(10, 0.5);
        triggerFlash('#FF0000', 0.5, 1.5);
        playPlayerDeath();
        state = STATE.GAME_OVER;
        showGameOver();
    }
}

function render(dt) {
    // Get orbital positions for rendering
    const orbitals = player ? getOrbitalPositions(player) : [];

    renderGame(camera, player,
        enemyPool.getAll(),
        projectilePool.getAll(),
        xpPool.getAll(),
        dt, state, orbitals);

    // Crosshair
    if (state === STATE.PLAYING || state === STATE.PAUSED) {
        drawCrosshair(ctx);
    }

    // Timer
    if (survivalTime !== undefined && state !== STATE.MENU) {
        ctx.fillStyle = '#aaa';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(survivalTime), CANVAS_WIDTH / 2, 24);
        ctx.textAlign = 'left';
    }

    // Boss health bar (top center, below timer)
    if (state === STATE.PLAYING || state === STATE.PAUSED) {
        enemyPool.forEach(e => {
            if (!e.isBoss) return;
            const barW = 300;
            const barH = 12;
            const bx = (CANVAS_WIDTH - barW) / 2;
            const by = 36;
            // Background
            ctx.fillStyle = '#222';
            ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
            // Health
            const hpRatio = Math.max(0, e.health / e.maxHealth);
            ctx.fillStyle = '#FF4444';
            ctx.fillRect(bx, by, barW * hpRatio, barH);
            // Border
            ctx.strokeStyle = '#FF6666';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx - 1, by - 1, barW + 2, barH + 2);
            // Name
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(e.type.replace(/_/g, ' ').toUpperCase(), CANVAS_WIDTH / 2, by + barH + 14);
            ctx.textAlign = 'left';
        });
    }

    // Announcement text
    if (activeAnnouncement && announcementTimer > 0) {
        const fade = Math.min(announcementTimer / 0.5, 1);
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(activeAnnouncement, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1.0;
    }
}

export function getState() { return state; }
window.__startGame = startPlaying;
