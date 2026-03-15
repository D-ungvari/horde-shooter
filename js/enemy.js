import { createPool } from './objectPool.js';
import { MAX_ENEMIES, DEATH_ANIM_DURATION } from './constants.js';
import { ENEMIES, BOSSES, getScaledStats, getScaledBossStats } from './enemyData.js';
import { spawnProjectile } from './projectile.js';
import { queryHash } from './physics.js';
import { angleBetween, v2FromAngle, v2Dist, randomRange } from './utils.js';

function createEnemyObj() {
    return {
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        radius: 12,
        health: 1,
        maxHealth: 1,
        damage: 5,
        speed: 40,
        xpValue: 1,
        color: '#FF4444',
        type: 'shambler',
        ai: 'chase',
        targetAngle: 0,
        isElite: false,
        isBoss: false,
        // AI-specific state
        sinePhase: 0,
        attackCooldown: 0,
        chargeState: 'approach',
        chargeTimer: 0,
        // Ranged attack data
        attackRange: 0,
        attackCooldownMax: 0,
        projectileSpeed: 0,
        // Slow/freeze
        slowTimer: 0,
        slowFactor: 1,
        // Hit feedback
        hitFlashTimer: 0,
        // Knockback
        knockbackVx: 0,
        knockbackVy: 0,
        knockbackTimer: 0,
        knockbackResist: 0,
        // Death animation
        dying: false,
        deathTimer: 0,
        deathRotation: 0,
        // Exploder
        explosionRadius: 0,
        explosionDamage: 0,
        pulseTimer: 0,
        // Boss-specific
        specialTimer1: 0, // slam / spawn / charge cooldown
        specialTimer2: 0, // teleport / spawn cooldown
        bossPhase: 'normal',
        // Boss data from def
        slamCooldown: 0,
        slamRadius: 0,
        slamDamage: 0,
        spawnType: '',
        spawnCount: 0,
        teleportCooldown: 0,
        teleportRange: 0,
        chargeCooldown: 0,
        chargeSpeed: 0,
        chargeDuration: 0,
        spreadCount: 0,
        spreadAngle: 0,
        spawnCooldown: 0,
    };
}

const pool = createPool(createEnemyObj, MAX_ENEMIES);

export function getEnemyPool() { return pool; }

export function spawnEnemy(x, y, typeId, minutesSurvived = 0, elite = false) {
    // Check if it's a boss
    const bossDef = BOSSES[typeId];
    if (bossDef) {
        return spawnBoss(x, y, bossDef, minutesSurvived);
    }

    const baseDef = ENEMIES[typeId];
    if (!baseDef) return null;

    const stats = getScaledStats(baseDef, minutesSurvived);
    const e = pool.acquire();
    if (!e) return null;

    e.x = x;
    e.y = y;
    e.vx = 0;
    e.vy = 0;
    e.radius = stats.radius * (elite ? 1.5 : 1);
    e.health = stats.health * (elite ? 3 : 1);
    e.maxHealth = e.health;
    e.damage = stats.damage;
    e.speed = stats.speed * (elite ? 1.1 : 1);
    e.xpValue = stats.xpValue * (elite ? 5 : 1);
    e.color = stats.color;
    e.type = typeId;
    e.ai = stats.ai;
    e.isElite = elite;
    e.isBoss = false;
    e.targetAngle = 0;
    e.sinePhase = randomRange(0, Math.PI * 2);
    e.attackRange = stats.attackRange || 0;
    e.attackCooldownMax = stats.attackCooldown || 2.0;
    e.attackCooldown = randomRange(0.5, e.attackCooldownMax);
    e.projectileSpeed = stats.projectileSpeed || 200;
    e.explosionRadius = stats.explosionRadius || 0;
    e.explosionDamage = stats.explosionDamage || 0;
    e.chargeState = 'approach';
    e.chargeTimer = 0;
    e.pulseTimer = 0;
    e.hitFlashTimer = 0;
    e.knockbackVx = 0;
    e.knockbackVy = 0;
    e.knockbackTimer = 0;
    e.knockbackResist = stats.knockbackResist || 0;
    if (elite) e.knockbackResist = Math.min(0.95, e.knockbackResist + 0.3);
    e.dying = false;
    e.deathTimer = 0;
    e.deathRotation = 0;
    e.slowTimer = 0;
    e.slowFactor = 1;
    e.bossPhase = 'normal';
    e.specialTimer1 = 0;
    e.specialTimer2 = 0;
    return e;
}

