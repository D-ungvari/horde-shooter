import { SPAWN_DISTANCE_MIN, SPAWN_DISTANCE_MAX, INITIAL_SPAWN_INTERVAL, MIN_SPAWN_INTERVAL, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';
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

// Swarm burst events (025) — periodic directional bursts of swarmers
let swarmBurstTimer = 0;
const SWARM_BURST_INTERVAL = 30; // every 30 seconds

// Wall pattern (024) — periodic wall of enemies along viewport edge
let wallTimer = 0;
const WALL_INTERVAL = 90; // every 90 seconds
const WALL_START_MINUTE = 8; // walls begin at minute 8

// Swarm events (legacy ring swarms)
let swarmTimer = 0;
const SWARM_INTERVAL = 45;

// Deferred spawns queue (for staggered burst spawning)
let deferredSpawns = []; // { delay, x, y, type, minutes, elite }

export function resetSpawner() {
    spawnTimer = INITIAL_SPAWN_INTERVAL;
    elapsedTime = 0;
    nextBossIndex = 0;
    bossActive = false;
    announcements = [];
    nextTierIndex = 0;
    swarmTimer = 30; // first legacy swarm at 30s
    swarmBurstTimer = 30; // first burst at 30s
    wallTimer = WALL_INTERVAL; // first wall at minute 8 + 90s (handled by minute check)
    deferredSpawns = [];
}

export function updateSpawner(player, dt, camera) {
    elapsedTime += dt;
    const minutes = elapsedTime / 60;

    // --- Process deferred spawns (for swarm burst staggering) ---
    processDeferredSpawns(dt, minutes);

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
            const pos = getSpawnPosition(player, 400);
            spawnEnemy(pos.x, pos.y, bossEntry.bossId, minutes, false);
            bossActive = true;
            nextBossIndex++;

            // Trigger a wall on boss spawn (024) if past minute 8
            if (minutes >= WALL_START_MINUTE && camera) {
                triggerWall(player, camera);
            }
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

    // --- Regular enemy spawning (with group/wave tiers — 023) ---
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        const countMult = bossActive ? 0.4 : 1;

        if (minutes >= 15) {
            // 15+ min: continuous flood — 5-8 per event, minimum interval
            const count = Math.max(1, Math.floor((randomRange(5, 8) | 0) * countMult));
            for (let i = 0; i < count; i++) {
                const type = pickEnemyType();
                const pos = getSpawnPosition(player);
                const elite = Math.random() < getEliteChance();
                spawnEnemy(pos.x, pos.y, type, minutes, elite);
            }
            spawnTimer = MIN_SPAWN_INTERVAL;
        } else if (minutes >= 10) {
            // 10-15 min: wave of 15-20 from a screen edge
            const waveCount = Math.max(1, Math.floor((randomRange(15, 20) | 0) * countMult));
            if (camera) {
                spawnEdgeWave(player, camera, waveCount, minutes);
            } else {
                // Fallback: ring spawn if no camera
                for (let i = 0; i < waveCount; i++) {
                    const type = pickEnemyType();
                    const pos = getSpawnPosition(player);
                    const elite = Math.random() < getEliteChance();
                    spawnEnemy(pos.x, pos.y, type, minutes, elite);
                }
            }
            spawnTimer = getCurrentInterval();
        } else if (minutes >= 5) {
            // 5-10 min: group of 3-5 in a cluster
            const groupSize = Math.max(1, Math.floor((randomRange(3, 5) | 0) * countMult));
            const type = pickEnemyType();
            const pos = getSpawnPosition(player);
            for (let i = 0; i < groupSize; i++) {
                const elite = minutes > 5 && Math.random() < getEliteChance();
                spawnEnemy(
                    pos.x + randomRange(-50, 50),
                    pos.y + randomRange(-50, 50),
                    type, minutes, elite
                );
            }
            spawnTimer = getCurrentInterval();
        } else {
            // Under 5 min: original single-spawn behavior
            const count = Math.max(1, Math.floor(getSpawnCount() * countMult));
            for (let i = 0; i < count; i++) {
                const type = pickEnemyType();
                const pos = getSpawnPosition(player);
                const elite = minutes > 5 && Math.random() < getEliteChance();
                spawnEnemy(pos.x, pos.y, type, minutes, elite);
            }
            spawnTimer = getCurrentInterval();
        }
    }

    // --- Legacy swarm events (ring swarms) ---
    swarmTimer -= dt;
    if (swarmTimer <= 0) {
        triggerSwarmEvent(player);
        swarmTimer = SWARM_INTERVAL;
    }

    // --- Wall pattern (024) — every 90s after minute 8 ---
    if (minutes >= WALL_START_MINUTE) {
        wallTimer -= dt;
        if (wallTimer <= 0) {
            if (camera) {
                triggerWall(player, camera);
            }
            wallTimer = WALL_INTERVAL;
        }
    }

    // --- Swarm burst events (025) — every 30s ---
    swarmBurstTimer -= dt;
    if (swarmBurstTimer <= 0) {
        if (camera) {
            triggerSwarmBurst(player, camera);
        }
        swarmBurstTimer = SWARM_BURST_INTERVAL;
    }
}

