import { SPAWN_DISTANCE_MIN, SPAWN_DISTANCE_MAX, INITIAL_SPAWN_INTERVAL, MIN_SPAWN_INTERVAL } from './constants.js';
import { spawnEnemy, getEnemyPool } from './enemy.js';
import { BOSS_SCHEDULE } from './enemyData.js';
import { randomRange, v2FromAngle } from './utils.js';

let spawnTimer = 0;
let elapsedTime = 0;
let nextBossIndex = 0;
let bossActive = false;
let announcements = []; // { text, triggeredAt }

// Difficulty tier announcements
const DIFFICULTY_TIERS = [
    { minute: 1, label: 'Enemies grow stronger...' },
    { minute: 3, label: 'Danger rising!' },
    { minute: 5, label: 'BOSS INCOMING!' },
    { minute: 7, label: 'Onslaught!' },
    { minute: 10, label: 'BOSS INCOMING!' },
    { minute: 12, label: 'Nightmare!' },
    { minute: 15, label: 'BOSS INCOMING!' },
    { minute: 17, label: 'HELL MODE!' },
    { minute: 20, label: 'FINAL BOSS!' },
];
let nextTierIndex = 0;

// Swarm events — periodic bursts of a single type
let swarmTimer = 0;
const SWARM_INTERVAL = 45; // seconds between swarm events

export function resetSpawner() {
    spawnTimer = INITIAL_SPAWN_INTERVAL;
    elapsedTime = 0;
    nextBossIndex = 0;
    bossActive = false;
    announcements = [];
    nextTierIndex = 0;
    swarmTimer = 30; // first swarm at 30s
}

export function updateSpawner(player, dt) {
    elapsedTime += dt;
    const minutes = elapsedTime / 60;

    // --- Difficulty tier announcements ---
    if (nextTierIndex < DIFFICULTY_TIERS.length) {
        const tier = DIFFICULTY_TIERS[nextTierIndex];
        if (minutes >= tier.minute) {
            announcements.push({ text: tier.label, time: elapsedTime });
            nextTierIndex++;
        }
    }

    // --- Boss spawning ---
    if (nextBossIndex < BOSS_SCHEDULE.length) {
        const bossEntry = BOSS_SCHEDULE[nextBossIndex];
        if (minutes >= bossEntry.minute) {
            const pos = getSpawnPosition(player, 400); // spawn slightly closer
            spawnEnemy(pos.x, pos.y, bossEntry.bossId, minutes, false);
            bossActive = true;
            nextBossIndex++;
        }
    }

    // Check if boss is still alive
    if (bossActive) {
        let foundBoss = false;
        getEnemyPool().forEach(e => {
            if (e.isBoss) foundBoss = true;
        });
        if (!foundBoss) bossActive = false;
    }

    // --- Regular enemy spawning ---
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        // Reduce spawns while boss is active (focus on boss fight)
        const countMult = bossActive ? 0.4 : 1;
        const count = Math.max(1, Math.floor(getSpawnCount() * countMult));
        for (let i = 0; i < count; i++) {
            const type = pickEnemyType();
            const pos = getSpawnPosition(player);
            const elite = minutes > 5 && Math.random() < getEliteChance();
            spawnEnemy(pos.x, pos.y, type, minutes, elite);
        }
        spawnTimer = getCurrentInterval();
    }

    // --- Swarm events ---
    swarmTimer -= dt;
    if (swarmTimer <= 0) {
        triggerSwarmEvent(player);
        swarmTimer = SWARM_INTERVAL;
    }
}

function triggerSwarmEvent(player) {
    const minutes = elapsedTime / 60;
    // Pick a swarm type based on time
    let swarmType = 'swarmer';
    if (minutes > 10) {
        const types = ['swarmer', 'runner', 'bat', 'exploder'];
        swarmType = types[Math.floor(Math.random() * types.length)];
    } else if (minutes > 5) {
        const types = ['swarmer', 'runner', 'bat'];
        swarmType = types[Math.floor(Math.random() * types.length)];
    }

    // Spawn in a ring around the player
    const count = Math.floor(8 + minutes * 2);
    const baseAngle = randomRange(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
        const angle = baseAngle + (Math.PI * 2 / count) * i + randomRange(-0.15, 0.15);
        const dist = randomRange(SPAWN_DISTANCE_MIN, SPAWN_DISTANCE_MAX);
        const dir = v2FromAngle(angle, dist);
        spawnEnemy(player.x + dir.x, player.y + dir.y, swarmType, minutes, false);
    }

    announcements.push({ text: `${swarmType.toUpperCase()} SWARM!`, time: elapsedTime });
}

function pickEnemyType() {
    const minutes = elapsedTime / 60;
    const roll = Math.random();

    // Weighted by time — later enemies are more varied and dangerous
    if (minutes > 15) {
        // Endgame: everything
        if (roll < 0.08) return 'exploder';
        if (roll < 0.18) return 'brute';
        if (roll < 0.28) return 'spitter';
        if (roll < 0.40) return 'bat';
        if (roll < 0.55) return 'swarmer';
        if (roll < 0.75) return 'runner';
        return 'shambler';
    }
    if (minutes > 8) {
        if (roll < 0.05) return 'exploder';
        if (roll < 0.13) return 'brute';
        if (roll < 0.22) return 'spitter';
        if (roll < 0.35) return 'bat';
        if (roll < 0.45) return 'swarmer';
        if (roll < 0.65) return 'runner';
        return 'shambler';
    }
    if (minutes > 4) {
        if (roll < 0.08) return 'spitter';
        if (roll < 0.20) return 'bat';
        if (roll < 0.30) return 'swarmer';
        if (roll < 0.50) return 'runner';
        return 'shambler';
    }
    if (minutes > 2) {
        if (roll < 0.10) return 'bat';
        if (roll < 0.20) return 'swarmer';
        if (roll < 0.45) return 'runner';
        return 'shambler';
    }
    // First 2 min: mostly basic
    if (roll < 0.35) return 'runner';
    return 'shambler';
}

function getSpawnCount() {
    const minutes = elapsedTime / 60;
    if (minutes < 1) return 1;
    if (minutes < 2) return randomRange(1, 2) | 0;
    if (minutes < 4) return randomRange(1, 3) | 0;
    if (minutes < 7) return randomRange(2, 4) | 0;
    if (minutes < 12) return randomRange(2, 5) | 0;
    if (minutes < 18) return randomRange(3, 6) | 0;
    return randomRange(4, 8) | 0;
}

function getCurrentInterval() {
    const minutes = elapsedTime / 60;
    // Faster spawning as time goes on
    const interval = INITIAL_SPAWN_INTERVAL - minutes * 0.10;
    return Math.max(MIN_SPAWN_INTERVAL, interval);
}

function getEliteChance() {
    const minutes = elapsedTime / 60;
    if (minutes < 5) return 0;
    if (minutes < 10) return 0.03;
    if (minutes < 15) return 0.06;
    return 0.10;
}

function getSpawnPosition(player, customDist) {
    const angle = randomRange(0, Math.PI * 2);
    const dist = customDist || randomRange(SPAWN_DISTANCE_MIN, SPAWN_DISTANCE_MAX);
    const dir = v2FromAngle(angle, dist);
    return {
        x: player.x + dir.x,
        y: player.y + dir.y,
    };
}

export function getElapsedTime() { return elapsedTime; }

// Get and clear pending announcements
export function getAnnouncements() {
    const pending = announcements.slice();
    announcements.length = 0;
    return pending;
}