function spawnBoss(x, y, bossDef, minutesSurvived) {
    const stats = getScaledBossStats(bossDef, minutesSurvived);
    const e = pool.acquire();
    if (!e) return null;

    e.x = x;
    e.y = y;
    e.vx = 0;
    e.vy = 0;
    e.radius = stats.radius;
    e.health = stats.health;
    e.maxHealth = e.health;
    e.damage = stats.damage;
    e.speed = stats.speed;
    e.xpValue = stats.xpValue;
    e.color = stats.color;
    e.type = bossDef.id;
    e.ai = stats.ai;
    e.isElite = false;
    e.isBoss = true;
    e.targetAngle = 0;
    e.sinePhase = 0;
    e.hitFlashTimer = 0;
    e.knockbackVx = 0;
    e.knockbackVy = 0;
    e.knockbackTimer = 0;
    e.knockbackResist = stats.knockbackResist || 0;
    e.dying = false;
    e.deathTimer = 0;
    e.deathRotation = 0;
    e.slowTimer = 0;
    e.slowFactor = 1;
    e.bossPhase = 'normal';

    // Boss-specific data
    e.slamCooldown = stats.slamCooldown || 0;
    e.slamRadius = stats.slamRadius || 0;
    e.slamDamage = stats.slamDamage || 0;
    e.spawnType = stats.spawnType || '';
    e.spawnCount = stats.spawnCount || 0;
    e.spawnCooldown = stats.spawnCooldown || 0;
    e.teleportCooldown = stats.teleportCooldown || 0;
    e.teleportRange = stats.teleportRange || 0;
    e.chargeCooldown = stats.chargeCooldown || 0;
    e.chargeSpeed = stats.chargeSpeed || 0;
    e.chargeDuration = stats.chargeDuration || 0;
    e.attackRange = stats.attackRange || 0;
    e.attackCooldownMax = stats.attackCooldown || 2.0;
    e.attackCooldown = 2.0;
    e.projectileSpeed = stats.projectileSpeed || 250;
    e.spreadCount = stats.spreadCount || 1;
    e.spreadAngle = stats.spreadAngle || 0;
    e.chargeState = 'normal';
    e.chargeTimer = 0;
    e.specialTimer1 = stats.slamCooldown || stats.spawnCooldown || stats.chargeCooldown || 3;
    e.specialTimer2 = stats.teleportCooldown || stats.spawnCooldown || 5;
    e.explosionRadius = 0;
    e.explosionDamage = 0;
    e.pulseTimer = 0;
    return e;
}

export function updateEnemies(player, dt) {
    pool.forEach(e => {
        // Tick dying enemies — skip all AI
        if (e.dying) {
            e.deathTimer -= dt;
            e.deathRotation += dt * 3;
            if (e.deathTimer <= 0) pool.release(e);
            return;
        }

        // Update hit flash
        if (e.hitFlashTimer > 0) e.hitFlashTimer -= dt;

        // Update knockback — skip AI while being knocked back
        if (e.knockbackTimer > 0) {
            e.x += e.knockbackVx * dt;
            e.y += e.knockbackVy * dt;
            e.knockbackVx *= 0.9;
            e.knockbackVy *= 0.9;
            e.knockbackTimer -= dt;
            return; // stunned during knockback
        }

        // Update slow
        if (e.slowTimer > 0) {
            e.slowTimer -= dt;
            if (e.slowTimer <= 0) {
                e.slowFactor = 1;
            }
        }

        const angle = angleBetween(e, player);
        e.targetAngle = angle;
        const speedMult = e.slowFactor;

        switch (e.ai) {
            case 'chase': chaseAI(e, player, dt, speedMult); break;
            case 'sine_chase': sinChaseAI(e, player, dt, speedMult); break;
            case 'swarm': swarmAI(e, player, dt, speedMult); break;
            case 'ranged': rangedAI(e, player, dt, speedMult); break;
            case 'charge_explode': chargeExplodeAI(e, player, dt, speedMult); break;
            case 'boss_colossus': bossColossusAI(e, player, dt, speedMult); break;
            case 'boss_queen': bossQueenAI(e, player, dt, speedMult); break;
            case 'boss_knight': bossKnightAI(e, player, dt, speedMult); break;
            case 'boss_elder': bossElderAI(e, player, dt, speedMult); break;
            default: chaseAI(e, player, dt, speedMult);
        }
    });
}