// === 023 — Edge wave spawning ===
// Spawns a wave of enemies along a random screen edge
function spawnEdgeWave(player, camera, count, minutes) {
    const edge = Math.floor(Math.random() * 4); // 0=top, 1=bottom, 2=left, 3=right
    const viewLeft = camera.x - camera.halfW;
    const viewRight = camera.x + camera.halfW;
    const viewTop = camera.y - camera.halfH;
    const viewBottom = camera.y + camera.halfH;
    const margin = 60; // spawn just outside viewport

    for (let i = 0; i < count; i++) {
        let x, y;
        const t = i / Math.max(1, count - 1); // 0..1 spread

        switch (edge) {
            case 0: // top
                x = viewLeft + t * CANVAS_WIDTH + randomRange(-20, 20);
                y = viewTop - margin + randomRange(-20, 0);
                break;
            case 1: // bottom
                x = viewLeft + t * CANVAS_WIDTH + randomRange(-20, 20);
                y = viewBottom + margin + randomRange(0, 20);
                break;
            case 2: // left
                x = viewLeft - margin + randomRange(-20, 0);
                y = viewTop + t * CANVAS_HEIGHT + randomRange(-20, 20);
                break;
            case 3: // right
                x = viewRight + margin + randomRange(0, 20);
                y = viewTop + t * CANVAS_HEIGHT + randomRange(-20, 20);
                break;
        }

        const type = pickEnemyType();
        const elite = Math.random() < getEliteChance();
        spawnEnemy(x, y, type, minutes, elite);
    }
}

// === 024 — The Wall spawn pattern ===
function triggerWall(player, camera) {
    const minutes = elapsedTime / 60;
    const edge = Math.floor(Math.random() * 4); // 0=top, 1=bottom, 2=left, 3=right
    const count = (randomRange(20, 30) | 0);

    // Pick wall type: shamblers before minute 12, mixed after
    const useMixed = minutes >= 12;

    const viewLeft = camera.x - camera.halfW;
    const viewRight = camera.x + camera.halfW;
    const viewTop = camera.y - camera.halfH;
    const viewBottom = camera.y + camera.halfH;
    const margin = 40; // spawn just outside viewport

    // Capture player position at time of wall spawn for wallTarget
    const playerSnapX = player.x;
    const playerSnapY = player.y;

    for (let i = 0; i < count; i++) {
        let x, y;
        const t = i / Math.max(1, count - 1);

        switch (edge) {
            case 0: // top
                x = viewLeft + t * CANVAS_WIDTH;
                y = viewTop - margin;
                break;
            case 1: // bottom
                x = viewLeft + t * CANVAS_WIDTH;
                y = viewBottom + margin;
                break;
            case 2: // left
                x = viewLeft - margin;
                y = viewTop + t * CANVAS_HEIGHT;
                break;
            case 3: // right
                x = viewRight + margin;
                y = viewTop + t * CANVAS_HEIGHT;
                break;
        }

        let type = 'shambler';
        if (useMixed) {
            const wallTypes = ['shambler', 'runner', 'swarmer', 'bat'];
            type = wallTypes[Math.floor(Math.random() * wallTypes.length)];
        }

        const e = spawnEnemy(x, y, type, minutes, false);
        if (e) {
            // Set wall target: march straight toward player snapshot for 5 seconds
            e.wallTargetX = playerSnapX;
            e.wallTargetY = playerSnapY;
            e.wallTimer = 5.0;
        }
    }

    const edgeNames = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];
    announcements.push({ text: `THE WALL — ${edgeNames[edge]}!`, time: elapsedTime });
}

// === 025 — Swarm burst events ===
// Burst of 30-50 swarmers from ONE screen edge, staggered over 0.5s
function triggerSwarmBurst(player, camera) {
    const minutes = elapsedTime / 60;
    const count = (randomRange(30, 50) | 0);
    const edge = Math.floor(Math.random() * 4);

    const viewLeft = camera.x - camera.halfW;
    const viewRight = camera.x + camera.halfW;
    const viewTop = camera.y - camera.halfH;
    const viewBottom = camera.y + camera.halfH;
    const margin = 50;

    for (let i = 0; i < count; i++) {
        let x, y;
        // Random position along the chosen edge
        switch (edge) {
            case 0: // top
                x = viewLeft + Math.random() * CANVAS_WIDTH;
                y = viewTop - margin + randomRange(-10, 0);
                break;
            case 1: // bottom
                x = viewLeft + Math.random() * CANVAS_WIDTH;
                y = viewBottom + margin + randomRange(0, 10);
                break;
            case 2: // left
                x = viewLeft - margin + randomRange(-10, 0);
                y = viewTop + Math.random() * CANVAS_HEIGHT;
                break;
            case 3: // right
                x = viewRight + margin + randomRange(0, 10);
                y = viewTop + Math.random() * CANVAS_HEIGHT;
                break;
        }

        // Stagger spawns over 0-0.5s
        const delay = randomRange(0, 0.5);
        deferredSpawns.push({
            delay,
            x, y,
            type: 'swarmer',
            minutes,
            elite: false,
        });
    }

    const edgeNames = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];
    announcements.push({ text: `SWARMER BURST — ${edgeNames[edge]}!`, time: elapsedTime });
}

// Process deferred spawns (tick delays, spawn when ready)
function processDeferredSpawns(dt, minutes) {
    let i = deferredSpawns.length;
    while (i--) {
        const d = deferredSpawns[i];
        d.delay -= dt;
        if (d.delay <= 0) {
            spawnEnemy(d.x, d.y, d.type, d.minutes, d.elite);
            // Fast remove: swap with last
            deferredSpawns[i] = deferredSpawns[deferredSpawns.length - 1];
            deferredSpawns.pop();
        }
    }
}

// === Legacy swarm event (ring around player) ===
function triggerSwarmEvent(player) {
    const minutes = elapsedTime / 60;
    let swarmType = 'swarmer';
    if (minutes > 10) {
        const types = ['swarmer', 'runner', 'bat', 'exploder'];
        swarmType = types[Math.floor(Math.random() * types.length)];
    } else if (minutes > 5) {
        const types = ['swarmer', 'runner', 'bat'];
        swarmType = types[Math.floor(Math.random() * types.length)];
    }

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

    if (minutes > 15) {
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
