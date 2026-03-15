import { CANVAS_WIDTH, CANVAS_HEIGHT, HIT_FLASH_DURATION, HIT_STOP_DURATION, HIT_STOP_BOSS_DURATION, HIT_STOP_MAX } from './constants.js';
import { initInput, resetFrameInput, isKeyDown, getMouse, updateCamera as updateInputCamera } from './input.js';
import { createCamera, updateCamera, screenToWorld } from './camera.js';
import { createPlayer, updatePlayer, damagePlayer } from './player.js';
import { initRenderer, renderGame, drawCrosshair } from './renderer.js';
import { updateWeapons, resetWeaponCooldowns, getOrbitalPositions, spawnPlagueSpread } from './weapons.js';
import { updateProjectiles, getProjectilePool, clearProjectiles } from './projectile.js';
import { updateEnemies, getEnemyPool, clearEnemies, releaseEnemy, triggerExplosion, applyKnockback, applyCrowdPush } from './enemy.js';
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
import { updateAmbient } from './background.js';
import { BIOMES, BIOME_LIST } from './biomes.js';
import { loadMeta, getGold, awardEndOfRun, isBiomeUnlocked,
    META_UPGRADES, getUpgradeLevel, getUpgradeCost, purchaseUpgrade } from './meta.js';
import { saveRun, loadRun, clearRunSave, hasSavedRun } from './save.js';

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
let currentBiome = 'graveyard';
let hitStopTimer = 0;

// Announcements
let activeAnnouncement = null;
let announcementTimer = 0;

// Pool references
let enemyPool, projectilePool, xpPool;