// === Basic AI ===

function chaseAI(e, player, dt, speedMult) {
    const dir = v2FromAngle(e.targetAngle);
    e.vx = dir.x * e.speed * speedMult;
    e.vy = dir.y * e.speed * speedMult;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
}

function sinChaseAI(e, player, dt, speedMult) {
    e.sinePhase += dt * 6;
    const angle = e.targetAngle;
    const perpAngle = angle + Math.PI / 2;
    const sineOffset = Math.sin(e.sinePhase) * 40;
    const dir = v2FromAngle(angle);
    const sp = e.speed * speedMult;
    e.vx = dir.x * sp + Math.cos(perpAngle) * sineOffset * speedMult;
    e.vy = dir.y * sp + Math.sin(perpAngle) * sineOffset * speedMult;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
}

function swarmAI(e, player, dt, speedMult) {
    const angle = e.targetAngle + randomRange(-0.3, 0.3);
    const dir = v2FromAngle(angle);
    e.vx = dir.x * e.speed * speedMult;
    e.vy = dir.y * e.speed * speedMult;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
}

function rangedAI(e, player, dt, speedMult) {
    const dist = v2Dist(e, player);
    const range = e.attackRange || 250;

    if (dist > range * 1.2) {
        chaseAI(e, player, dt, speedMult);
    } else if (dist < range * 0.6) {
        const dir = v2FromAngle(e.targetAngle + Math.PI);
        e.vx = dir.x * e.speed * 0.5 * speedMult;
        e.vy = dir.y * e.speed * 0.5 * speedMult;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
    } else {
        e.sinePhase += dt * 2;
        const strafeAngle = e.targetAngle + Math.PI / 2;
        const strafeDir = v2FromAngle(strafeAngle);
        const strafe = Math.sin(e.sinePhase) * e.speed * 0.4 * speedMult;
        e.vx = strafeDir.x * strafe;
        e.vy = strafeDir.y * strafe;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
    }

    e.attackCooldown -= dt;
    if (e.attackCooldown <= 0 && dist < range * 1.5) {
        e.attackCooldown = e.attackCooldownMax;
        const angle = angleBetween(e, player);
        const dir = v2FromAngle(angle);
        spawnProjectile(e.x, e.y, dir.x * e.projectileSpeed, dir.y * e.projectileSpeed,
            { radius: 5, damage: e.damage, pierce: 0, lifetime: 2.0, color: '#AAFF44', type: 'enemy' });
    }
}

function chargeExplodeAI(e, player, dt, speedMult) {
    const dist = v2Dist(e, player);
    e.pulseTimer += dt;

    switch (e.chargeState) {
        case 'approach':
            chaseAI(e, player, dt, speedMult);
            if (dist < 120) {
                e.chargeState = 'charging';
                e.chargeTimer = 0.8;
            }
            break;
        case 'charging':
            e.vx = 0; e.vy = 0;
            e.chargeTimer -= dt;
            if (e.chargeTimer <= 0) {
                e.chargeState = 'rushing';
                e.chargeTimer = 1.5;
            }
            break;
        case 'rushing': {
            const rushDir = v2FromAngle(e.targetAngle);
            const rushSpeed = e.speed * 3 * speedMult;
            e.vx = rushDir.x * rushSpeed;
            e.vy = rushDir.y * rushSpeed;
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            e.chargeTimer -= dt;
            if (dist < e.radius + player.radius + 5 || e.chargeTimer <= 0) {
                e.chargeState = 'exploding';
                e.health = 0;
            }
            break;
        }
        case 'exploding': break;
    }
}

// === Boss AI ===

