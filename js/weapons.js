import { getWeaponStats } from './weaponData.js';
import { spawnProjectile } from './projectile.js';
import { getMouseWorld } from './input.js';
import { getEnemyPool, applyKnockback } from './enemy.js';
import { HIT_FLASH_DURATION } from './constants.js';
import { v2Normalize, v2FromAngle, v2Dist, v2Sub, angleBetween, randomRange } from './utils.js';
import { playShoot, playShotgun, playSmg, playRocket, playLightning, playFlame, playFrostNova } from './audio.js';
import { spawnShockwave, spawnExplosion, spawnGroundScar } from './effects.js';
import { checkStatusCombos } from './combos.js';

// Weapon sound dispatch
function playWeaponSound(weaponId) {
    switch (weaponId) {
        case 'pistol': playShoot(); break;
        case 'shotgun': playShotgun(); break;
        case 'smg': playSmg(); break;
        case 'rocket': case 'mirv': playRocket(); break;
        case 'lightning': case 'thunderstorm': playLightning(); break;
        case 'flamethrower': case 'inferno': playFlame(); break;
        case 'frostnova': case 'absolute_zero': playFrostNova(); break;
        case 'railgun': playShoot(); break;
        case 'flak_cannon': playShotgun(); break;
        case 'minigun': playSmg(); break;
        case 'boomerang': case 'chakram': playShoot(); break;
        case 'poison': case 'plague': playFlame(); break;
        case 'orbitals': case 'guardian_ring': break; // continuous, no sound per fire
        // New weapons (040-042)
        case 'whip': case 'death_scythe': playShoot(); break;
        case 'holywater': case 'blessed_ground': playFrostNova(); break;
        case 'sawblade': case 'eternal_saw': playSmg(); break;
    }
}

// Cooldown timers per weapon slot
const cooldowns = [];

// Orbital state (persistent)
const orbitalAngles = [];
const orbitalPulseTimers = [];

// Inferno lingering fire interval counter
let infernoLingerTimer = 0;

// Per-weapon shot counters for milestone nth-shot effects (038)
const shotCounters = {};

// Sweep visual state for renderer
let lastSweepState = null;
export function getLastSweepState() { return lastSweepState; }

export function resetWeaponCooldowns() {
    cooldowns.length = 0;
    orbitalAngles.length = 0;
    orbitalPulseTimers.length = 0;
    infernoLingerTimer = 0;
    for (const key of Object.keys(shotCounters)) delete shotCounters[key];
    lastSweepState = null;
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
            const canFire = fireWeapon(player, stats, mouseWorld, dt, weapon);
            if (canFire) {
                cooldowns[i] = effectiveCooldown;
                playWeaponSound(weapon.id);
            }
        }
    }

    // Decay sweep visual
    if (lastSweepState) {
        lastSweepState.timer -= dt;
        if (lastSweepState.timer <= 0) lastSweepState = null;
    }
}

function fireWeapon(player, stats, mouseWorld, dt, weapon) {
    const pattern = stats.pattern;
    const effectiveDamage = stats.damage * player.damageMultiplier;
    const effectivePierce = (stats.pierce || 0) + player.piercingBonus;
    const effectiveLifetime = (stats.projectileLifetime || 1) * player.durationMultiplier;

    switch (pattern) {
        case 'aimed_single':
            return fireAimedSingle(player, stats, mouseWorld, effectiveDamage, effectivePierce, effectiveLifetime, weapon);
        case 'aimed_spread':
            return fireAimedSpread(player, stats, mouseWorld, effectiveDamage, effectivePierce, effectiveLifetime, weapon);
        case 'aimed_cone':
            return fireAimedCone(player, stats, mouseWorld, effectiveDamage, effectivePierce, effectiveLifetime, weapon);
        case 'auto_chain':
            return fireAutoChain(player, stats, effectiveDamage);
        case 'auto_boomerang':
            return fireAutoBoomerang(player, stats, effectiveDamage, effectiveLifetime);
        case 'auto_zone':
            return fireAutoZone(player, stats, effectiveDamage);
        case 'auto_burst':
            return fireAutoBurst(player, stats, effectiveDamage);
        case 'auto_sweep':
            return fireAutoSweep(player, stats, effectiveDamage);
        case 'auto_zone_targeted':
            return fireAutoZoneTargeted(player, stats, effectiveDamage);
        case 'auto_ricochet':
            return fireAutoRicochet(player, stats, effectiveDamage, effectiveLifetime);
        default:
            return false;
    }
}

