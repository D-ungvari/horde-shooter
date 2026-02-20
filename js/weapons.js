import { getWeaponStats } from './weaponData.js';
import { spawnProjectile } from './projectile.js';
import { getMouseWorld } from './input.js';
import { getEnemyPool } from './enemy.js';
import { v2Normalize, v2FromAngle, v2Dist, v2Sub, angleBetween, randomRange } from './utils.js';
import { playShoot, playShotgun, playSmg, playRocket, playLightning, playFlame, playFrostNova } from './audio.js';

// Weapon sound dispatch
function playWeaponSound(weaponId) {
    switch (weaponId) {
        case 'pistol': playShoot(); break;
        case 'shotgun': playShotgun(); break;
        case 'smg': playSmg(); break;
        case 'rocket': case 'mirv': playRocket(); break;
        case 'lightning': case 'thunderstorm': playLightning(); break;
        case 'flamethrower': case 'inferno': playFlame(); break;
        case 'frost_nova': case 'absolute_zero': playFrostNova(); break;
        case 'railgun': playShoot(); break;
        case 'flak_cannon': playShotgun(); break;
        case 'minigun': playSmg(); break;
    }
}

// Cooldown timers per weapon slot
const cooldowns = [];

// Orbital state (persistent)
const orbitalAngles = [];

export function resetWeaponCooldowns() {
    cooldowns.length = 0;
    orbitalAngles.length = 0;
}

// Expose cooldown state for HUD rendering
export function getWeaponCooldownRatio(index) {
    if (cooldowns[index] === undefined || cooldowns[index] <= 0) return 1;
    return 0; // simplified: 0 = on cooldown, 1 = ready
}
export function getCooldowns() { return cooldowns; }

export function updateWeapons(player, dt) {
    const mouseWorld = getMouseWorld();

    for (let i = 0; i < player.weapons.length; i++) {
        const weapon = player.weapons[i];
        const stats = getWeaponStats(weapon.id, weapon.level);
        if (!stats) continue;

        // Init cooldown slot
        if (cooldowns[i] === undefined) cooldowns[i] = 0;

        // Orbitals are continuous — update every frame
        if (stats.pattern === 'auto_orbital') {
            updateOrbitals(player, stats, i, dt);
            continue;
        }

        // Apply player stat modifiers
        const effectiveCooldown = stats.cooldown
            * (1 - player.cooldownReduction)
            / (player.attackSpeedMultiplier || 1);

        cooldowns[i] -= dt;

        if (cooldowns[i] <= 0) {
            const canFire = fireWeapon(player, stats, mouseWorld, dt);
            if (canFire) {
                cooldowns[i] = effectiveCooldown;
                playWeaponSound(weapon.id);
            }
        }
    }
}

function fireWeapon(player, stats, mouseWorld, dt) {
    const pattern = stats.pattern;
    const effectiveDamage = stats.damage * player.damageMultiplier;
    const effectivePierce = (stats.pierce || 0) + player.piercingBonus;
    const effectiveLifetime = (stats.projectileLifetime || 1) * player.durationMultiplier;

    switch (pattern) {
        case 'aimed_single':
            return fireAimedSingle(player, stats, mouseWorld, effectiveDamage, effectivePierce, effectiveLifetime);
        case 'aimed_spread':
            return fireAimedSpread(player, stats, mouseWorld, effectiveDamage, effectivePierce, effectiveLifetime);
        case 'aimed_cone':
            return fireAimedCone(player, stats, mouseWorld, effectiveDamage, effectivePierce, effectiveLifetime);
        case 'auto_chain':
            return fireAutoChain(player, stats, effectiveDamage);
        case 'auto_boomerang':
            return fireAutoBoomerang(player, stats, effectiveDamage, effectiveLifetime);
        case 'auto_zone':
            return fireAutoZone(player, stats, effectiveDamage);
        case 'auto_burst':
            return fireAutoBurst(player, stats, effectiveDamage);
        default:
            return false;
    }
}

// --- Aimed Single (Pistol, SMG, Rocket) ---
function fireAimedSingle(player, stats, mouseWorld, damage, pierce, lifetime) {
    const angle = angleBetween(player, mouseWorld);
    const spread = stats.spread || 0;

    for (let i = 0; i < stats.projectileCount; i++) {
        const a = angle + randomRange(-spread, spread);
        const dir = v2FromAngle(a);
        spawnProjectile(player.x, player.y,
            dir.x * stats.projectileSpeed,
            dir.y * stats.projectileSpeed,
            {
                radius: stats.projectileRadius,
                damage,
                pierce,
                lifetime,
                color: stats.color,
                aoeRadius: stats.aoeRadius || 0,
            }
        );
    }
    return true;
}

