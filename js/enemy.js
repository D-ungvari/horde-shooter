import { createPool } from './objectPool.js';
import { MAX_ENEMIES } from './constants.js';
import { ENEMIES, getScaledStats } from './enemyData.js';
import { spawnProjectile } from './projectile.js';
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
        // AI-specific state
        sinePhase: 0,
        attackCooldown: 0,
        chargeState: 'approach', // for charge_explode: approach, charging, exploding
        chargeTimer: 0,
        // Ranged attack data (from enemyData)
        attackRange: 0,
        attackCooldownMax: 0,
        projectileSpeed: 0,
        // Slow/freeze
        slowTimer: 0,
        slowFactor: 1,
        // Exploder
        explosionRadius: 0,
        explosionDamage: 0,
        pulseTimer: 0,
    };
}

const pool = createPool(createEnemyObj, MAX_ENEMIES);

export function getEnemyPool() { return pool; }

export function spawnEnemy(x, y, typeId, minutesSurvived = 0, elite = false) {
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
    e.targetAngle = 0;
    e.sinePhase = randomRange(0, Math.PI * 2);
    // Ranged data
    e.attackRange = stats.attackRange || 0;
    e.attackCooldownMax = stats.attackCooldown || 2.0;
    e.attackCooldown = randomRange(0.5, e.attackCooldownMax); // stagger initial shots
    e.projectileSpeed = stats.projectileSpeed || 200;
    // Exploder data
    e.explosionRadius = stats.explosionRadius || 0;
    e.explosionDamage = stats.explosionDamage || 0;
    e.chargeState = 'approach';
    e.chargeTimer = 0;
    e.pulseTimer = 0;
    // Slow
    e.slowTimer = 0;
    e.slowFactor = 1;
    return e;
}

export function updateEnemies(player, dt) {
    pool.forEach(e => {
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
            case 'chase':
                chaseAI(e, player, dt, speedMult);
                break;
            case 'sine_chase':
                sinChaseAI(e, player, dt, speedMult);
                break;
            case 'swarm':
                swarmAI(e, player, dt, speedMult);
                break;
            case 'ranged':
                rangedAI(e, player, dt, speedMult);
                break;
            case 'charge_explode':
                chargeExplodeAI(e, player, dt, speedMult);
                break;
            default:
                chaseAI(e, player, dt, speedMult);
        }
    });
}

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
        // Too far — chase toward player
        chaseAI(e, player, dt, speedMult);
    } else if (dist < range * 0.6) {
        // Too close — retreat
        const dir = v2FromAngle(e.targetAngle + Math.PI);
        e.vx = dir.x * e.speed * 0.5 * speedMult;
        e.vy = dir.y * e.speed * 0.5 * speedMult;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
    } else {
        // In range — strafe and shoot
        e.sinePhase += dt * 2;
        const strafeAngle = e.targetAngle + Math.PI / 2;
        const strafeDir = v2FromAngle(strafeAngle);
        const strafe = Math.sin(e.sinePhase) * e.speed * 0.4 * speedMult;
        e.vx = strafeDir.x * strafe;
        e.vy = strafeDir.y * strafe;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
    }

    // Shoot projectile at player
    e.attackCooldown -= dt;
    if (e.attackCooldown <= 0 && dist < range * 1.5) {
        e.attackCooldown = e.attackCooldownMax;
        const angle = angleBetween(e, player);
        const dir = v2FromAngle(angle);
        const speed = e.projectileSpeed;
        spawnProjectile(e.x, e.y,
            dir.x * speed, dir.y * speed,
            {
                radius: 5,
                damage: e.damage,
                pierce: 0,
                lifetime: 2.0,
                color: '#AAFF44',
                type: 'enemy',
            }
        );
    }
}

function chargeExplodeAI(e, player, dt, speedMult) {
    const dist = v2Dist(e, player);
    e.pulseTimer += dt;

    switch (e.chargeState) {
        case 'approach':
            // Normal chase until close
            chaseAI(e, player, dt, speedMult);
            if (dist < 120) {
                e.chargeState = 'charging';
                e.chargeTimer = 0.8; // Wind-up time
            }
            break;

        case 'charging':
            // Stop and pulse (warning)
            e.vx = 0;
            e.vy = 0;
            e.chargeTimer -= dt;
            if (e.chargeTimer <= 0) {
                e.chargeState = 'rushing';
                e.chargeTimer = 1.5;
            }
            break;

        case 'rushing':
            // Fast dash toward player
            const rushDir = v2FromAngle(e.targetAngle);
            const rushSpeed = e.speed * 3 * speedMult;
            e.vx = rushDir.x * rushSpeed;
            e.vy = rushDir.y * rushSpeed;
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            e.chargeTimer -= dt;

            // Explode on contact or timer end
            if (dist < e.radius + player.radius + 5 || e.chargeTimer <= 0) {
                e.chargeState = 'exploding';
                e.health = 0; // Die on explosion (handled by game.js)
            }
            break;

        case 'exploding':
            // Already dead/exploding — handled in game.js collision phase
            break;
    }
}

// Called when an exploder dies to deal AoE damage
export function triggerExplosion(e, player) {
    if (e.explosionRadius <= 0) return;
    const dist = v2Dist(e, player);
    if (dist < e.explosionRadius) {
        return e.explosionDamage; // Damage to apply to player
    }
    return 0;
}

export function releaseEnemy(e) {
    pool.release(e);
}

export function clearEnemies() {
    pool.clear();
}
