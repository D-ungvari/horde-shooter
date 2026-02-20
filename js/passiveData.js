// Pure data: passive item definitions
// Each passive has 5 levels, stacking per level

export const PASSIVES = {
    piercing: {
        id: 'piercing',
        name: 'Piercing Rounds',
        description: '+1 pierce per level',
        icon: '🎯',
        maxLevel: 5,
        perLevel: { piercingBonus: 1 },
    },
    spread: {
        id: 'spread',
        name: 'Spread Shot',
        description: '+8% projectile count',
        icon: '🔱',
        maxLevel: 5,
        perLevel: { projectileCountMult: 0.08 },
    },
    haste: {
        id: 'haste',
        name: 'Haste',
        description: '+8% attack speed',
        icon: '⚡',
        maxLevel: 5,
        perLevel: { attackSpeedMultiplier: 0.08 },
    },
    armor: {
        id: 'armor',
        name: 'Armor',
        description: '-8% damage taken',
        icon: '🛡️',
        maxLevel: 5,
        perLevel: { armorReduction: 0.08 },
    },
    area: {
        id: 'area',
        name: 'Area',
        description: '+10% AoE radius',
        icon: '💫',
        maxLevel: 5,
        perLevel: { areaMultiplier: 0.10 },
    },
    duration: {
        id: 'duration',
        name: 'Duration',
        description: '+12% effect duration',
        icon: '⏳',
        maxLevel: 5,
        perLevel: { durationMultiplier: 0.12 },
    },
    movespeed: {
        id: 'movespeed',
        name: 'Move Speed',
        description: '+8% movement speed',
        icon: '👟',
        maxLevel: 5,
        perLevel: { speedMultiplier: 0.08 },
    },
    damage: {
        id: 'damage',
        name: 'Damage',
        description: '+10% all damage',
        icon: '⚔️',
        maxLevel: 5,
        perLevel: { damageMultiplier: 0.10 },
    },
    cooldown: {
        id: 'cooldown',
        name: 'Cooldown Reduction',
        description: '-6% all cooldowns',
        icon: '🔄',
        maxLevel: 5,
        perLevel: { cooldownReduction: 0.06 },
    },
    xpmagnet: {
        id: 'xpmagnet',
        name: 'XP Magnet',
        description: '+20% pickup radius',
        icon: '🧲',
        maxLevel: 5,
        perLevel: { magnetRadiusMultiplier: 0.20 },
    },
};

export function getPassiveById(id) {
    return PASSIVES[id] || null;
}