// --- Aimed Spread (Shotgun) ---
function fireAimedSpread(player, stats, mouseWorld, damage, pierce, lifetime) {
    const baseAngle = angleBetween(player, mouseWorld);
    const totalSpread = stats.spread || 0.3;
    const count = stats.projectileCount || 5;

    for (let i = 0; i < count; i++) {
        const t = count > 1 ? (i / (count - 1)) - 0.5 : 0;
        const a = baseAngle + t * totalSpread + randomRange(-0.03, 0.03);
        const dir = v2FromAngle(a);
        const speed = stats.projectileSpeed * randomRange(0.9, 1.05);
        spawnProjectile(player.x, player.y,
            dir.x * speed,
            dir.y * speed,
            {
                radius: stats.projectileRadius,
                damage,
                pierce,
                lifetime,
                color: stats.color,
                aoeRadius: stats.aoeRadius || 0,
            }
        );
    }
    return true;
}

// --- Aimed Cone (Flamethrower) ---
function fireAimedCone(player, stats, mouseWorld, damage, pierce, lifetime) {
    const baseAngle = angleBetween(player, mouseWorld);
    const spread = stats.spread || 0.4;
    const count = stats.projectileCount || 1;

    for (let i = 0; i < count; i++) {
        const a = baseAngle + randomRange(-spread, spread);
        const speed = stats.projectileSpeed * randomRange(0.7, 1.1);
        const dir = v2FromAngle(a);
        spawnProjectile(player.x + dir.x * 20, player.y + dir.y * 20,
            dir.x * speed,
            dir.y * speed,
            {
                radius: stats.projectileRadius + randomRange(-1, 2),
                damage,
                pierce: pierce + 2, // flames pierce through
                lifetime: lifetime * randomRange(0.7, 1.3),
                color: stats.color,
                type: 'flame',
            }
        );
    }
    return true;
}

// --- Auto Chain (Lightning) ---
function fireAutoChain(player, stats, damage) {
    const pool = getEnemyPool();
    const chainRange = (stats.chainRange || 150) * player.areaMultiplier;
    const chainCount = stats.chainCount || 2;

    // Find nearest enemy to player
    let nearest = null;
    let nearestDist = Infinity;
    pool.forEach(e => {
        const d = v2Dist(player, e);
        if (d < chainRange * 2 && d < nearestDist) {
            nearest = e;
            nearestDist = d;
        }
    });

    if (!nearest) return false;

    // Chain from nearest, jumping to nearby enemies
    const hit = new Set();
    let current = nearest;
    let chainDmg = damage;

    for (let i = 0; i < chainCount + 1; i++) {
        if (!current || !current.active) break;
        hit.add(current._poolIndex);
        current.health -= chainDmg;
        chainDmg *= 0.8; // 20% falloff per jump

        // Visual: spawn a short-lived lightning bolt projectile from prev to current
        if (i === 0) {
            // From player to first target
            spawnLightningBolt(player.x, player.y, current.x, current.y, stats.color);
        }

        // Find next closest unvisited enemy
        let nextTarget = null;
        let nextDist = Infinity;
        pool.forEach(e => {
            if (!e.active || hit.has(e._poolIndex)) return;
            const d = v2Dist(current, e);
            if (d < chainRange && d < nextDist) {
                nextTarget = e;
                nextDist = d;
            }
        });

        if (nextTarget) {
            spawnLightningBolt(current.x, current.y, nextTarget.x, nextTarget.y, stats.color);
        }
        current = nextTarget;
    }

    return true;
}

function spawnLightningBolt(x1, y1, x2, y2, color) {
    // Spawn a fast, short-lived projectile along the line for visual effect
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    spawnProjectile(midX, midY, 0, 0, {
        radius: 3,
        damage: 0,
        pierce: 999,
        lifetime: 0.15,
        color: color || '#88CCFF',
        type: 'lightning',
        // Store endpoints for renderer
        x1, y1, x2, y2,
    });
}

