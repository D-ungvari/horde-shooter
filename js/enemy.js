import { createPool } from './objectPool.js';
import { MAX_ENEMIES } from './constants.js';
import { ENEMIES, getScaledStats } from './enemyData.js';
import { angleBetween, v2FromAngle, randomRange } from './utils.js';

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
        chargeState: 'approach', // for charge_explode
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
    e.attackCooldown = stats.attackCooldown || 0;
    e.chargeState = 'approach';
    return e;
}

export function updateEnemies(player, dt) {
    pool.forEach(e => {
        const angle = angleBetween(e, player);
        e.targetAngle = angle;

        switch (e.ai) {
            case 'chase':
                chaseAI(e, player, dt);
                break;
            case 'sine_chase':
                sinChaseAI(e, player, dt);
                break;
            case 'swarm':
                swarmAI(e, player, dt);
                break;
            case 'ranged':
                // Simple chase for now, ranged attack added later
                chaseAI(e, player, dt);
                break;
            case 'charge_explode':
                chaseAI(e, player, dt); // Simplified for now
                break;
            default:
                chaseAI(e, player, dt);
        }
    });
}

function chaseAI(e, player, dt) {
    const dir = v2FromAngle(e.targetAngle);
    e.vx = dir.x * e.speed;
    e.vy = dir.y * e.speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
}

function sinChaseAI(e, player, dt) {
    e.sinePhase += dt * 6;
    const angle = e.targetAngle;
    const perpAngle = angle + Math.PI / 2;
    const sineOffset = Math.sin(e.sinePhase) * 40;

    const dir = v2FromAngle(angle);
    e.vx = dir.x * e.speed + Math.cos(perpAngle) * sineOffset;
    e.vy = dir.y * e.speed + Math.sin(perpAngle) * sineOffset;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
}

function swarmAI(e, player, dt) {
    const angle = e.targetAngle + randomRange(-0.3, 0.3);
    const dir = v2FromAngle(angle);
    e.vx = dir.x * e.speed;
    e.vy = dir.y * e.speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
}

export function releaseEnemy(e) {
    pool.release(e);
}

export function clearEnemies() {
    pool.clear();
}
