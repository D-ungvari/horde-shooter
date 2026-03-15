// Combo reaction system (035, 036, 037)
// Checks for elemental combos when statuses are applied or enemies die.
// IMPORTANT: Combo effects do NOT trigger further combos (no infinite loops).

import { getEnemyPool } from './enemy.js';
import { spawnExplosion, spawnShockwave, spawnGroundScar, spawnDamageNumber, spawnParticle, triggerFlash } from './effects.js';
import { queryHash } from './physics.js';
import { v2Dist, randomRange } from './utils.js';
import { HIT_FLASH_DURATION } from './constants.js';

// --- Combo Discovery State (036) ---
let discoveredCombos = [];
let comboBanners = []; // { text, timer, maxTimer }

const COMBO_NAMES = {
    steam_explosion: 'Steam Explosion',
    chain_lightning: 'Chain Lightning',
    toxic_fire: 'Toxic Fire',
    shatter: 'Shatter',
    plague_burst: 'Plague Burst',
    overload: 'Overload',
    frostburn: 'Frostburn',
};

export function resetCombos() {
    discoveredCombos = [];
    comboBanners = [];
}

export function getDiscoveredCombos() {
    return discoveredCombos;
}

export function getComboBanners() {
    return comboBanners;
}

export function updateComboBanners(dt) {
    for (let i = comboBanners.length - 1; i >= 0; i--) {
        comboBanners[i].timer -= dt;
        if (comboBanners[i].timer <= 0) {
            comboBanners.splice(i, 1);
        }
    }
}

function discoverCombo(comboId) {
    if (discoveredCombos.indexOf(comboId) === -1) {
        discoveredCombos.push(comboId);
        const name = COMBO_NAMES[comboId] || comboId;
        comboBanners.push({
            text: `COMBO: ${name}!`,
            timer: 2.0,
            maxTimer: 2.0,
        });
    }
}

// --- Combo checks on status application (035) ---

/**
 * Called when a status is APPLIED to an enemy.
 * @param {object} enemy - the enemy
 * @param {string} status - which status was just applied: 'burning', 'frozen', 'poisoned', 'electrified', 'weakened'
 * @param {object} [opts] - optional: { isLightningHit: bool } for Overload detection
 */
export function checkStatusCombos(enemy, status, opts = {}) {
    // Steam Explosion: Frozen + Burning applied
    if (status === 'burning' && enemy.frozen > 0) {
        triggerSteamExplosion(enemy);
    } else if (status === 'frozen' && enemy.burning > 0) {
        triggerSteamExplosion(enemy);
    }

    // Toxic Fire: Poisoned + Burning
    if (status === 'burning' && enemy.poisoned > 0) {
        triggerToxicFire(enemy);
    } else if (status === 'poisoned' && enemy.burning > 0) {
        triggerToxicFire(enemy);
    }

    // Frostburn: Frozen + Poisoned
    if (status === 'frozen' && enemy.poisoned > 0) {
        triggerFrostburn(enemy);
    } else if (status === 'poisoned' && enemy.frozen > 0) {
        triggerFrostburn(enemy);
    }

    // Overload: Electrified enemy hit by lightning again
    if (status === 'electrified' && opts.isLightningHit && enemy.electrified) {
        // enemy was already electrified when lightning hit again
        triggerOverload(enemy);
    }
}

// --- Combo checks on enemy death (035) ---

/**
 * Called when an enemy dies. Check for death-triggered combos.
 * @param {object} enemy - the dying enemy
 */
export function checkDeathCombos(enemy) {
    // Shatter: Frozen enemy killed -> ice shards to nearby
    if (enemy.frozen > 0) {
        triggerShatter(enemy);
    }

    // Plague Burst: Poisoned enemy killed -> spread poison nearby
    // plagueBurstImmune prevents chain reactions from plague-spread poison
    if (enemy.poisoned > 0 && !enemy.plagueBurstImmune) {
        triggerPlagueBurst(enemy);
    }
}