// Flesh Colossus: slow chase, periodic ground slam, spawns shamblers
function bossColossusAI(e, player, dt, speedMult) {
    const dist = v2Dist(e, player);

    if (e.bossPhase === 'slamming') {
        e.vx = 0; e.vy = 0;
        e.chargeTimer -= dt;
        if (e.chargeTimer <= 0) {
            // Slam damage in area
            if (dist < e.slamRadius) {
                // Damage dealt via collision in game.js, but we can spawn a visual
                spawnProjectile(e.x, e.y, 0, 0, {
                    radius: e.slamRadius, damage: e.slamDamage, pierce: 999,
                    lifetime: 0.4, color: '#CC6633', type: 'zone',
                    zoneTick: 0.1, zoneTimer: 0,
                });
            }
            // Spawn minions
            for (let i = 0; i < e.spawnCount; i++) {
                const angle = randomRange(0, Math.PI * 2);
                const spawnDist = randomRange(50, 100);
                const dir = v2FromAngle(angle, spawnDist);
                spawnEnemy(e.x + dir.x, e.y + dir.y, e.spawnType, 0, false);
            }
            e.bossPhase = 'normal';
            e.specialTimer1 = e.slamCooldown;
        }
    } else {
        // Normal: chase player
        chaseAI(e, player, dt, speedMult);

        e.specialTimer1 -= dt;
        if (e.specialTimer1 <= 0 && dist < 200) {
            e.bossPhase = 'slamming';
            e.chargeTimer = 0.6; // Wind-up
        }
    }
}

// Hive Queen: chase + spawn swarmers + teleport
function bossQueenAI(e, player, dt, speedMult) {
    const dist = v2Dist(e, player);

    // Slow chase
    chaseAI(e, player, dt, speedMult * 0.7);

    // Spawn swarmers
    e.specialTimer1 -= dt;
    if (e.specialTimer1 <= 0) {
        e.specialTimer1 = e.spawnCooldown;
        for (let i = 0; i < e.spawnCount; i++) {
            const angle = randomRange(0, Math.PI * 2);
            const dir = v2FromAngle(angle, randomRange(30, 60));
            spawnEnemy(e.x + dir.x, e.y + dir.y, e.spawnType, 0, false);
        }
    }

    // Teleport if player is far
    e.specialTimer2 -= dt;
    if (e.specialTimer2 <= 0 && dist > 300) {
        e.specialTimer2 = e.teleportCooldown;
        const angle = angleBetween(e, player);
        const dir = v2FromAngle(angle, dist - 150);
        e.x += dir.x;
        e.y += dir.y;
    }
}

// Infernal Knight: charge attack pattern
function bossKnightAI(e, player, dt, speedMult) {
    const dist = v2Dist(e, player);

    if (e.bossPhase === 'charging') {
        const dir = v2FromAngle(e.chargeTimer > 0 ? e.targetAngle : e.sinePhase);
        const rushSpeed = e.chargeSpeed * speedMult;
        e.vx = dir.x * rushSpeed;
        e.vy = dir.y * rushSpeed;
        e.x += e.vx * dt;
        e.y += e.vy * dt;

        // Leave fire trail
        if (Math.random() < 0.4) {
            spawnProjectile(e.x, e.y, 0, 0, {
                radius: 15, damage: e.damage * 0.3, pierce: 999,
                lifetime: 1.5, color: '#FF4400', type: 'zone',
                zoneTick: 0.3, zoneTimer: 0,
            });
        }

        e.chargeTimer -= dt;
        if (e.chargeTimer <= 0) {
            e.bossPhase = 'pausing';
            e.chargeTimer = 1.0; // Pause after charge
        }
    } else if (e.bossPhase === 'pausing') {
        e.vx = 0; e.vy = 0;
        e.chargeTimer -= dt;
        if (e.chargeTimer <= 0) {
            e.bossPhase = 'normal';
            e.specialTimer1 = e.chargeCooldown;
        }
    } else {
        // Normal: chase
        chaseAI(e, player, dt, speedMult);

        e.specialTimer1 -= dt;
        if (e.specialTimer1 <= 0) {
            e.bossPhase = 'charging';
            e.sinePhase = e.targetAngle; // Lock charge direction
            e.chargeTimer = e.chargeDuration;
        }
    }
}

