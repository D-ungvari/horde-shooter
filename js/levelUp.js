// Level-up system: generates upgrade choices and manages the DOM overlay
import { WEAPONS, EVOLUTIONS } from './weaponData.js';
import { PASSIVES } from './passiveData.js';
import { recalculateStats } from './stats.js';

const MAX_WEAPONS = 6;
const MAX_CHOICES = 3;

let resolveChoice = null; // callback when player picks

// --- Choice generation ---

export function generateChoices(player) {
    const pool = [];

    // 1. Check for available evolutions first (highest priority)
    for (const weapon of player.weapons) {
        const wDef = WEAPONS[weapon.id];
        if (!wDef || !wDef.evolutionId) continue;
        if (weapon.level < 8) continue; // need max level

        // Check if player has the matching passive
        const hasPassive = player.passives.some(p => p.id === wDef.evolvesWithPassive);
        if (!hasPassive) continue;

        // Check this weapon hasn't already been evolved
        const evo = EVOLUTIONS[wDef.evolutionId];
        if (!evo) continue;
        const alreadyEvolved = player.weapons.some(w => w.id === wDef.evolutionId);
        if (alreadyEvolved) continue;

        pool.push({
            type: 'evolution',
            weaponId: weapon.id,
            evolutionId: wDef.evolutionId,
            name: evo.name,
            icon: evo.icon || '🌟',
            description: evo.description,
            levelText: 'EVOLUTION',
        });
    }

    // 2. Existing weapon upgrades (if not maxed)
    for (const weapon of player.weapons) {
        if (weapon.level >= 8) continue;
        const wDef = WEAPONS[weapon.id] || EVOLUTIONS[weapon.id];
        if (!wDef) continue;

        pool.push({
            type: 'weapon_upgrade',
            weaponId: weapon.id,
            name: wDef.name,
            icon: wDef.icon || '🔫',
            description: wDef.description,
            levelText: `Lv ${weapon.level} → ${weapon.level + 1}`,
        });
    }

    // 3. New weapons (if under cap and not already owned)
    if (player.weapons.length < MAX_WEAPONS) {
        const ownedWeaponIds = new Set(player.weapons.map(w => w.id));
        for (const [id, wDef] of Object.entries(WEAPONS)) {
            if (ownedWeaponIds.has(id)) continue;
            pool.push({
                type: 'new_weapon',
                weaponId: id,
                name: wDef.name,
                icon: wDef.icon || '🔫',
                description: wDef.description,
                levelText: 'NEW',
            });
        }
    }

    // 4. Passive upgrades (existing, not maxed)
    for (const passive of player.passives) {
        const pDef = PASSIVES[passive.id];
        if (!pDef) continue;
        if (passive.level >= pDef.maxLevel) continue;

        pool.push({
            type: 'passive_upgrade',
            passiveId: passive.id,
            name: pDef.name,
            icon: pDef.icon || '📦',
            description: pDef.description,
            levelText: `Lv ${passive.level} → ${passive.level + 1}`,
        });
    }

    // 5. New passives
    const ownedPassiveIds = new Set(player.passives.map(p => p.id));
    for (const [id, pDef] of Object.entries(PASSIVES)) {
        if (ownedPassiveIds.has(id)) continue;
        pool.push({
            type: 'new_passive',
            passiveId: id,
            name: pDef.name,
            icon: pDef.icon || '📦',
            description: pDef.description,
            levelText: 'NEW',
        });
    }

    // Prioritize: evolutions first, then shuffle the rest
    const evolutions = pool.filter(c => c.type === 'evolution');
    const upgrades = pool.filter(c => c.type === 'weapon_upgrade' || c.type === 'passive_upgrade');
    const newItems = pool.filter(c => c.type === 'new_weapon' || c.type === 'new_passive');

    // Shuffle helper
    const shuffle = arr => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    shuffle(upgrades);
    shuffle(newItems);

    // Build final choices: evolutions are guaranteed, fill rest from upgrades then new items
    const choices = [];
    for (const evo of evolutions) {
        if (choices.length >= MAX_CHOICES) break;
        choices.push(evo);
    }
    for (const upg of upgrades) {
        if (choices.length >= MAX_CHOICES) break;
        choices.push(upg);
    }
    for (const item of newItems) {
        if (choices.length >= MAX_CHOICES) break;
        choices.push(item);
    }

    return choices;
}

// --- Apply chosen upgrade ---

export function applyChoice(player, choice) {
    switch (choice.type) {
        case 'evolution': {
            // Replace the weapon with its evolution
            const idx = player.weapons.findIndex(w => w.id === choice.weaponId);
            if (idx !== -1) {
                player.weapons[idx] = { id: choice.evolutionId, level: 8 };
            }
            break;
        }
        case 'weapon_upgrade': {
            const weapon = player.weapons.find(w => w.id === choice.weaponId);
            if (weapon) weapon.level++;
            break;
        }
        case 'new_weapon': {
            player.weapons.push({ id: choice.weaponId, level: 1 });
            break;
        }
        case 'passive_upgrade': {
            const passive = player.passives.find(p => p.id === choice.passiveId);
            if (passive) passive.level++;
            break;
        }
        case 'new_passive': {
            player.passives.push({ id: choice.passiveId, level: 1 });
            break;
        }
    }

    // Recalculate stats after any choice
    recalculateStats(player);
}

// --- DOM Overlay ---

export function showLevelUpScreen(player) {
    return new Promise((resolve) => {
        resolveChoice = resolve;

        const choices = generateChoices(player);
        const container = document.getElementById('levelup-choices');
        container.innerHTML = '';

        const screen = document.getElementById('levelup-screen');
        screen.style.display = 'flex';

        // Build cards
        choices.forEach((choice, idx) => {
            const card = document.createElement('div');
            card.className = 'choice-card' + (choice.type === 'evolution' ? ' evolution' : '');

            card.innerHTML = `
                <div class="choice-key">${idx + 1}</div>
                <div class="card-icon">${choice.icon}</div>
                <div class="card-name">${choice.name}</div>
                <div class="card-level">${choice.levelText}</div>
                <div class="card-desc">${choice.description}</div>
            `;

            card.addEventListener('click', () => {
                pickChoice(player, choice);
            });

            container.appendChild(card);
        });

        // Keyboard shortcuts (1, 2, 3)
        const keyHandler = (e) => {
            const num = parseInt(e.key);
            if (num >= 1 && num <= choices.length) {
                e.preventDefault();
                document.removeEventListener('keydown', keyHandler);
                pickChoice(player, choices[num - 1]);
            }
        };
        document.addEventListener('keydown', keyHandler);

        // Store handler for cleanup
        screen._keyHandler = keyHandler;
    });
}

function pickChoice(player, choice) {
    const screen = document.getElementById('levelup-screen');

    // Remove key handler
    if (screen._keyHandler) {
        document.removeEventListener('keydown', screen._keyHandler);
        screen._keyHandler = null;
    }

    screen.style.display = 'none';

    applyChoice(player, choice);

    if (resolveChoice) {
        resolveChoice(choice);
        resolveChoice = null;
    }
}

export function hideLevelUpScreen() {
    const screen = document.getElementById('levelup-screen');
    screen.style.display = 'none';

    if (screen._keyHandler) {
        document.removeEventListener('keydown', screen._keyHandler);
        screen._keyHandler = null;
    }
}