// --- Combo Reactions ---

function triggerSteamExplosion(enemy) {
    discoverCombo('steam_explosion');
    const radius = 80;
    const damage = 40;

    // Remove frozen
    enemy.frozen = 0;

    // VFX (037): white expanding circle
    spawnExplosion(enemy.x, enemy.y, radius, '#FFFFFF');
    spawnShockwave(enemy.x, enemy.y, radius, '#CCDDFF');
    spawnGroundScar(enemy.x, enemy.y, radius);

    // Steam particles — white rising particles
    for (let i = 0; i < 8; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(30, 80);
        spawnParticle(
            enemy.x + randomRange(-10, 10),
            enemy.y + randomRange(-10, 10),
            Math.cos(angle) * speed,
            -Math.abs(Math.sin(angle) * speed) - 30,
            randomRange(3, 6), '#FFFFFF',
            randomRange(0.5, 1.0), true, -20
        );
    }

    // AoE damage to nearby enemies (no status application)
    damageNearbyEnemies(enemy.x, enemy.y, radius, damage);
}

function triggerToxicFire(enemy) {
    discoverCombo('toxic_fire');
    const radius = 60;
    const damage = 25;

    // Remove poison
    enemy.poisoned = 0;

    // VFX (037): green-orange gradient expanding circle
    spawnExplosion(enemy.x, enemy.y, radius, '#88CC22');
    spawnShockwave(enemy.x, enemy.y, radius, '#FF8822');

    // Green + orange particles
    for (let i = 0; i < 6; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(50, 120);
        const color = i % 2 === 0 ? '#66FF44' : '#FF8822';
        spawnParticle(
            enemy.x, enemy.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            randomRange(2, 5), color,
            randomRange(0.3, 0.6), true, 40
        );
    }

    // AoE damage (no status application)
    damageNearbyEnemies(enemy.x, enemy.y, radius, damage);
}

function triggerFrostburn(enemy) {
    discoverCombo('frostburn');

    // Double both DoT effects on this enemy
    // Burning: double stacks effect by doubling burningStacks (capped at 3 * 2 = 6 effective)
    // We'll use a frostburn flag to indicate doubled DoTs
    enemy.frostburn = true;

    // VFX (037): purple tint overlay — handled in renderer via frostburn flag
    // Small purple particles
    for (let i = 0; i < 4; i++) {
        const angle = randomRange(0, Math.PI * 2);
        spawnParticle(
            enemy.x + Math.cos(angle) * enemy.radius,
            enemy.y + Math.sin(angle) * enemy.radius,
            Math.cos(angle) * 30, Math.sin(angle) * 30,
            randomRange(2, 4), '#AA44FF',
            randomRange(0.4, 0.8), true, 0
        );
    }
}

function triggerOverload(enemy) {
    discoverCombo('overload');
    const radius = 100;

    // Remove electrified
    enemy.electrified = false;

    // VFX (037): blue expanding ring + brief blue screen flash
    spawnShockwave(enemy.x, enemy.y, radius, '#4488FF');
    spawnExplosion(enemy.x, enemy.y, radius, '#4488FF');
    triggerFlash('#4488FF', 0.15, 4);

    // Stun all enemies in radius for 1s (use knockback timer as stun)
    const pool = getEnemyPool();
    pool.forEach(e => {
        if (e.dying) return;
        const dx = e.x - enemy.x;
        const dy = e.y - enemy.y;
        if (dx * dx + dy * dy < radius * radius) {
            // Stun: stop movement for 1s using knockback with zero velocity
            e.knockbackVx = 0;
            e.knockbackVy = 0;
            e.knockbackTimer = Math.max(e.knockbackTimer, 1.0);
            e.hitFlashTimer = HIT_FLASH_DURATION;
        }
    });
}