// Elder Spitter: ranged triple-shot, spawns bats
function bossElderAI(e, player, dt, speedMult) {
    const dist = v2Dist(e, player);
    const range = e.attackRange || 350;

    // Movement: keep distance
    if (dist > range * 1.1) {
        chaseAI(e, player, dt, speedMult * 0.6);
    } else if (dist < range * 0.5) {
        const dir = v2FromAngle(e.targetAngle + Math.PI);
        e.vx = dir.x * e.speed * speedMult;
        e.vy = dir.y * e.speed * speedMult;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
    } else {
        e.sinePhase += dt * 1.5;
        const strafeDir = v2FromAngle(e.targetAngle + Math.PI / 2);
        const strafe = Math.sin(e.sinePhase) * e.speed * 0.5 * speedMult;
        e.vx = strafeDir.x * strafe;
        e.vy = strafeDir.y * strafe;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
    }

    // Triple-shot
    e.attackCooldown -= dt;
    if (e.attackCooldown <= 0 && dist < range * 1.5) {
        e.attackCooldown = e.attackCooldownMax;
        const baseAngle = angleBetween(e, player);
        for (let i = 0; i < e.spreadCount; i++) {
            const t = e.spreadCount > 1 ? (i / (e.spreadCount - 1)) - 0.5 : 0;
            const a = baseAngle + t * e.spreadAngle;
            const dir = v2FromAngle(a);
            spawnProjectile(e.x, e.y, dir.x * e.projectileSpeed, dir.y * e.projectileSpeed,
                { radius: 7, damage: e.damage, pierce: 0, lifetime: 2.5, color: '#88FF22', type: 'enemy' });
        }
    }

    // Spawn bats
    e.specialTimer2 -= dt;
    if (e.specialTimer2 <= 0) {
        e.specialTimer2 = e.spawnCooldown;
        for (let i = 0; i < e.spawnCount; i++) {
            const angle = randomRange(0, Math.PI * 2);
            const dir = v2FromAngle(angle, randomRange(40, 80));
            spawnEnemy(e.x + dir.x, e.y + dir.y, e.spawnType, 0, false);
        }
    }
}

// Called when an exploder dies to deal AoE damage
export function triggerExplosion(e, player) {
    if (e.explosionRadius <= 0) return 0;
    const dist = v2Dist(e, player);
    if (dist < e.explosionRadius) {
        return e.explosionDamage;
    }
    return 0;
}

export function startDying(e) {
    e.dying = true;
    e.deathTimer = DEATH_ANIM_DURATION;
    e.deathRotation = 0;
}

export function applyKnockback(enemy, sourceX, sourceY, knockbackDist, knockbackSpeed) {
    if (knockbackDist <= 0 || knockbackSpeed <= 0) return;
    const resist = enemy.knockbackResist || 0;
    const effectiveDist = knockbackDist * (1 - resist);
    const effectiveSpeed = knockbackSpeed * (1 - resist);
    if (effectiveDist < 1) return;

    const angle = Math.atan2(enemy.y - sourceY, enemy.x - sourceX);
    const newTimer = effectiveDist / effectiveSpeed;

    // Take the stronger knockback if already being knocked back
    if (enemy.knockbackTimer > 0) {
        const curSpeed = Math.sqrt(enemy.knockbackVx * enemy.knockbackVx + enemy.knockbackVy * enemy.knockbackVy);
        if (effectiveSpeed <= curSpeed) return;
    }

    enemy.knockbackVx = Math.cos(angle) * effectiveSpeed;
    enemy.knockbackVy = Math.sin(angle) * effectiveSpeed;
    enemy.knockbackTimer = newTimer;
}

export function applyCrowdPush() {
    pool.forEach(e => {
        if (e.knockbackTimer <= 0) return;
        const nearby = queryHash(e.x, e.y, e.radius * 2.5);
        for (const n of nearby) {
            if (n === e || !n.active) continue;
            const dx = n.x - e.x;
            const dy = n.y - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const overlap = (e.radius + n.radius) - dist;
            if (overlap > 0) {
                const pushX = (dx / dist) * overlap * 0.3;
                const pushY = (dy / dist) * overlap * 0.3;
                n.x += pushX;
                n.y += pushY;
            }
        }
    });
}

export function releaseEnemy(e) {
    pool.release(e);
}

export function clearEnemies() {
    pool.clear();
}
