// Pure data: weapon definitions + evolution table
// Levels 1-8, evolution at level 8 + matching passive
// Milestones at level 4 and 7 unlock special behaviors (038)
// Visual upgrades at level 3 and 6 (039)

export const WEAPONS = {
    pistol: {
        id: 'pistol',
        name: 'Pistol',
        description: 'Reliable sidearm. Fires toward cursor.',
        icon: '🔫',
        pattern: 'aimed_single',
        baseDamage: 10,
        baseCooldown: 0.4,
        projectileSpeed: 600,
        projectileRadius: 4,
        projectileLifetime: 1.2,
        projectileCount: 1,
        pierce: 0,
        spread: 0,
        color: '#FFDD44',
        knockbackDist: 4,
        knockbackSpeed: 200,
        evolvesWithPassive: 'piercing',
        evolutionId: 'railgun',
        milestones: {
            4: { type: 'ricochet', value: 1 },      // bullets ricochet once off screen edge
            7: { type: 'piercing_nth', value: 5 },   // every 5th shot is piercing
        },
    },
    shotgun: {
        id: 'shotgun',
        name: 'Shotgun',
        description: 'Spread of pellets. Devastating up close.',
        icon: '💥',
        pattern: 'aimed_spread',
        baseDamage: 6,
        baseCooldown: 0.8,
        projectileSpeed: 500,
        projectileRadius: 3,
        projectileLifetime: 0.5,
        projectileCount: 5,
        pierce: 0,
        spread: 0.35, // radians total arc
        color: '#FF8844',
        knockbackDist: 10,
        knockbackSpeed: 300,
        evolvesWithPassive: 'spread',
        evolutionId: 'flak_cannon',
        milestones: {
            4: { type: 'pellets', value: 2 },        // +2 pellets (7 total)
            7: { type: 'burning', value: true },      // pellets apply burning
        },
    },
    smg: {
        id: 'smg',
        name: 'SMG',
        description: 'Rapid fire with slight spread.',
        icon: '🔥',
        pattern: 'aimed_single',
        baseDamage: 4,
        baseCooldown: 0.12,
        projectileSpeed: 550,
        projectileRadius: 3,
        projectileLifetime: 0.8,
        projectileCount: 1,
        pierce: 0,
        spread: 0.15,
        color: '#FFAA22',
        knockbackDist: 4,
        knockbackSpeed: 200,
        evolvesWithPassive: 'haste',
        evolutionId: 'minigun',
        milestones: {
            4: { type: 'explosive_nth', value: 10 }, // every 10th bullet is explosive (small AoE)
            7: { type: 'pierce_bonus', value: 2 },   // +2 pierce (simplified from split-on-kill)
        },
    },
    rocket: {
        id: 'rocket',
        name: 'Rocket Launcher',
        description: 'Slow rocket, big explosion on impact.',
        icon: '🚀',
        pattern: 'aimed_single',
        baseDamage: 30,
        baseCooldown: 2.0,
        projectileSpeed: 250,
        projectileRadius: 6,
        projectileLifetime: 2.0,
        projectileCount: 1,
        pierce: 0,
        spread: 0,
        aoeRadius: 80,
        color: '#FF4422',
        knockbackDist: 40,
        knockbackSpeed: 500,
        evolvesWithPassive: 'damage',
        evolutionId: 'mirv',
        milestones: {
            4: { type: 'lingering_fire', value: 2.0 }, // blast zone leaves lingering fire (2s)
            7: { type: 'mini_rockets', value: 3 },      // fragments into 3 mini-rockets
        },
    },
    lightning: {
        id: 'lightning',
        name: 'Lightning',
        description: 'Chain lightning to nearest enemy.',
        icon: '⚡',
        pattern: 'auto_chain',
        baseDamage: 12,
        baseCooldown: 1.0,
        chainRange: 150,
        chainCount: 2,
        color: '#88CCFF',
        knockbackDist: 0,
        knockbackSpeed: 0,
        evolvesWithPassive: 'area',
        evolutionId: 'thunderstorm',
        milestones: {
            4: { type: 'chain_slow', value: 0.2 },   // chain hits slow enemies 20% for 1s
            7: { type: 'chain_count', value: 2 },     // +2 chain targets (static field simplified)
        },
    },
    flamethrower: {
        id: 'flamethrower',
        name: 'Flamethrower',
        description: 'Short-range cone of fire toward cursor.',
        icon: '🔥',
        pattern: 'aimed_cone',
        baseDamage: 3,
        baseCooldown: 0.05,
        projectileSpeed: 300,
        projectileRadius: 4,
        projectileLifetime: 0.3,
        projectileCount: 1,
        spread: 0.4,
        color: '#FF6622',
        knockbackDist: 2,
        knockbackSpeed: 100,
        evolvesWithPassive: 'duration',
        evolutionId: 'inferno',
        milestones: {
            4: { type: 'burn_amp', value: 0.15 },    // burning enemies take 15% more from all sources
            7: { type: 'cone_width', value: 0.5 },   // flame cone width +50%
        },
    },
    boomerang: {
        id: 'boomerang',
        name: 'Boomerang',
        description: 'Thrown toward nearest enemy, returns.',
        icon: '🪃',
        pattern: 'auto_boomerang',
        baseDamage: 15,
        baseCooldown: 1.5,
        projectileSpeed: 350,
        projectileRadius: 8,
        projectileLifetime: 2.0,
        pierce: 99,
        color: '#44DDAA',
        knockbackDist: 18,
        knockbackSpeed: 250,
        evolvesWithPassive: 'movespeed',
        evolutionId: 'chakram',
        milestones: {
            4: { type: 'return_pierce', value: 3 },  // passes through 3 additional enemies on return
            7: { type: 'double_throw', value: true }, // throws 2 boomerangs
        },
    },
    orbitals: {
        id: 'orbitals',
        name: 'Orbitals',
        description: 'Orbs circle you, damaging enemies on contact.',
        icon: '🔵',
        pattern: 'auto_orbital',
        baseDamage: 8,
        baseCooldown: 0, // continuous
        orbitalCount: 2,
        orbitalRadius: 60,
        orbitalSpeed: 3, // radians per second
        hitRadius: 10,
        color: '#66AAFF',
        knockbackDist: 6,
        knockbackSpeed: 150,
        evolvesWithPassive: 'armor',
        evolutionId: 'guardian_ring',
        milestones: {
            4: { type: 'orbital_count', value: 1 },  // +1 orbital (3 total)
            7: { type: 'orbital_trail', value: true }, // orbitals leave damage trail
        },
    },
    poison: {
        id: 'poison',
        name: 'Poison Cloud',
        description: 'Drops toxic zone at your feet periodically.',
        icon: '☁️',
        pattern: 'auto_zone',
        baseDamage: 5,
        baseCooldown: 3.0,
        zoneRadius: 50,
        zoneDuration: 4.0,
        zoneTick: 0.5,
        color: '#66FF44',
        knockbackDist: 0,
        knockbackSpeed: 0,
        evolvesWithPassive: 'area',
        evolutionId: 'plague',
        milestones: {
            4: { type: 'zone_slow', value: 0.3 },    // enemies in cloud move 30% slower
            7: { type: 'plague_spread', value: true }, // poison spreads on kill (chain)
        },
    },
    frostnova: {
        id: 'frostnova',
        name: 'Frost Nova',
        description: 'Periodic burst that freezes nearby enemies.',
        icon: '❄️',
        pattern: 'auto_burst',
        baseDamage: 8,
        baseCooldown: 4.0,
        burstRadius: 100,
        slowDuration: 2.0,
        slowFactor: 0.4,
        color: '#AADDFF',
        knockbackDist: 12,
        knockbackSpeed: 200,
        evolvesWithPassive: 'cooldown',
        evolutionId: 'absolute_zero',
        milestones: {
            4: { type: 'shatter_bonus', value: 0.5 }, // frozen enemies take 50% more on kill (bonus damage)
            7: { type: 'burst_radius', value: 0.5 },  // nova radius +50%, freeze +1s
        },
    },
    // --- NEW WEAPONS (040-042) ---
    whip: {
        id: 'whip',
        name: 'Whip',
        description: 'Auto-sweeps a 120° arc, hitting all enemies in range.',
        icon: '🔗',
        pattern: 'auto_sweep',
        baseDamage: 12,
        baseCooldown: 1.2,
        sweepRange: 100,
        sweepArc: Math.PI * 2 / 3, // 120 degrees
        color: '#CC88FF',
        knockbackDist: 8,
        knockbackSpeed: 200,
        evolvesWithPassive: 'area',
        evolutionId: 'death_scythe',
        milestones: {
            4: { type: 'sweep_range', value: 0.25 },  // +25% range
            7: { type: 'sweep_arc', value: Math.PI * 2 }, // full 360° sweep
        },
    },
    holywater: {
        id: 'holywater',
        name: 'Holy Water',
        description: 'Drops damage zones at enemy clusters.',
        icon: '💧',
        pattern: 'auto_zone_targeted',
        baseDamage: 8,
        baseCooldown: 3.0,
        zoneRadius: 60,
        zoneDuration: 3.0,
        zoneTick: 0.5,
        color: '#44AAFF',
        knockbackDist: 0,
        knockbackSpeed: 0,
        evolvesWithPassive: 'duration',
        evolutionId: 'blessed_ground',
        milestones: {
            4: { type: 'zone_radius', value: 0.2 },   // +20% zone radius
            7: { type: 'zone_damage', value: 0.5 },    // +50% zone damage
        },
    },
    sawblade: {
        id: 'sawblade',
        name: 'Sawblade',
        description: 'Bounces between enemies, dealing damage on each hit.',
        icon: '🪚',
        pattern: 'auto_ricochet',
        baseDamage: 10,
        baseCooldown: 2.0,
        projectileSpeed: 350,
        projectileRadius: 7,
        projectileLifetime: 4.0,
        maxBounces: 8,
        color: '#CCCCCC',
        knockbackDist: 6,
        knockbackSpeed: 150,
        evolvesWithPassive: 'piercing',
        evolutionId: 'eternal_saw',
        milestones: {
            4: { type: 'bounce_count', value: 4 },     // +4 bounces (12 total)
            7: { type: 'saw_speed', value: 0.5 },      // +50% projectile speed
        },
    },
};