// --- Helper: get shot counter for nth-shot milestones ---
function getShotCount(weaponId) {
    if (shotCounters[weaponId] === undefined) shotCounters[weaponId] = 0;
    return ++shotCounters[weaponId];
}

// --- Aimed Single (Pistol, SMG, Rocket) ---
function fireAimedSingle(player, stats, mouseWorld, damage, pierce, lifetime, weapon) {
    const angle = angleBetween(player, mouseWorld);
    const spread = stats.spread || 0;
    const ms = stats.activeMilestones || {};
    const shotNum = getShotCount(weapon ? weapon.id : stats.id);

    for (let i = 0; i < stats.projectileCount; i++) {
        const a = angle + randomRange(-spread, spread);
        const dir = v2FromAngle(a);

        let projPierce = pierce;
        let projAoe = stats.aoeRadius || 0;
        let statusEffect = '';
        let isRicochet = false;
        let lingeringFire = false;
        let miniRockets = 0;

        // Pistol Lv4: ricochet off screen edge
        if (ms.ricochet) {
            isRicochet = true;
        }
        // Pistol Lv7: every 5th shot is piercing
        if (ms.piercing_nth && shotNum % ms.piercing_nth === 0) {
            projPierce = Math.max(projPierce, 3);
        }

        // SMG Lv4: every 10th bullet is explosive (small AoE)
        if (ms.explosive_nth && shotNum % ms.explosive_nth === 0) {
            projAoe = 40;
        }

        // Rocket Lv4: lingering fire on explosion
        if (ms.lingering_fire) {
            lingeringFire = true;
        }
        // Rocket Lv7: mini rockets on impact
        if (ms.mini_rockets) {
            miniRockets = ms.mini_rockets;
        }

        spawnProjectile(player.x, player.y,
            dir.x * stats.projectileSpeed,
            dir.y * stats.projectileSpeed,
            {
                radius: stats.projectileRadius,
                damage,
                pierce: projPierce,
                lifetime,
                color: stats.color,
                aoeRadius: projAoe,
                knockbackDist: stats.knockbackDist || 0,
                knockbackSpeed: stats.knockbackSpeed || 0,
                statusEffect,
                // Milestone flags for projectile behavior
                ricochet: isRicochet ? 1 : 0,
                lingeringFire,
                miniRockets,
                // Visual upgrades (039)
                visualLevel: stats.visualLevel || 0,
            }
        );
    }
    return true;
}

// --- Aimed Spread (Shotgun) ---
function fireAimedSpread(player, stats, mouseWorld, damage, pierce, lifetime, weapon) {
    const baseAngle = angleBetween(player, mouseWorld);
    const totalSpread = stats.spread || 0.3;
    const count = stats.projectileCount || 5;
    const ms = stats.activeMilestones || {};

    for (let i = 0; i < count; i++) {
        const t = count > 1 ? (i / (count - 1)) - 0.5 : 0;
        const a = baseAngle + t * totalSpread + randomRange(-0.03, 0.03);
        const dir = v2FromAngle(a);
        const speed = stats.projectileSpeed * randomRange(0.9, 1.05);

        // Shotgun Lv7: pellets apply burning
        const statusEffect = ms.burning ? 'burning' : '';

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
                knockbackDist: stats.knockbackDist || 0,
                knockbackSpeed: stats.knockbackSpeed || 0,
                statusEffect,
                visualLevel: stats.visualLevel || 0,
            }
        );
    }
    return true;
}