export function initGame() {
    canvas = document.getElementById('game-canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    camera = createCamera();

    const cameraAPI = {
        screenToWorld: (sx, sy) => screenToWorld(camera, sx, sy),
    };
    initInput(canvas, cameraAPI);
    initRenderer(ctx);

    enemyPool = getEnemyPool();
    projectilePool = getProjectilePool();
    xpPool = getXPPool();

    loadMeta();
    state = STATE.MENU;
    showMenu();
    updateMenuGold();
    updateBiomeLocks();
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

function startPlaying() {
    clearRunSave(); // Clear any saved run when starting fresh
    player = createPlayer(0, 0);
    player.weapons.push({ id: 'pistol', level: 1 });

    camera.x = player.x;
    camera.y = player.y;
    survivalTime = 0;
    pendingLevelUps = 0;
    hitStopTimer = 0;

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

function resumeRun() {
    const saved = loadRun();
    if (!saved) return startPlaying(); // fallback

    clearRunSave();

    player = createPlayer(saved.player.x, saved.player.y);
    player.health = saved.player.health;
    player.maxHealth = saved.player.maxHealth;
    player.level = saved.player.level;
    player.xp = saved.player.xp;
    player.xpToNext = saved.player.xpToNext;
    player.killCount = saved.player.killCount;
    player.weapons = saved.player.weapons.map(w => ({ id: w.id, level: w.level }));
    player.passives = saved.player.passives.map(p => ({ id: p.id, level: p.level }));

    currentBiome = saved.biome || 'graveyard';
    survivalTime = saved.survivalTime || 0;
    pendingLevelUps = 0;
    hitStopTimer = 0;

    camera.x = player.x;
    camera.y = player.y;

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

    // Show/hide Continue button based on save existence
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
        continueBtn.style.display = hasSavedRun() ? 'inline-block' : 'none';
    }
}

function hideAllOverlays() {
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('pause-screen').style.display = 'none';
    document.getElementById('gameover-screen').style.display = 'none';
    document.getElementById('levelup-screen').style.display = 'none';
    document.getElementById('shop-screen').style.display = 'none';
    const unlockEl = document.getElementById('unlock-msg');
    if (unlockEl) unlockEl.style.display = 'none';
}

function showGameOver() {
    clearRunSave(); // Clear save on death
    // Award gold and check biome unlocks
    const result = awardEndOfRun(player.killCount, survivalTime, player.level, currentBiome);

    document.getElementById('gameover-screen').style.display = 'flex';
    document.getElementById('final-score').textContent = player.killCount * 100 + (player.level - 1) * 50;
    document.getElementById('final-kills').textContent = player.killCount;
    document.getElementById('final-time').textContent = formatTime(survivalTime);

    const levelEl = document.getElementById('final-level');
    if (levelEl) levelEl.textContent = player.level;

    const goldEl = document.getElementById('final-gold');
    if (goldEl) goldEl.textContent = `+${result.goldEarned}`;

    if (result.newUnlock) {
        const unlockEl = document.getElementById('unlock-msg');
        if (unlockEl) {
            const biomeName = BIOMES[result.newUnlock]?.name || result.newUnlock;
            unlockEl.textContent = `NEW BIOME UNLOCKED: ${biomeName}!`;
            unlockEl.style.display = 'block';
        }
    }
}

function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (state === STATE.MENU) {
        const biomeDef = BIOMES[currentBiome] || BIOMES.graveyard;
        ctx.fillStyle = biomeDef.bgColor;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    if (state === STATE.PLAYING) {
        if (isKeyDown('escape') && !escapeHeld) {
            escapeHeld = true;
            state = STATE.PAUSED;
            document.getElementById('pause-screen').style.display = 'flex';
            // Auto-save on pause
            saveRun({ player, survivalTime, biome: currentBiome });
        }
        if (!isKeyDown('escape')) escapeHeld = false;

        if (state === STATE.PLAYING) {
            // Hit-stop: freeze gameplay but keep rendering
            if (hitStopTimer > 0) {
                hitStopTimer -= dt;
                render(0);
            } else {
                survivalTime += dt;
                update(dt);
                render(dt);
            }

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

    // Ambient biome particles
    updateAmbient(camera, currentBiome, dt);

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

    // Crowd-push (knocked-back enemies push neighbors)
    applyCrowdPush();

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
                e.hitFlashTimer = HIT_FLASH_DURATION;
                p.hitSet.add(e._poolIndex);

                // Knockback (skip for DOT zones — they tick, not impact)
                if (p.knockbackDist > 0 && p.type !== 'frostdot' && p.type !== 'firezone' && p.type !== 'plaguezone' && p.type !== 'zone') {
                    applyKnockback(e, p.x, p.y, p.knockbackDist, p.knockbackSpeed);
                }

                // Hit effects (skip for DOT zones to avoid particle spam)
                if (p.type !== 'frostdot' && p.type !== 'firezone' && p.type !== 'plaguezone') {
                    spawnHitParticles(e.x, e.y, e.color);
                }
                spawnDamageNumber(e.x, e.y, Math.round(p.damage));

                if (e.health <= 0) {
                    player.killCount++;

                    // Hit-stop on kill (capped to prevent cascading freezes)
                    hitStopTimer = Math.min(
                        hitStopTimer + (e.isBoss ? HIT_STOP_BOSS_DURATION : HIT_STOP_DURATION),
                        HIT_STOP_MAX
                    );

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

                    // Plague: spread to nearby enemies on kill
                    if (p.isPlague || p.type === 'plaguezone') {
                        spawnPlagueSpread(e.x, e.y, p.damage * 0.6, p.radius * 0.5, 2.5);
                    }

                    spawnXPBurst(e.x, e.y, e.xpValue);
                    releaseEnemy(e);
                } else {
                    playEnemyHit();
                }

                // Pierce check (zones/DOT projectiles always pierce)
                if (p.type === 'zone' || p.type === 'firezone' || p.type === 'plaguezone' || p.type === 'frostdot') {
                    // These don't consume pierce
                } else if (p.pierce <= 0) {
                    projectilePool.release(p);
                    break;
                } else {
                    p.pierce--;
                }
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
        dt, state, orbitals, currentBiome);

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

function updateMenuGold() {
    const gold = getGold();
    const el = document.getElementById('menu-gold');
    if (el) el.textContent = gold;
    const el2 = document.getElementById('menu-gold-shop');
    if (el2) el2.textContent = gold;
}

function updateBiomeLocks() {
    document.querySelectorAll('.biome-btn').forEach(btn => {
        const biomeId = btn.dataset.biome;
        const locked = !isBiomeUnlocked(biomeId);
        btn.classList.toggle('locked', locked);
        if (locked) {
            btn.classList.remove('selected');
        }
    });
}

function buildShop() {
    const container = document.getElementById('shop-items');
    if (!container) return;
    container.innerHTML = '';

    for (const [id, def] of Object.entries(META_UPGRADES)) {
        const level = getUpgradeLevel(id);
        const cost = getUpgradeCost(id);
        const maxed = level >= def.maxLevel;

        const item = document.createElement('div');
        item.className = 'shop-item' + (maxed ? ' maxed' : '');

        const pips = '\u25A0'.repeat(level) + '\u25A1'.repeat(def.maxLevel - level);

        item.innerHTML = `
            <div class="shop-icon">${def.icon}</div>
            <div class="shop-name">${def.name}</div>
            <div class="shop-desc">${def.desc}</div>
            <div class="shop-pips">${pips}</div>
            <div class="shop-cost">${maxed ? 'MAX' : cost + ' gold'}</div>
        `;

        if (!maxed) {
            item.addEventListener('click', () => {
                if (purchaseUpgrade(id)) {
                    buildShop();
                    updateMenuGold();
                }
            });
        }

        container.appendChild(item);
    }
}

function showShop() {
    buildShop();
    updateMenuGold();
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('shop-screen').style.display = 'flex';
}

function hideShop() {
    document.getElementById('shop-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'flex';
}

function returnToMenu() {
    hideAllOverlays();
    state = STATE.MENU;
    updateMenuGold();
    updateBiomeLocks();
    showMenu();
}

function quitToMenu() {
    // Save current run before quitting
    saveRun({ player, survivalTime, biome: currentBiome });
    returnToMenu();
}

export function getState() { return state; }
window.__startGame = () => {
    updateBiomeLocks();
    startPlaying();
};
window.__selectBiome = (biomeId) => {
    if (BIOMES[biomeId] && isBiomeUnlocked(biomeId)) {
        currentBiome = biomeId;
        document.querySelectorAll('.biome-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.biome === biomeId);
        });
    }
};
window.__showShop = showShop;
window.__hideShop = hideShop;
window.__returnToMenu = returnToMenu;
window.__quitToMenu = quitToMenu;
window.__continueRun = () => resumeRun();
