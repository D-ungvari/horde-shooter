// Mid-run save/load system
// Saves essential game state to localStorage so players can resume

const SAVE_RUN_KEY = 'horde_shooter_run';

/**
 * Save current run state
 */
export function saveRun(data) {
    try {
        const payload = {
            version: 1,
            timestamp: Date.now(),
            player: {
                x: data.player.x,
                y: data.player.y,
                health: data.player.health,
                maxHealth: data.player.maxHealth,
                level: data.player.level,
                xp: data.player.xp,
                xpToNext: data.player.xpToNext,
                killCount: data.player.killCount,
                weapons: data.player.weapons.map(w => ({ id: w.id, level: w.level })),
                passives: data.player.passives.map(p => ({ id: p.id, level: p.level })),
            },
            survivalTime: data.survivalTime,
            biome: data.biome,
        };
        localStorage.setItem(SAVE_RUN_KEY, JSON.stringify(payload));
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Load a saved run (returns null if no save exists)
 */
export function loadRun() {
    try {
        const raw = localStorage.getItem(SAVE_RUN_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.version !== 1) return null;
        // Check save isn't too old (24 hours)
        if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
            clearRunSave();
            return null;
        }
        return data;
    } catch (e) {
        return null;
    }
}

/**
 * Clear saved run data
 */
export function clearRunSave() {
    try {
        localStorage.removeItem(SAVE_RUN_KEY);
    } catch (e) { /* silently fail */ }
}

/**
 * Check if a saved run exists
 */
export function hasSavedRun() {
    return loadRun() !== null;
}
