// XP gem pool — dropped by enemies, magneted to player, collected for XP
import { createPool } from './objectPool.js';
import { MAX_XP_GEMS, COLOR_XP_SMALL, COLOR_XP_MEDIUM, COLOR_XP_LARGE } from './constants.js';
import { v2Dist, v2Normalize, v2Sub } from './utils.js';

const GEM_TIERS = {
    small:  { radius: 4, color: COLOR_XP_SMALL,  xpValue: 1 },
    medium: { radius: 6, color: COLOR_XP_MEDIUM,  xpValue: 5 },
    large:  { radius: 8, color: COLOR_XP_LARGE,   xpValue: 15 },
};

function createGemObj() {
    return {
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        radius: 4,
        color: COLOR_XP_SMALL,
        xpValue: 1,
        tier: 'small',
        age: 0,
        magnetted: false,
    };
}

const pool = createPool(createGemObj, MAX_XP_GEMS);

export function getXPPool() { return pool; }

export function spawnXPGem(x, y, xpValue) {
    // Decide tier based on value
    let tier;
    if (xpValue >= 10) tier = 'large';
    else if (xpValue >= 4) tier = 'medium';
    else tier = 'small';

    const def = GEM_TIERS[tier];
    const gem = pool.acquire();
    if (!gem) return null;

    gem.x = x;
    gem.y = y;
    // Small scatter on spawn
    gem.vx = (Math.random() - 0.5) * 80;
    gem.vy = (Math.random() - 0.5) * 80;
    gem.radius = def.radius;
    gem.color = def.color;
    gem.xpValue = xpValue;
    gem.tier = tier;
    gem.age = 0;
    gem.magnetted = false;
    return gem;
}

// Spawn multiple small gems in a burst (for regular enemies)
export function spawnXPBurst(x, y, totalXP) {
    if (totalXP <= 0) return;

    // Split into gems: mostly small, with mediums and larges for big values
    let remaining = totalXP;

    while (remaining >= 15) {
        spawnXPGem(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, 15);
        remaining -= 15;
    }
    while (remaining >= 5) {
        spawnXPGem(x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 16, 5);
        remaining -= 5;
    }
    while (remaining >= 1) {
        const val = Math.min(remaining, 2);
        spawnXPGem(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, val);
        remaining -= val;
    }
}

export function updateXPGems(player, dt) {
    const collected = [];

    pool.forEach(gem => {
        gem.age += dt;

        // Scatter momentum decays
        gem.vx *= 0.92;
        gem.vy *= 0.92;

        const dist = v2Dist(gem, player);

        // Magnet pull — gems within magnetRadius accelerate toward player
        if (dist < player.magnetRadius) {
            gem.magnetted = true;
        }

        if (gem.magnetted) {
            const dir = v2Normalize(v2Sub(player, gem));
            const pullSpeed = 400 + (1 - dist / player.magnetRadius) * 300;
            gem.vx = dir.x * pullSpeed;
            gem.vy = dir.y * pullSpeed;
        }

        gem.x += gem.vx * dt;
        gem.y += gem.vy * dt;

        // Collection — gems within collectRadius
        if (dist < player.collectRadius + gem.radius) {
            collected.push(gem);
        }
    });

    // Process collections
    let totalXP = 0;
    for (const gem of collected) {
        totalXP += gem.xpValue;
        pool.release(gem);
    }

    return totalXP;
}

export function clearXPGems() {
    pool.clear();
}