// Evolution definitions (replace weapon + consume passive)
export const EVOLUTIONS = {
    railgun: {
        id: 'railgun', name: 'Rail Gun', icon: '⚡🔫',
        description: 'Infinite pierce, extreme range.',
        pattern: 'aimed_single', baseDamage: 35, baseCooldown: 0.5,
        projectileSpeed: 1200, projectileRadius: 5, projectileLifetime: 2.0,
        projectileCount: 1, pierce: 999, spread: 0, color: '#88EEFF',
        knockbackDist: 8, knockbackSpeed: 300,
    },
    flak_cannon: {
        id: 'flak_cannon', name: 'Flak Cannon', icon: '💥💥',
        description: '9 exploding pellets.',
        pattern: 'aimed_spread', baseDamage: 8, baseCooldown: 0.9,
        projectileSpeed: 450, projectileRadius: 4, projectileLifetime: 0.6,
        projectileCount: 9, pierce: 0, spread: 0.5, aoeRadius: 30, color: '#FF6644',
        knockbackDist: 15, knockbackSpeed: 350,
    },
    minigun: {
        id: 'minigun', name: 'Minigun', icon: '🔥🔥',
        description: 'Extreme fire rate, no spread.',
        pattern: 'aimed_single', baseDamage: 5, baseCooldown: 0.04,
        projectileSpeed: 700, projectileRadius: 3, projectileLifetime: 0.7,
        projectileCount: 1, pierce: 0, spread: 0.02, color: '#FFCC00',
        knockbackDist: 4, knockbackSpeed: 200,
    },
    mirv: {
        id: 'mirv', name: 'MIRV', icon: '🚀💥',
        description: 'Splits into 6 mini-rockets on impact.',
        pattern: 'aimed_single', baseDamage: 40, baseCooldown: 2.5,
        projectileSpeed: 280, projectileRadius: 8, projectileLifetime: 2.0,
        projectileCount: 1, pierce: 0, aoeRadius: 120, mirvCount: 6, color: '#FF2200',
        knockbackDist: 50, knockbackSpeed: 500,
    },
    thunderstorm: {
        id: 'thunderstorm', name: 'Thunderstorm', icon: '⚡⚡',
        description: 'Chain to 5 enemies, auto-target, wider arc.',
        pattern: 'auto_chain', baseDamage: 20, baseCooldown: 0.7,
        chainRange: 200, chainCount: 4, chainArc: true, color: '#44EEFF',
        knockbackDist: 0, knockbackSpeed: 0,
    },
    inferno: {
        id: 'inferno', name: 'Inferno', icon: '🔥🌋',
        description: 'Wider cone, leaves lingering fire zones.',
        pattern: 'aimed_cone', baseDamage: 5, baseCooldown: 0.05,
        projectileSpeed: 350, projectileRadius: 5, projectileLifetime: 0.35,
        projectileCount: 2, spread: 0.6, color: '#FF4400',
        knockbackDist: 3, knockbackSpeed: 120,
        lingeringFire: true, lingerInterval: 3, lingerRadius: 30, lingerDuration: 3.0,
    },
    chakram: {
        id: 'chakram', name: 'Chakram', icon: '🪃💫',
        description: 'Faster spin, wider arc, multi-bounce.',
        pattern: 'auto_boomerang', baseDamage: 25, baseCooldown: 1.0,
        projectileSpeed: 500, projectileRadius: 10, projectileLifetime: 2.5,
        pierce: 99, color: '#22FFCC',
        knockbackDist: 20, knockbackSpeed: 280,
        isChakram: true,
    },
    guardian_ring: {
        id: 'guardian_ring', name: 'Guardian Ring', icon: '🔵🛡️',
        description: '8 orbs, larger radius, periodic damage pulse.',
        pattern: 'auto_orbital', baseDamage: 12, baseCooldown: 0,
        orbitalCount: 8, orbitalRadius: 90, orbitalSpeed: 4, hitRadius: 12,
        color: '#4488FF',
        knockbackDist: 10, knockbackSpeed: 200,
        pulseInterval: 2.0, pulseRadius: 120, pulseDamage: 20,
    },
    plague: {
        id: 'plague', name: 'Plague', icon: '☁️💀',
        description: 'Larger zone, spreads on kill, longer duration.',
        pattern: 'auto_zone', baseDamage: 8, baseCooldown: 2.5,
        zoneRadius: 80, zoneDuration: 6.0, zoneTick: 0.4,
        color: '#88FF22',
        knockbackDist: 0, knockbackSpeed: 0,
        isPlague: true,
    },
    absolute_zero: {
        id: 'absolute_zero', name: 'Absolute Zero', icon: '❄️💀',
        description: 'Larger radius, longer freeze, damage over time.',
        pattern: 'auto_burst', baseDamage: 15, baseCooldown: 3.5,
        burstRadius: 160, slowDuration: 4.0, slowFactor: 0.1,
        color: '#66CCFF',
        knockbackDist: 15, knockbackSpeed: 250,
        freezeDot: true, freezeDotDamage: 5, freezeDotTick: 0.5,
    },
    // --- NEW EVOLUTIONS (040-042) ---
    death_scythe: {
        id: 'death_scythe', name: 'Death Scythe', icon: '🔗💀',
        description: '360° sweep, 150px range, applies weakened.',
        pattern: 'auto_sweep', baseDamage: 20, baseCooldown: 0.9,
        sweepRange: 150, sweepArc: Math.PI * 2, // full 360°
        color: '#AA44FF',
        knockbackDist: 12, knockbackSpeed: 300,
        statusEffect: 'weakened',
    },
    blessed_ground: {
        id: 'blessed_ground', name: 'Blessed Ground', icon: '💧✨',
        description: '10s zone, heals player 1 HP/s while in zone.',
        pattern: 'auto_zone_targeted', baseDamage: 12, baseCooldown: 2.5,
        zoneRadius: 80, zoneDuration: 10.0, zoneTick: 0.4,
        color: '#88DDFF',
        knockbackDist: 0, knockbackSpeed: 0,
        healsPlayer: true, healPerTick: 1,
    },
    eternal_saw: {
        id: 'eternal_saw', name: 'Eternal Saw', icon: '🪚💀',
        description: 'Infinite bounces for 4s, +50% speed.',
        pattern: 'auto_ricochet', baseDamage: 15, baseCooldown: 1.5,
        projectileSpeed: 525, projectileRadius: 9, projectileLifetime: 4.0,
        maxBounces: 999, color: '#FFCC44',
        knockbackDist: 8, knockbackSpeed: 200,
    },
};

