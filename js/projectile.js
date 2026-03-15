import { createPool } from './objectPool.js';
import { MAX_PROJECTILES } from './constants.js';
import { spawnParticle } from './effects.js';
import { randomRange } from './utils.js';

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
        type: 'normal', // normal, flame, lightning, boomerang, zone, frostburst, firezone, chakram, plaguezone, frostdot, enemy
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
        // Chakram state
        bounceCount: 0,
        maxBounces: 0,
        // Plague zone state
        isPlague: false,
        // Frost DOT state
        freezeDotDamage: 0,
        freezeDotTick: 0,
        freezeDotTimer: 0,
        // Status effect to apply on hit (033)
        statusEffect: '', // 'burning', 'frozen', 'poisoned', 'electrified', 'weakened'
        // Knockback
        knockbackDist: 0,
        knockbackSpeed: 0,
        // Trail (ring buffer of 6 previous positions)
        trailX: new Float32Array(6),
        trailY: new Float32Array(6),
        trailHead: 0,
        trailCount: 0,
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
    // Chakram
    p.bounceCount = opts.bounceCount || 0;
    p.maxBounces = opts.maxBounces || 0;
    // Plague
    p.isPlague = opts.isPlague || false;
    // Frost DOT
    p.freezeDotDamage = opts.freezeDotDamage || 0;
    p.freezeDotTick = opts.freezeDotTick || 0;
    p.freezeDotTimer = 0;
    // Status effect (033)
    p.statusEffect = opts.statusEffect || '';
    // Knockback
    p.knockbackDist = opts.knockbackDist || 0;
    p.knockbackSpeed = opts.knockbackSpeed || 0;
    // Trail
    p.trailHead = 0;
    p.trailCount = 0;
    return p;
}

// Types that get trail effects (moving projectiles only)
const TRAIL_TYPES = new Set(['normal', 'flame', 'boomerang', 'chakram', 'enemy']);

export function updateProjectiles(dt, player) {
    pool.forEach(p => {
        // Record trail position before movement
        if (TRAIL_TYPES.has(p.type)) {
            p.trailX[p.trailHead] = p.x;
            p.trailY[p.trailHead] = p.y;
            p.trailHead = (p.trailHead + 1) % 6;
            if (p.trailCount < 6) p.trailCount++;
        }

        p.lifetime += dt;

        if (p.type === 'boomerang' || p.type === 'chakram') {
            updateBoomerang(p, dt, player);
        } else if (p.type === 'zone' || p.type === 'firezone' || p.type === 'plaguezone') {
            // Zones don't move, just tick
            p.zoneTimer += dt;
            if (p.zoneTimer >= p.zoneTick) {
                p.zoneTimer -= p.zoneTick;
                p.hitSet.clear(); // Allow re-hitting on each tick
            }
        } else if (p.type === 'frostdot') {
            // Frost DOT zone: tick damage on frozen enemies nearby
            p.freezeDotTimer += dt;
            // hitSet cleared each tick so collision system re-applies damage
            if (p.freezeDotTimer >= p.freezeDotTick) {
                p.freezeDotTimer -= p.freezeDotTick;
                p.hitSet.clear();
            }
        } else {
            // Normal movement
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // (031) Rocket smoke trail — 1 gray smoke particle every ~3 frames
            if (p.aoeRadius > 0 && p.type === 'normal' && Math.random() < 0.33) {
                spawnParticle(
                    p.x + randomRange(-3, 3), p.y + randomRange(-3, 3),
                    randomRange(-15, 15), randomRange(-15, 15),
                    randomRange(2, 4), '#888888',
                    randomRange(0.3, 0.6), true, 0
                );
            }
        }

        if (p.lifetime >= p.maxLifetime) {
            pool.release(p);
        }
    });
}

function updateBoomerang(p, dt, player) {
    const isChakram = p.type === 'chakram';
    const halfLife = p.maxLifetime * (isChakram ? 0.35 : 0.45);

    if (p.lifetime < halfLife) {
        // Outward phase
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Chakram: wider sweeping arc via perpendicular drift
        if (isChakram) {
            const perpX = -p.vy * 0.3 * dt;
            const perpY = p.vx * 0.3 * dt;
            p.x += perpX;
            p.y += perpY;
            p.vx *= 0.97;
            p.vy *= 0.97;
        } else {
            p.vx *= 0.98;
            p.vy *= 0.98;
        }
    } else {
        // Return phase — head toward player's current position
        if (player) {
            const dx = player.x - p.x;
            const dy = player.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
                const speed = isChakram ? 650 : 500;
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
        // Chakram clears hit set periodically on return to enable multi-bounce hits
        if (isChakram && p.bounceCount < p.maxBounces) {
            p.bounceCount++;
            p.hitSet.clear();
        }
    }
}

export function releaseProjectile(p) {
    pool.release(p);
}

export function clearProjectiles() {
    pool.clear();
}
