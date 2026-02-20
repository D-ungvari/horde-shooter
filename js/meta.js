// Meta-progression: persistent gold, permanent upgrades, biome unlocks
// All data persisted to localStorage

const SAVE_KEY = 'horde_shooter_meta';

export const META_UPGRADES = {
    max_health: {
        name: 'Vitality', icon: '\u2764\uFE0F', desc: '+10% max HP',
        perLevel: 0.10, maxLevel: 5, baseCost: 50, costScale: 1.5,
    },
    damage: {
        name: 'Power', icon: '\u2694\uFE0F', desc: '+8% damage',
        perLevel: 0.08, maxLevel: 5, baseCost: 75, costScale: 1.5,
    },
    speed: {
        name: 'Agility', icon: '\uD83D\uDC5F', desc: '+6% move speed',
        perLevel: 0.06, maxLevel: 5, baseCost: 60, costScale: 1.5,
    },
    armor: {
        name: 'Toughness', icon: '\uD83D\uDEE1\uFE0F', desc: '-8% damage taken',
        perLevel: 0.08, maxLevel: 5, baseCost: 75, costScale: 1.5,
    },
    xp_gain: {
        name: 'Wisdom', icon: '\uD83D\uDCDA', desc: '+10% XP gain',
        perLevel: 0.10, maxLevel: 5, baseCost: 50, costScale: 1.5,
    },
    pickup_range: {
        name: 'Magnetism', icon: '\uD83E\uDDF2', desc: '+15% pickup range',
        perLevel: 0.15, maxLevel: 5, baseCost: 40, costScale: 1.5,
    },
};

export const BIOME_UNLOCK_CONDITIONS = {
    graveyard: null,
    volcano: { biome: 'graveyard', surviveMinutes: 10 },
    void: { biome: 'volcano', surviveMinutes: 10 },
};

function getDefaultSave() {
    return {
        gold: 0,
        upgrades: {},
        biomeUnlocks: { graveyard: true, volcano: false, void: false },
        bestStats: { longestSurvival: 0, mostKills: 0, highestLevel: 0, totalGold: 0 },
    };
}

let saveData = null;

export function loadMeta() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            saveData = JSON.parse(raw);
            const def = getDefaultSave();
            if (!saveData.upgrades) saveData.upgrades = {};
            if (!saveData.biomeUnlocks) saveData.biomeUnlocks = def.biomeUnlocks;
            if (!saveData.bestStats) saveData.bestStats = def.bestStats;
            if (saveData.gold === undefined) saveData.gold = 0;
        } else {
            saveData = getDefaultSave();
        }
    } catch (e) {
        saveData = getDefaultSave();
    }
    return saveData;
}

function saveMeta() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch (e) { /* silently fail on quota */ }
}

export function getMeta() {
    if (!saveData) loadMeta();
    return saveData;
}

export function getGold() {
    return getMeta().gold;
}

export function getUpgradeLevel(upgradeId) {
    return getMeta().upgrades[upgradeId] || 0;
}

export function getUpgradeCost(upgradeId) {
    const def = META_UPGRADES[upgradeId];
    if (!def) return Infinity;
    const level = getUpgradeLevel(upgradeId);
    if (level >= def.maxLevel) return Infinity;
    return Math.floor(def.baseCost * Math.pow(def.costScale, level));
}

export function purchaseUpgrade(upgradeId) {
    const cost = getUpgradeCost(upgradeId);
    if (cost === Infinity) return false;
    if (getMeta().gold < cost) return false;

    saveData.gold -= cost;
    saveData.upgrades[upgradeId] = (saveData.upgrades[upgradeId] || 0) + 1;
    saveMeta();
    return true;
}

export function isBiomeUnlocked(biomeId) {
    return getMeta().biomeUnlocks[biomeId] === true;
}

// Award gold at end of run + check biome unlocks
export function awardEndOfRun(kills, survivalSeconds, level, biome) {
    const minutes = survivalSeconds / 60;
    const goldEarned = Math.floor(kills * 1 + minutes * 10 + (level - 1) * 5);

    saveData.gold += goldEarned;

    // Update best stats
    if (survivalSeconds > saveData.bestStats.longestSurvival) {
        saveData.bestStats.longestSurvival = survivalSeconds;
    }
    if (kills > saveData.bestStats.mostKills) {
        saveData.bestStats.mostKills = kills;
    }
    if (level > saveData.bestStats.highestLevel) {
        saveData.bestStats.highestLevel = level;
    }
    saveData.bestStats.totalGold = (saveData.bestStats.totalGold || 0) + goldEarned;

    // Check biome unlocks
    let newUnlock = null;
    for (const [biomeId, condition] of Object.entries(BIOME_UNLOCK_CONDITIONS)) {
        if (!condition) continue;
        if (saveData.biomeUnlocks[biomeId]) continue;
        if (biome === condition.biome && minutes >= condition.surviveMinutes) {
            saveData.biomeUnlocks[biomeId] = true;
            newUnlock = biomeId;
        }
    }

    saveMeta();
    return { goldEarned, newUnlock };
}

// Get meta bonuses for applying to player stats
export function getMetaBonuses() {
    const bonuses = {
        maxHealthMult: 1,
        damageMult: 1,
        speedMult: 1,
        armorMult: 1,
        xpMult: 1,
        pickupRangeMult: 1,
    };

    const data = getMeta();
    for (const [id, def] of Object.entries(META_UPGRADES)) {
        const level = data.upgrades[id] || 0;
        if (level <= 0) continue;

        switch (id) {
            case 'max_health': bonuses.maxHealthMult += def.perLevel * level; break;
            case 'damage': bonuses.damageMult += def.perLevel * level; break;
            case 'speed': bonuses.speedMult += def.perLevel * level; break;
            case 'armor': bonuses.armorMult -= def.perLevel * level; break;
            case 'xp_gain': bonuses.xpMult += def.perLevel * level; break;
            case 'pickup_range': bonuses.pickupRangeMult += def.perLevel * level; break;
        }
    }

    return bonuses;
}

export function resetProgress() {
    saveData = getDefaultSave();
    saveMeta();
}
