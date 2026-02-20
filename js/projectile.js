import { createPool } from './objectPool.js';
import { MAX_PROJECTILES } from './constants.js';

function createProjectileObj() {
    return {
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        radius: 4,
        damage: 0,
        pierce: 0,
        lifetime: 0,
        maxLifetime: 1.0,
        color: '#FFDD44',
        aoeRadius: 0,
        type: 'normal', // normal, flame, lightning, boomerang, zone, frostburst, enemy
        // Tracking which enemies were hit (for pierce)
        hitSet: new Set(),
        // Boomerang state
        ownerX: 0,
        ownerY: 0,
        returning: false,
        // Zone state
        zoneTick: 0,
        zoneTimer: 0,
        // Lightning visual
        x1: 0, y1: 0, x2: 0, y2: 0,
    };
}

const pool = createPool(createProjectileObj, MAX_PROJECTILES);

export function getProjectilePool() { return pool; }

export function spawnProjectile(x, y, vx, vy, opts = {}) {
    const p = pool.acquire();
    if (!p) return null;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.radius = opts.radius || 4;
    p.damage = opts.damage || 10;
    p.pierce = opts.pierce || 0;
    p.lifetime = 0;
    p.maxLifetime = opts.lifetime || 1.0;
    p.color = opts.color || '#FFDD44';
    p.aoeRadius = opts.aoeRadius || 0;
    p.type = opts.type || 'normal';
    p.hitSet.clear();
    // Boomerang
    p.ownerX = opts.ownerX || 0;
    p.ownerY = opts.ownerY || 0;
    p.returning = false;
    // Zone
    p.zoneTick = opts.zoneTick || 0;
    p.zoneTimer = opts.zoneTimer || 0;
    // Lightning visual endpoints
    p.x1 = opts.x1 || 0;
    p.y1 = opts.y1 || 0;
    p.x2 = opts.x2 || 0;
    p.y2 = opts.y2 || 0;
    return p;
}

export function updateProjectiles(dt, player) {
    pool.forEach(p => {
        p.lifetime += dt;

        if (p.type === 'boomerang') {
            updateBoomerang(p, dt, player);
        } else if (p.type === 'zone') {
            // Zones don't move, just tick
            p.zoneTimer += dt;
            if (p.zoneTimer >= p.zoneTick) {
                p.zoneTimer -= p.zoneTick;
                p.hitSet.clear(); // Allow re-hitting on each tick
            }
        } else {
            // Normal movement
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }

        if (p.lifetime >= p.maxLifetime) {
            pool.release(p);
        }
    });
}

function updateBoomerang(p, dt, player) {
    const halfLife = p.maxLifetime * 0.45;

    if (p.lifetime < halfLife) {
        // Outward phase
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Slow down
        p.vx *= 0.98;
        p.vy *= 0.98;
    } else {
        // Return phase — head toward player's current position
        if (player) {
            const dx = player.x - p.x;
            const dy = player.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
                const speed = 500;
                p.vx = (dx / dist) * speed;
                p.vy = (dy / dist) * speed;
            }
            // Collect when close to player
            if (dist < player.radius + 20) {
                pool.release(p);
                return;
            }
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.returning = true;
    }
}

export function releaseProjectile(p) {
    pool.release(p);
}

export function clearProjectiles() {
    pool.clear();
}
