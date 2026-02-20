// Stat calculator: recalculates player stats from base + passives (+ meta bonuses later)
import {
    PLAYER_SPEED, PLAYER_COLLECT_RADIUS, PLAYER_MAGNET_RADIUS, PLAYER_MAX_HEALTH,
    XP_BASE, XP_EXPONENT
} from './constants.js';
import { PASSIVES } from './passiveData.js';

// Recalculate all derived stats based on current passives
export function recalculateStats(player) {
    // Start from base values
    let damageBonus = 0;
    let attackSpeedBonus = 0;
    let cooldownReduction = 0;
    let areaBonus = 0;
    let piercingBonus = 0;
    let durationBonus = 0;
    let armorReduction = 0;
    let speedBonus = 0;
    let magnetBonus = 0;

    // Sum passive bonuses
    for (const passive of player.passives) {
        const def = PASSIVES[passive.id];
        if (!def) continue;
        const lvl = passive.level;

        const pL = def.perLevel;
        if (pL.damageMultiplier)       damageBonus += pL.damageMultiplier * lvl;
        if (pL.attackSpeedMultiplier)   attackSpeedBonus += pL.attackSpeedMultiplier * lvl;
        if (pL.cooldownReduction)       cooldownReduction += pL.cooldownReduction * lvl;
        if (pL.areaMultiplier)          areaBonus += pL.areaMultiplier * lvl;
        if (pL.piercingBonus)           piercingBonus += pL.piercingBonus * lvl;
        if (pL.durationMultiplier)      durationBonus += pL.durationMultiplier * lvl;
        if (pL.armorReduction)          armorReduction += pL.armorReduction * lvl;
        if (pL.speedMultiplier)         speedBonus += pL.speedMultiplier * lvl;
        if (pL.magnetRadiusMultiplier)  magnetBonus += pL.magnetRadiusMultiplier * lvl;
    }

    // Apply to player stats
    player.damageMultiplier = 1 + damageBonus;
    player.attackSpeedMultiplier = 1 + attackSpeedBonus;
    player.cooldownReduction = Math.min(cooldownReduction, 0.5); // cap at 50%
    player.areaMultiplier = 1 + areaBonus;
    player.piercingBonus = piercingBonus;
    player.durationMultiplier = 1 + durationBonus;
    player.armorMultiplier = Math.max(1 - armorReduction, 0.2); // cap at 80% reduction
    player.speed = PLAYER_SPEED * (1 + speedBonus);
    player.magnetRadius = PLAYER_MAGNET_RADIUS * (1 + magnetBonus);
    player.collectRadius = PLAYER_COLLECT_RADIUS * (1 + magnetBonus * 0.5);
}

// XP needed for a given level: floor(XP_BASE * level^XP_EXPONENT)
export function xpForLevel(level) {
    return Math.floor(XP_BASE * Math.pow(level, XP_EXPONENT));
}

// Grant XP to player, returns number of level-ups triggered
export function grantXP(player, amount) {
    const scaledAmount = Math.ceil(amount * (player.xpMultiplier || 1));
    player.xp += scaledAmount;

    let levelUps = 0;
    while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;
        player.xpToNext = xpForLevel(player.level);
        levelUps++;
    }
    return levelUps;
}