// Level scaling: multipliers applied per weapon level
// Milestones (038): check weapon level for milestone effects
// Visual upgrades (039): level 3 brighter/longer trail, level 6 +20% size + glow
export function getWeaponStats(weaponId, level) {
    const base = WEAPONS[weaponId] || EVOLUTIONS[weaponId];
    if (!base) return null;

    const lvl = Math.max(1, Math.min(level, 8));
    const dmgMult = 1 + (lvl - 1) * 0.15;
    const cdMult = 1 - (lvl - 1) * 0.06;
    const countBonus = (lvl >= 3 ? 1 : 0) + (lvl >= 6 ? 1 : 0);
    const pierceBonus = lvl >= 5 ? 1 : 0;

    // Collect active milestones (038)
    const milestones = base.milestones || {};
    const activeMilestones = {};
    for (const [mlvl, milestone] of Object.entries(milestones)) {
        if (lvl >= parseInt(mlvl)) {
            activeMilestones[milestone.type] = milestone.value;
        }
    }

    // Apply milestone stat overrides
    let extraPellets = activeMilestones.pellets || 0;
    let extraPierce = activeMilestones.pierce_bonus || 0;
    let extraOrbitalCount = activeMilestones.orbital_count || 0;
    let extraBounces = activeMilestones.bounce_count || 0;
    let extraChainCount = activeMilestones.chain_count || 0;
    let burstRadiusMult = 1 + (activeMilestones.burst_radius || 0);
    let sweepRangeMult = 1 + (activeMilestones.sweep_range || 0);
    let sweepArcOverride = activeMilestones.sweep_arc;
    let zoneRadiusMult = 1 + (activeMilestones.zone_radius || 0);
    let zoneDamageMult = 1 + (activeMilestones.zone_damage || 0);
    let coneWidthMult = 1 + (activeMilestones.cone_width || 0);
    let sawSpeedMult = 1 + (activeMilestones.saw_speed || 0);

    // Visual level data (039)
    const visualLevel = lvl >= 6 ? 2 : (lvl >= 3 ? 1 : 0);
    const sizeMultiplier = lvl >= 6 ? 1.2 : 1.0;

    return {
        ...base,
        damage: base.baseDamage * dmgMult * zoneDamageMult,
        cooldown: base.baseCooldown * Math.max(0.3, cdMult),
        projectileCount: (base.projectileCount || 0) + countBonus + extraPellets,
        pierce: (base.pierce || 0) + pierceBonus + extraPierce,
        // Milestones (038)
        activeMilestones,
        // Orbital milestone
        orbitalCount: (base.orbitalCount || 0) + extraOrbitalCount,
        // Chain milestone
        chainCount: (base.chainCount || 0) + extraChainCount,
        // Bounce milestone
        maxBounces: (base.maxBounces || 0) + extraBounces,
        // Burst radius milestone
        burstRadius: (base.burstRadius || 0) * burstRadiusMult,
        // Sweep milestones (040)
        sweepRange: (base.sweepRange || 0) * sweepRangeMult,
        sweepArc: sweepArcOverride !== undefined ? sweepArcOverride : (base.sweepArc || 0),
        // Zone radius milestone (041)
        zoneRadius: (base.zoneRadius || 0) * zoneRadiusMult,
        // Cone width milestone
        spread: (base.spread || 0) * coneWidthMult,
        // Saw speed milestone (042)
        projectileSpeed: (base.projectileSpeed || 0) * sawSpeedMult,
        // Visual upgrades (039)
        visualLevel,
        sizeMultiplier,
        projectileRadius: (base.projectileRadius || 4) * sizeMultiplier,
    };
}