// --- Auto Boomerang ---
function fireAutoBoomerang(player, stats, damage, lifetime) {
    const pool = getEnemyPool();

    // Find nearest enemy
    let nearest = null;
    let nearestDist = Infinity;
    pool.forEach(e => {
        const d = v2Dist(player, e);
        if (d < 500 && d < nearestDist) {
            nearest = e;
            nearestDist = d;
        }
    });

    if (!nearest) return false;

    const angle = angleBetween(player, nearest);
    const dir = v2FromAngle(angle);
    const speed = stats.projectileSpeed || 350;

    spawnProjectile(player.x, player.y,
        dir.x * speed,
        dir.y * speed,
        {
            radius: stats.projectileRadius || 8,
            damage,
            pierce: 99, // boomerangs always pierce
            lifetime: lifetime,
            color: stats.color,
            type: 'boomerang',
            ownerX: player.x,
            ownerY: player.y,
        }
    );
    return true;
}

// --- Auto Orbital ---
function updateOrbitals(player, stats, slotIndex, dt) {
    const count = stats.orbitalCount || 2;
    const radius = (stats.orbitalRadius || 60) * player.areaMultiplier;
    const speed = stats.orbitalSpeed || 3;
    const hitRadius = stats.hitRadius || 10;
    const damage = stats.baseDamage * player.damageMultiplier;

    if (orbitalAngles[slotIndex] === undefined) orbitalAngles[slotIndex] = 0;
    orbitalAngles[slotIndex] += speed * dt;

    const pool = getEnemyPool();

    for (let i = 0; i < count; i++) {
        const angle = orbitalAngles[slotIndex] + (Math.PI * 2 / count) * i;
        const ox = player.x + Math.cos(angle) * radius;
        const oy = player.y + Math.sin(angle) * radius;

        // Check collisions with enemies
        pool.forEach(e => {
            const dx = e.x - ox;
            const dy = e.y - oy;
            const dist = dx * dx + dy * dy;
            const radSum = hitRadius + e.radius;
            if (dist < radSum * radSum) {
                e.health -= damage * dt * 3; // DPS-based damage
            }
        });
    }
}

// Get orbital positions for rendering
export function getOrbitalPositions(player) {
    const positions = [];

    for (let i = 0; i < player.weapons.length; i++) {
        const weapon = player.weapons[i];
        const stats = getWeaponStats(weapon.id, weapon.level);
        if (!stats || stats.pattern !== 'auto_orbital') continue;

        const count = stats.orbitalCount || 2;
        const radius = (stats.orbitalRadius || 60) * player.areaMultiplier;
        const baseAngle = orbitalAngles[i] || 0;

        for (let j = 0; j < count; j++) {
            const angle = baseAngle + (Math.PI * 2 / count) * j;
            positions.push({
                x: player.x + Math.cos(angle) * radius,
                y: player.y + Math.sin(angle) * radius,
                radius: stats.hitRadius || 10,
                color: stats.color || '#66AAFF',
            });
        }
    }
    return positions;
}

// --- Auto Zone (Poison Cloud) ---
function fireAutoZone(player, stats, damage) {
    const zoneRadius = (stats.zoneRadius || 50) * player.areaMultiplier;
    const duration = (stats.zoneDuration || 4) * player.durationMultiplier;

    // Spawn a stationary, large, long-lived "projectile" as the zone
    spawnProjectile(player.x, player.y, 0, 0, {
        radius: zoneRadius,
        damage: damage * 0.3, // damage per tick
        pierce: 999,
        lifetime: duration,
        color: stats.color || '#66FF44',
        type: 'zone',
        zoneTick: stats.zoneTick || 0.5,
        zoneTimer: 0,
    });
    return true;
}

// --- Auto Burst (Frost Nova) ---
function fireAutoBurst(player, stats, damage) {
    const burstRadius = (stats.burstRadius || 100) * player.areaMultiplier;
    const slowDuration = (stats.slowDuration || 2) * player.durationMultiplier;
    const slowFactor = stats.slowFactor || 0.4;

    const pool = getEnemyPool();

    // Damage + slow all enemies in radius
    pool.forEach(e => {
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (dx * dx + dy * dy < burstRadius * burstRadius) {
            e.health -= damage;
            e.slowTimer = slowDuration;
            e.slowFactor = slowFactor;
        }
    });

    // Visual burst: spawn ring of short projectiles outward
    const ringCount = 12;
    for (let i = 0; i < ringCount; i++) {
        const angle = (Math.PI * 2 / ringCount) * i;
        const dir = v2FromAngle(angle);
        spawnProjectile(player.x, player.y,
            dir.x * 200, dir.y * 200,
            {
                radius: 4,
                damage: 0,
                pierce: 999,
                lifetime: 0.3,
                color: stats.color || '#AADDFF',
                type: 'frostburst',
            }
        );
    }
    return true;
}