function triggerShatter(enemy) {
    discoverCombo('shatter');
    const radius = 60;
    const damage = 20;

    // VFX (037): 6-8 light blue triangle particles flying outward
    const shardCount = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < shardCount; i++) {
        const angle = (Math.PI * 2 / shardCount) * i + randomRange(-0.2, 0.2);
        const speed = randomRange(100, 200);
        spawnParticle(
            enemy.x, enemy.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            randomRange(3, 6), '#AADDFF',
            randomRange(0.3, 0.6), true, 40
        );
    }
    spawnShockwave(enemy.x, enemy.y, radius, '#AADDFF');

    // Deal damage to nearby enemies — NO frozen status applied (prevent loops)
    damageNearbyEnemies(enemy.x, enemy.y, radius, damage);
}

function triggerPlagueBurst(enemy) {
    discoverCombo('plague_burst');
    const radius = 60;

    // VFX (037): green ripple ring expanding from corpse
    spawnShockwave(enemy.x, enemy.y, radius, '#66FF44');

    // Green particles
    for (let i = 0; i < 6; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(40, 100);
        spawnParticle(
            enemy.x, enemy.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            randomRange(2, 4), '#66FF44',
            randomRange(0.4, 0.8), true, 0
        );
    }

    // Spread poison to nearby enemies — this spread does NOT trigger further Plague Bursts
    const pool = getEnemyPool();
    pool.forEach(e => {
        if (e.dying || e === enemy) return;
        const dx = e.x - enemy.x;
        const dy = e.y - enemy.y;
        if (dx * dx + dy * dy < radius * radius) {
            e.poisoned = 5;
            // Mark as plague-spread so it won't trigger another Plague Burst
            e.plagueBurstImmune = true;
        }
    });
}

// --- Chain Lightning Combo (triggered from game.js when electrified enemy is hit by projectile) ---

/**
 * Trigger chain lightning from an electrified enemy hit by a projectile.
 * Arcs to 3 nearby enemies for 15 DMG each.
 */
export function triggerChainLightning(enemy) {
    discoverCombo('chain_lightning');
    const arcRange = 120;
    const arcDamage = 15;
    const arcCount = 3;

    const pool = getEnemyPool();
    let arcSource = enemy;
    const hit = new Set();
    hit.add(enemy._poolIndex);

    for (let i = 0; i < arcCount; i++) {
        let nearest = null;
        let nearestDist = Infinity;
        pool.forEach(e => {
            if (e.dying || hit.has(e._poolIndex)) return;
            const d = v2Dist(arcSource, e);
            if (d < arcRange && d < nearestDist) {
                nearest = e;
                nearestDist = d;
            }
        });

        if (!nearest) break;
        hit.add(nearest._poolIndex);

        // Deal damage — no status applied (prevents loops)
        nearest.health -= arcDamage;
        nearest.hitFlashTimer = HIT_FLASH_DURATION;
        spawnDamageNumber(nearest.x, nearest.y, arcDamage);

        // Visual: lightning bolt particle trail
        spawnLightningArc(arcSource.x, arcSource.y, nearest.x, nearest.y);

        arcSource = nearest;
    }
}

function spawnLightningArc(x1, y1, x2, y2) {
    // Spawn a few blue spark particles along the arc line
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t + randomRange(-5, 5);
        const y = y1 + (y2 - y1) * t + randomRange(-5, 5);
        spawnParticle(
            x, y,
            randomRange(-20, 20), randomRange(-20, 20),
            randomRange(1.5, 3), '#88CCFF',
            randomRange(0.1, 0.25), true, 0
        );
    }
}

// --- Helper: damage nearby enemies without applying any statuses ---

function damageNearbyEnemies(x, y, radius, damage) {
    const nearby = queryHash(x, y, radius);
    for (const e of nearby) {
        if (!e.active || e.dying) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        if (dx * dx + dy * dy < radius * radius) {
            e.health -= damage;
            e.hitFlashTimer = HIT_FLASH_DURATION;
            spawnDamageNumber(e.x, e.y, Math.round(damage));
        }
    }
}
