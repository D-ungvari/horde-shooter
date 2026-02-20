import { SPAWN_DISTANCE_MIN, SPAWN_DISTANCE_MAX, INITIAL_SPAWN_INTERVAL, MIN_SPAWN_INTERVAL } from './constants.js';
import { spawnEnemy, getEnemyPool } from './enemy.js';
import { randomRange, v2FromAngle } from './utils.js';

let spawnTimer = 0;
let elapsedTime = 0;

export function resetSpawner() {
    spawnTimer = INITIAL_SPAWN_INTERVAL;
    elapsedTime = 0;
}

export function updateSpawner(player, dt) {
    elapsedTime += dt;
    spawnTimer -= dt;

    if (spawnTimer <= 0) {
        const count = getSpawnCount();
        for (let i = 0; i < count; i++) {
            const type = pickEnemyType();
            const pos = getSpawnPosition(player);
            const minutes = elapsedTime / 60;
            const elite = minutes > 5 && Math.random() < 0.03;
            spawnEnemy(pos.x, pos.y, type, minutes, elite);
        }
        spawnTimer = getCurrentInterval();
    }
}

function pickEnemyType() {
    const minutes = elapsedTime / 60;
    const roll = Math.random();

    if (minutes > 8 && roll < 0.05) return 'exploder';
    if (minutes > 6 && roll < 0.12) return 'brute';
    if (minutes > 4 && roll < 0.20) return 'spitter';
    if (minutes > 3 && roll < 0.30) return 'bat';
    if (minutes > 2 && roll < 0.35) return 'swarmer';
    if (roll < 0.45) return 'runner';
    return 'shambler';
}

function getSpawnCount() {
    const minutes = elapsedTime / 60;
    // Spawn more enemies as time goes on
    if (minutes < 1) return 1;
    if (minutes < 3) return randomRange(1, 2) | 0;
    if (minutes < 6) return randomRange(1, 3) | 0;
    if (minutes < 10) return randomRange(2, 4) | 0;
    return randomRange(3, 6) | 0;
}

function getCurrentInterval() {
    const minutes = elapsedTime / 60;
    const interval = INITIAL_SPAWN_INTERVAL - minutes * 0.12;
    return Math.max(MIN_SPAWN_INTERVAL, interval);
}

function getSpawnPosition(player) {
    const angle = randomRange(0, Math.PI * 2);
    const dist = randomRange(SPAWN_DISTANCE_MIN, SPAWN_DISTANCE_MAX);
    const dir = v2FromAngle(angle, dist);
    return {
        x: player.x + dir.x,
        y: player.y + dir.y,
    };
}

export function getElapsedTime() { return elapsedTime; }
