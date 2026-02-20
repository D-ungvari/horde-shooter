import {
    PLAYER_RADIUS, PLAYER_SPEED, PLAYER_MAX_HEALTH,
    PLAYER_INVINCIBILITY, PLAYER_COLLECT_RADIUS, PLAYER_MAGNET_RADIUS
} from './constants.js';
import { isKeyDown, getMouseWorld } from './input.js';
import { v2Normalize, angleBetween } from './utils.js';

export function createPlayer(x = 0, y = 0) {
    return {
        x, y,
        radius: PLAYER_RADIUS,
        vx: 0, vy: 0,
        health: PLAYER_MAX_HEALTH,
        maxHealth: PLAYER_MAX_HEALTH,
        invincible: 0,
        aimAngle: 0,

        // Stats (base — modified by stats.js recalculate)
        speed: PLAYER_SPEED,
        collectRadius: PLAYER_COLLECT_RADIUS,
        magnetRadius: PLAYER_MAGNET_RADIUS,
        damageMultiplier: 1,
        attackSpeedMultiplier: 1,
        cooldownReduction: 0,
        areaMultiplier: 1,
        piercingBonus: 0,
        durationMultiplier: 1,
        armorMultiplier: 1,
        xpMultiplier: 1,

        // Progression
        level: 1,
        xp: 0,
        xpToNext: 10,
        weapons: [],    // [{ id, level }]
        passives: [],   // [{ id, level }]

        // Run stats
        killCount: 0,
        goldEarned: 0,
    };
}

export function updatePlayer(player, dt) {
    // Movement input (WASD + arrows)
    let mx = 0, my = 0;
    if (isKeyDown('a') || isKeyDown('arrowleft'))  mx -= 1;
    if (isKeyDown('d') || isKeyDown('arrowright')) mx += 1;
    if (isKeyDown('w') || isKeyDown('arrowup'))    my -= 1;
    if (isKeyDown('s') || isKeyDown('arrowdown'))  my += 1;

    // Normalize diagonal movement
    const dir = v2Normalize({ x: mx, y: my });
    player.vx = dir.x * player.speed;
    player.vy = dir.y * player.speed;

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Aim angle toward mouse (world coords)
    const mouseWorld = getMouseWorld();
    player.aimAngle = angleBetween(player, mouseWorld);

    // Invincibility timer
    if (player.invincible > 0) {
        player.invincible -= dt;
    }
}

export function damagePlayer(player, amount) {
    if (player.invincible > 0) return false;
    const reduced = amount * player.armorMultiplier;
    player.health -= reduced;
    player.invincible = PLAYER_INVINCIBILITY;
    return true;
}

export function healPlayer(player, amount) {
    player.health = Math.min(player.health + amount, player.maxHealth);
}