// --- Aimed Cone (Flamethrower / Inferno) ---
function fireAimedCone(player, stats, mouseWorld, damage, pierce, lifetime, weapon) {
    const baseAngle = angleBetween(player, mouseWorld);
    const spread = stats.spread || 0.4;
    const count = stats.projectileCount || 1;
    const ms = stats.activeMilestones || {};

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
                statusEffect: 'burning', // (033)
                knockbackDist: stats.knockbackDist || 0,
                knockbackSpeed: stats.knockbackSpeed || 0,
                // Flamethrower Lv4: burn_amp flag — burning enemies take 15% more from all sources
                burnAmp: ms.burn_amp || 0,
                visualLevel: stats.visualLevel || 0,
            }
        );
    }

    // Inferno: periodically leave a lingering fire zone at flame endpoint
    if (stats.lingeringFire) {
        infernoLingerTimer++;
        if (infernoLingerTimer >= (stats.lingerInterval || 3)) {
            infernoLingerTimer = 0;
            const dir = v2FromAngle(baseAngle);
            const dist = stats.projectileSpeed * (stats.projectileLifetime || 0.35) * 0.6;
            const zx = player.x + dir.x * dist;
            const zy = player.y + dir.y * dist;
            const lingerRadius = (stats.lingerRadius || 30) * player.areaMultiplier;
            const lingerDuration = (stats.lingerDuration || 3.0) * player.durationMultiplier;
            spawnProjectile(zx, zy, 0, 0, {
                radius: lingerRadius,
                damage: damage * 0.4,
                pierce: 999,
                lifetime: lingerDuration,
                color: '#FF4400',
                type: 'firezone',
                statusEffect: 'burning', // (033)
                zoneTick: 0.4,
                zoneTimer: 0,
            });
        }
    }

    return true;
}

// --- Auto Chain (Lightning / Thunderstorm) ---
function fireAutoChain(player, stats, damage) {
    const pool = getEnemyPool();
    const chainRange = (stats.chainRange || 150) * player.areaMultiplier;
    const chainCount = stats.chainCount || 2;
    const hasArc = stats.chainArc || false; // Thunderstorm: wider arc bolts
    const ms = stats.activeMilestones || {};

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
    // Thunderstorm: less falloff per jump (10% vs 20%)
    const falloff = hasArc ? 0.9 : 0.8;

    for (let i = 0; i < chainCount + 1; i++) {
        if (!current || !current.active) break;
        hit.add(current._poolIndex);
        // Overload check: if already electrified and hit by lightning again (033/035)
        checkStatusCombos(current, 'electrified', { isLightningHit: true });
        current.electrified = true;
        current.health -= chainDmg;
        current.hitFlashTimer = HIT_FLASH_DURATION;

        // Lightning Lv4: chain hits slow enemies 20% for 1s
        if (ms.chain_slow) {
            current.slowTimer = Math.max(current.slowTimer || 0, 1.0);
            current.slowFactor = Math.min(current.slowFactor || 1, 1 - ms.chain_slow);
        }

        chainDmg *= falloff;

        // Visual: spawn a short-lived lightning bolt projectile from prev to current
        if (i === 0) {
            // From player to first target
            spawnLightningBolt(player.x, player.y, current.x, current.y, stats.color, hasArc);
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
            spawnLightningBolt(current.x, current.y, nextTarget.x, nextTarget.y, stats.color, hasArc);
        }
        current = nextTarget;
    }

    // Thunderstorm: spawn a brief AoE damage pulse at the first target position
    if (hasArc && nearest && nearest.active !== undefined) {
        spawnProjectile(nearest.x, nearest.y, 0, 0, {
            radius: chainRange * 0.3,
            damage: 0,
            pierce: 999,
            lifetime: 0.2,
            color: stats.color || '#44EEFF',
            type: 'frostburst', // re-use frostburst visual for the arc pulse
        });
    }

    return true;
}

function spawnLightningBolt(x1, y1, x2, y2, color, wideArc = false) {
    // Spawn a fast, short-lived projectile along the line for visual effect
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    spawnProjectile(midX, midY, 0, 0, {
        radius: wideArc ? 5 : 3,
        damage: 0,
        pierce: 999,
        lifetime: wideArc ? 0.25 : 0.15,
        color: color || '#88CCFF',
        type: 'lightning',
        // Store endpoints for renderer
        x1, y1, x2, y2,
    });
    // Thunderstorm: spawn a second, parallel arc for the wider visual
    if (wideArc) {
        const perpX = Math.cos(angle + Math.PI / 2) * 8;
        const perpY = Math.sin(angle + Math.PI / 2) * 8;
        spawnProjectile(midX, midY, 0, 0, {
            radius: 3,
            damage: 0,
            pierce: 999,
            lifetime: 0.2,
            color: '#FFFFFF',
            type: 'lightning',
            x1: x1 + perpX, y1: y1 + perpY,
            x2: x2 + perpX, y2: y2 + perpY,
        });
    }
}

