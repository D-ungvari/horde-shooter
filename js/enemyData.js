// Pure data: enemy type definitions

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
    },
};

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
