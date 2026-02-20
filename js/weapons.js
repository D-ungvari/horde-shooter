import { getWeaponStats } from './weaponData.js';
import { spawnProjectile } from './projectile.js';
import { getMouseWorld } from './input.js';
import { v2Normalize, v2FromAngle, angleBetween, randomRange } from './utils.js';

// Cooldown timers per weapon slot
const cooldowns = [];

export function resetWeaponCooldowns() {
    cooldowns.length = 0;
}

export function updateWeapons(player, dt) {
    const mouseWorld = getMouseWorld();

    for (let i = 0; i < player.weapons.length; i++) {
        const weapon = player.weapons[i];
        const stats = getWeaponStats(weapon.id, weapon.level);
        if (!stats) continue;

        // Init cooldown slot
        if (cooldowns[i] === undefined) cooldowns[i] = 0;

        // Apply player stat modifiers
        const effectiveCooldown = stats.cooldown
            * (1 - player.cooldownReduction)
            / (player.attackSpeedMultiplier || 1);

        cooldowns[i] -= dt;

        if (cooldowns[i] <= 0) {
            const canFire = fireWeapon(player, stats, mouseWorld);
            if (canFire) {
                cooldowns[i] = effectiveCooldown;
            }
        }
    }
}

function fireWeapon(player, stats, mouseWorld) {
    const pattern = stats.pattern;
    const effectiveDamage = stats.damage * player.damageMultiplier;
    const effectivePierce = stats.pierce + player.piercingBonus;
    const effectiveLifetime = (stats.projectileLifetime || 1) * player.durationMultiplier;

    if (pattern === 'aimed_single') {
        return fireAimedSingle(player, stats, mouseWorld, effectiveDamage, effectivePierce, effectiveLifetime);
    } else if (pattern === 'aimed_spread') {
        return fireAimedSpread(player, stats, mouseWorld, effectiveDamage, effectivePierce, effectiveLifetime);
    }
    // TODO: auto_chain, aimed_cone, auto_boomerang, auto_orbital, auto_zone, auto_burst

    return false;
}

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