// --- Auto Boomerang / Chakram ---
function fireAutoBoomerang(player, stats, damage, lifetime) {
    const pool = getEnemyPool();
    const isChakram = stats.isChakram || false;
    const ms = stats.activeMilestones || {};

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

    const throwCount = ms.double_throw ? 2 : 1;

    for (let t = 0; t < throwCount; t++) {
        // Offset angle slightly for second boomerang
        const angleOffset = t === 0 ? 0 : 0.4;
        const angle = angleBetween(player, nearest) + angleOffset;
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
                type: isChakram ? 'chakram' : 'boomerang',
                statusEffect: 'weakened', // (033)
                ownerX: player.x,
                ownerY: player.y,
                bounceCount: 0,
                maxBounces: isChakram ? 5 : 0,
                knockbackDist: stats.knockbackDist || 0,
                knockbackSpeed: stats.knockbackSpeed || 0,
                visualLevel: stats.visualLevel || 0,
            }
        );
    }
    return true;
}

// --- Auto Orbital / Guardian Ring ---
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
                e.hitFlashTimer = HIT_FLASH_DURATION;
                // Apply weakened status (033)
                if (e.weakened <= 0) {
                    e.weakened = 3;
                    checkStatusCombos(e, 'weakened');
                }
                // Only apply knockback if not already being knocked back (avoid continuous jitter)
                if (e.knockbackTimer <= 0 && (stats.knockbackDist || 0) > 0) {
                    applyKnockback(e, ox, oy, stats.knockbackDist, stats.knockbackSpeed);
                }
            }
        });
    }

    // Guardian Ring: periodic damage pulse
    if (stats.pulseInterval) {
        if (orbitalPulseTimers[slotIndex] === undefined) orbitalPulseTimers[slotIndex] = 0;
        orbitalPulseTimers[slotIndex] += dt;

        if (orbitalPulseTimers[slotIndex] >= stats.pulseInterval) {
            orbitalPulseTimers[slotIndex] = 0;
            const pulseRadius = (stats.pulseRadius || 120) * player.areaMultiplier;
            const pulseDmg = (stats.pulseDamage || 20) * player.damageMultiplier;

            // Damage all enemies in pulse radius
            pool.forEach(e => {
                const dx = e.x - player.x;
                const dy = e.y - player.y;
                if (dx * dx + dy * dy < pulseRadius * pulseRadius) {
                    e.health -= pulseDmg;
                    e.hitFlashTimer = HIT_FLASH_DURATION;
                    // Apply weakened status (033)
                    e.weakened = Math.max(e.weakened, 3);
                    checkStatusCombos(e, 'weakened');
                    if ((stats.knockbackDist || 0) > 0) {
                        applyKnockback(e, player.x, player.y, stats.knockbackDist, stats.knockbackSpeed);
                    }
                }
            });

            // Shockwave ring + explosion visual (027)
            spawnShockwave(player.x, player.y, pulseRadius, stats.color || '#4488FF');
            spawnExplosion(player.x, player.y, pulseRadius, stats.color || '#4488FF');
            spawnGroundScar(player.x, player.y, pulseRadius);

            // Visual: expanding ring burst
            const ringCount = 16;
            for (let i = 0; i < ringCount; i++) {
                const angle = (Math.PI * 2 / ringCount) * i;
                const dir = v2FromAngle(angle);
                spawnProjectile(player.x, player.y,
                    dir.x * 300, dir.y * 300,
                    {
                        radius: 5,
                        damage: 0,
                        pierce: 999,
                        lifetime: 0.25,
                        color: stats.color || '#4488FF',
                        type: 'frostburst',
                    }
                );
            }
        }
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

// --- Auto Zone (Poison Cloud / Plague) ---
function fireAutoZone(player, stats, damage) {
    const zoneRadius = (stats.zoneRadius || 50) * player.areaMultiplier;
    const duration = (stats.zoneDuration || 4) * player.durationMultiplier;
    const isPlague = stats.isPlague || false;
    const ms = stats.activeMilestones || {};

    // Spawn a stationary, large, long-lived "projectile" as the zone
    spawnProjectile(player.x, player.y, 0, 0, {
        radius: zoneRadius,
        damage: damage * 0.3, // damage per tick
        pierce: 999,
        lifetime: duration,
        color: stats.color || '#66FF44',
        type: isPlague ? 'plaguezone' : 'zone',
        statusEffect: 'poisoned', // (033)
        zoneTick: stats.zoneTick || 0.5,
        zoneTimer: 0,
        isPlague: isPlague || (ms.plague_spread || false), // Poison Lv7: spreads on kill
        // Poison Lv4: zone_slow — enemies in cloud move 30% slower
        zoneSlow: ms.zone_slow || 0,
    });
    return true;
}

// Exported for game.js to call when a plague-zone enemy dies
export function spawnPlagueSpread(x, y, damage, radius, duration) {
    spawnProjectile(x, y, 0, 0, {
        radius: radius,
        damage: damage,
        pierce: 999,
        lifetime: duration,
        color: '#88FF22',
        type: 'plaguezone',
        statusEffect: 'poisoned', // (033)
        zoneTick: 0.4,
        zoneTimer: 0,
        isPlague: true,
    });
}

// --- Auto Burst (Frost Nova / Absolute Zero) ---
function fireAutoBurst(player, stats, damage) {
    const burstRadius = (stats.burstRadius || 100) * player.areaMultiplier;
    const slowDuration = (stats.slowDuration || 2) * player.durationMultiplier;
    const slowFactor = stats.slowFactor || 0.4;
    const hasFreezeDot = stats.freezeDot || false;
    const ms = stats.activeMilestones || {};

    // FrostNova Lv7: +1s freeze
    const extraFreeze = ms.burst_radius ? 1.0 : 0;

    const pool = getEnemyPool();

    // Damage + slow all enemies in radius
    pool.forEach(e => {
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (dx * dx + dy * dy < burstRadius * burstRadius) {
            // FrostNova Lv4: shatter_bonus — frozen enemies take bonus damage
            let dmg = damage;
            if (ms.shatter_bonus && e.frozen > 0) {
                dmg *= (1 + ms.shatter_bonus);
            }
            e.health -= dmg;
            e.hitFlashTimer = HIT_FLASH_DURATION;
            if ((stats.knockbackDist || 0) > 0) {
                applyKnockback(e, player.x, player.y, stats.knockbackDist, stats.knockbackSpeed);
            }
            e.slowTimer = slowDuration + extraFreeze;
            e.slowFactor = slowFactor;
            // Apply frozen status (033)
            e.frozen = Math.max(e.frozen, 2 + extraFreeze);
            checkStatusCombos(e, 'frozen');
        }
    });

    // Shockwave ring + explosion visual (027)
    spawnShockwave(player.x, player.y, burstRadius, stats.color || '#AADDFF');
    spawnExplosion(player.x, player.y, burstRadius, stats.color || '#AADDFF');
    spawnGroundScar(player.x, player.y, burstRadius);

    // Visual burst: spawn ring of short projectiles outward
    const ringCount = hasFreezeDot ? 20 : 12;
    for (let i = 0; i < ringCount; i++) {
        const angle = (Math.PI * 2 / ringCount) * i;
        const dir = v2FromAngle(angle);
        spawnProjectile(player.x, player.y,
            dir.x * (hasFreezeDot ? 300 : 200),
            dir.y * (hasFreezeDot ? 300 : 200),
            {
                radius: hasFreezeDot ? 5 : 4,
                damage: 0,
                pierce: 999,
                lifetime: hasFreezeDot ? 0.4 : 0.3,
                color: stats.color || '#AADDFF',
                type: 'frostburst',
            }
        );
    }

    // Absolute Zero: spawn a lingering frost DOT zone at player position
    if (hasFreezeDot) {
        const dotDamage = (stats.freezeDotDamage || 5) * player.damageMultiplier;
        const dotDuration = slowDuration; // DOT lasts as long as the freeze
        spawnProjectile(player.x, player.y, 0, 0, {
            radius: burstRadius,
            damage: dotDamage,
            pierce: 999,
            lifetime: dotDuration,
            color: '#66CCFF',
            type: 'frostdot',
            statusEffect: 'frozen', // (033)
            freezeDotDamage: dotDamage,
            freezeDotTick: stats.freezeDotTick || 0.5,
            zoneTick: stats.freezeDotTick || 0.5,
            zoneTimer: 0,
        });
    }

    return true;
}

// --- NEW: Auto Sweep (Whip / Death Scythe) (040) ---
function fireAutoSweep(player, stats, damage) {
    const pool = getEnemyPool();
    const range = (stats.sweepRange || 100) * player.areaMultiplier;
    const arc = stats.sweepArc || (Math.PI * 2 / 3);
    const statusEffect = stats.statusEffect || '';

    // Find densest direction — sample 8 angles, count enemies in each cone
    let bestAngle = 0;
    let bestCount = -1;
    for (let s = 0; s < 8; s++) {
        const testAngle = (Math.PI * 2 / 8) * s;
        let count = 0;
        pool.forEach(e => {
            const dx = e.x - player.x;
            const dy = e.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > range) return;
            const eAngle = Math.atan2(dy, dx);
            let diff = eAngle - testAngle;
            // Normalize to [-PI, PI]
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) <= arc / 2) count++;
        });
        if (count > bestCount) {
            bestCount = count;
            bestAngle = testAngle;
        }
    }

    if (bestCount <= 0) {
        // No enemies nearby — still fire, target nearest if any
        let nearest = null;
        let nearestDist = Infinity;
        pool.forEach(e => {
            const d = v2Dist(player, e);
            if (d < range * 3 && d < nearestDist) {
                nearest = e;
                nearestDist = d;
            }
        });
        if (!nearest) return false;
        bestAngle = angleBetween(player, nearest);
    }

    // Hit all enemies in the sweep cone
    pool.forEach(e => {
        if (!e.active || e.dying) return;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > range) return;
        const eAngle = Math.atan2(dy, dx);
        let diff = eAngle - bestAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= arc / 2) {
            e.health -= damage;
            e.hitFlashTimer = HIT_FLASH_DURATION;
            if (statusEffect === 'weakened') {
                e.weakened = Math.max(e.weakened || 0, 3);
                checkStatusCombos(e, 'weakened');
            }
            if ((stats.knockbackDist || 0) > 0) {
                applyKnockback(e, player.x, player.y, stats.knockbackDist, stats.knockbackSpeed);
            }
        }
    });

    // Store sweep visual state for renderer
    lastSweepState = {
        x: player.x,
        y: player.y,
        angle: bestAngle,
        arc,
        range,
        color: stats.color || '#CC88FF',
        timer: 0.2, // visible for 200ms
        maxTimer: 0.2,
    };

    return true;
}

