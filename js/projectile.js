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
        // Tracking which enemies were hit (for pierce)
        hitSet: new Set(),
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
    p.hitSet.clear();
    return p;
}

export function updateProjectiles(dt) {
    pool.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.lifetime += dt;
        if (p.lifetime >= p.maxLifetime) {
            pool.release(p);
        }
    });
}

export function releaseProjectile(p) {
    pool.release(p);
}

export function clearProjectiles() {
    pool.clear();
}
