// Pure data: enemy type definitions + boss definitions

export const ENEMIES = {
    shambler: {
        id: 'shambler',
        name: 'Shambler',
        health: 8,
        speed: 40,
        damage: 8,
        radius: 12,
        xpValue: 2,
        color: '#44AA44',
        ai: 'chase',
        knockbackResist: 0,
    },
    runner: {
        id: 'runner',
        name: 'Runner',
        health: 3,
        speed: 120,
        damage: 5,
        radius: 8,
        xpValue: 1,
        color: '#FF4444',
        ai: 'chase',
        knockbackResist: 0.1,
    },
    bat: {
        id: 'bat',
        name: 'Bat',
        health: 2,
        speed: 80,
        damage: 4,
        radius: 8,
        xpValue: 1,
        color: '#AA44CC',
        ai: 'sine_chase',
        knockbackResist: 0,
    },
    brute: {
        id: 'brute',
        name: 'Brute',
        health: 40,
        speed: 30,
        damage: 20,
        radius: 20,
        xpValue: 8,
        color: '#FF8800',
        ai: 'chase',
        knockbackResist: 0.7,
    },
    spitter: {
        id: 'spitter',
        name: 'Spitter',
        health: 12,
        speed: 35,
        damage: 6,
        radius: 10,
        xpValue: 3,
        color: '#88CC44',
        ai: 'ranged',
        attackRange: 250,
        attackCooldown: 2.0,
        projectileSpeed: 200,
        knockbackResist: 0.2,
    },
    swarmer: {
        id: 'swarmer',
        name: 'Swarmer',
        health: 1,
        speed: 150,
        damage: 2,
        radius: 5,
        xpValue: 1,
        color: '#333344',
        ai: 'swarm',
        knockbackResist: 0,
    },
    exploder: {
        id: 'exploder',
        name: 'Exploder',
        health: 6,
        speed: 90,
        damage: 15,
        radius: 10,
        xpValue: 3,
        color: '#FF2222',
        ai: 'charge_explode',
        explosionRadius: 60,
        explosionDamage: 25,
        knockbackResist: 0,
    },
};

// --- Boss definitions ---
export const BOSSES = {
    flesh_colossus: {
        id: 'flesh_colossus',
        name: 'Flesh Colossus',
        health: 500,
        speed: 22,
        damage: 30,
        radius: 40,
        xpValue: 100,
        color: '#CC6633',
        ai: 'boss_colossus',
        isBoss: true,
        knockbackResist: 0.9,
        // Slam attack: AoE shockwave + spawn shamblers
        slamCooldown: 5.0,
        slamRadius: 120,
        slamDamage: 25,
        spawnType: 'shambler',
        spawnCount: 4,
    },
    hive_queen: {
        id: 'hive_queen',
        name: 'Hive Queen',
        health: 350,
        speed: 35,
        damage: 15,
        radius: 30,
        xpValue: 100,
        color: '#8844AA',
        ai: 'boss_queen',
        isBoss: true,
        knockbackResist: 0.9,
        // Spawns swarmer packs, poison trail, teleports
        spawnCooldown: 3.0,
        spawnType: 'swarmer',
        spawnCount: 6,
        teleportCooldown: 8.0,
        teleportRange: 300,
    },
    infernal_knight: {
        id: 'infernal_knight',
        name: 'Infernal Knight',
        health: 400,
        speed: 60,
        damage: 25,
        radius: 28,
        xpValue: 100,
        color: '#FF4400',
        ai: 'boss_knight',
        isBoss: true,
        knockbackResist: 0.9,
        // Fast charge + pause pattern, fire trail
        chargeCooldown: 4.0,
        chargeSpeed: 250,
        chargeDuration: 1.0,
    },
    elder_spitter: {
        id: 'elder_spitter',
        name: 'Elder Spitter',
        health: 300,
        speed: 28,
        damage: 20,
        radius: 32,
        xpValue: 100,
        color: '#66AA22',
        ai: 'boss_elder',
        isBoss: true,
        knockbackResist: 0.9,
        // Triple-shot spread, spawns bats
        attackRange: 350,
        attackCooldown: 1.5,
        projectileSpeed: 250,
        spreadCount: 3,
        spreadAngle: 0.4,
        spawnType: 'bat',
        spawnCount: 3,
        spawnCooldown: 6.0,
    },
};

// Boss schedule: which boss spawns at which minute mark
export const BOSS_SCHEDULE = [
    { minute: 5, bossId: 'flesh_colossus' },
    { minute: 10, bossId: 'hive_queen' },
    { minute: 15, bossId: 'infernal_knight' },
    { minute: 20, bossId: 'elder_spitter' },
];

// Difficulty scaling per minute survived
export function getScaledStats(enemyDef, minutesSurvived) {
    const hpScale = 1 + minutesSurvived * 0.15;
    const dmgScale = 1 + minutesSurvived * 0.08;
    const spdScale = 1 + Math.min(minutesSurvived * 0.02, 0.4);
    return {
        ...enemyDef,
        health: Math.ceil(enemyDef.health * hpScale),
        damage: Math.ceil(enemyDef.damage * dmgScale),
        speed: enemyDef.speed * spdScale,
    };
}

// Boss scaling is gentler — they're already tough
export function getScaledBossStats(bossDef, minutesSurvived) {
    const hpScale = 1 + minutesSurvived * 0.08;
    const dmgScale = 1 + minutesSurvived * 0.05;
    return {
        ...bossDef,
        health: Math.ceil(bossDef.health * hpScale),
        damage: Math.ceil(bossDef.damage * dmgScale),
    };
}