// --- NEW: Auto Zone Targeted (Holy Water / Blessed Ground) (041) ---
function fireAutoZoneTargeted(player, stats, damage) {
    const pool = getEnemyPool();
    const zoneRadius = (stats.zoneRadius || 60) * player.areaMultiplier;
    const duration = (stats.zoneDuration || 3) * player.durationMultiplier;
    const healsPlayer = stats.healsPlayer || false;

    // Find densest enemy cluster — sample 12 positions from nearby enemies
    let bestX = player.x;
    let bestY = player.y;
    let bestCount = 0;

    // Build candidate positions from enemy positions
    const candidates = [];
    pool.forEach(e => {
        const d = v2Dist(player, e);
        if (d < 400) {
            candidates.push({ x: e.x, y: e.y });
        }
    });

    if (candidates.length === 0) return false;

    // Evaluate each candidate: count nearby enemies
    for (const c of candidates) {
        let count = 0;
        pool.forEach(e => {
            const dx = e.x - c.x;
            const dy = e.y - c.y;
            if (dx * dx + dy * dy < zoneRadius * zoneRadius * 2.25) {
                count++;
            }
        });
        if (count > bestCount) {
            bestCount = count;
            bestX = c.x;
            bestY = c.y;
        }
    }

    // Spawn zone at densest cluster
    spawnProjectile(bestX, bestY, 0, 0, {
        radius: zoneRadius,
        damage: damage * 0.3,
        pierce: 999,
        lifetime: duration,
        color: stats.color || '#44AAFF',
        type: healsPlayer ? 'holywaterzone' : 'zone',
        zoneTick: stats.zoneTick || 0.5,
        zoneTimer: 0,
        healsPlayer,
        healPerTick: stats.healPerTick || 1,
    });

    return true;
}

// --- NEW: Auto Ricochet (Sawblade / Eternal Saw) (042) ---
function fireAutoRicochet(player, stats, damage, lifetime) {
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
            radius: stats.projectileRadius || 7,
            damage,
            pierce: 0, // doesn't pierce — bounces instead
            lifetime,
            color: stats.color,
            type: 'sawblade',
            knockbackDist: stats.knockbackDist || 0,
            knockbackSpeed: stats.knockbackSpeed || 0,
            bounceCount: 0,
            maxBounces: stats.maxBounces || 8,
            visualLevel: stats.visualLevel || 0,
        }
    );
    return true;
}
