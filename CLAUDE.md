# Horde Shooter

Roguelike survival shooter (Vampire Survivors-style) — vanilla JS, Canvas 2D.

## Tech Stack
- Vanilla JavaScript (ES modules)
- HTML5 Canvas 2D
- Procedural audio (Web Audio API)
- No build step, no framework, no dependencies

## How to Run
Open `index.html` in a browser, or serve with any static file server:
```bash
npx serve .
```

## How to Test
No test suite currently. Manual testing in browser.

## Key Files
| File | Purpose |
|------|---------|
| `js/main.js` | Entry point, game loop |
| `js/game.js` | Game state, initialization, update/render orchestration |
| `js/player.js` | Player entity, movement, stats |
| `js/enemy.js` | Enemy update, AI, collision |
| `js/enemyData.js` | Enemy type definitions (stats, appearance) |
| `js/weapons.js` | Weapon firing logic |
| `js/weaponData.js` | Weapon/evolution/passive definitions |
| `js/projectile.js` | Projectile update, collision detection |
| `js/renderer.js` | Drawing enemies, player, projectiles, UI |
| `js/effects.js` | Particles, damage numbers, screen effects |
| `js/spawner.js` | Enemy spawn logic, wave management |
| `js/physics.js` | Spatial hash, collision helpers |
| `js/camera.js` | Camera follow, world-to-screen transforms |
| `js/objectPool.js` | Object pool for perf (enemies, projectiles, particles, gems) |
| `js/constants.js` | Game constants, pool sizes |
| `js/audio.js` | Procedural sound generation |
| `js/input.js` | Keyboard + mouse input |
| `js/save.js` | LocalStorage save/load |
| `js/levelUp.js` | Level-up choice UI |
| `js/xp.js` | XP gem logic |
| `js/stats.js` | Stats tracking |
| `js/meta.js` | Meta-progression (gold, shop) |
| `js/minimap.js` | HUD minimap |
| `js/background.js` | Biome background rendering |
| `js/biomes.js` | Biome definitions |
| `js/drawLib.js` | Drawing utility functions |
| `js/passiveData.js` | Passive upgrade definitions |
| `js/utils.js` | Math/general utilities |

## Conventions
- All game state lives in a single `game` object passed through functions
- Object pool pattern: `acquire()` / `release()` — never `new` during gameplay
- Spatial hash for O(1) neighbor queries (collision, AoE)
- Procedural drawing (Canvas paths) — no external image assets
- Procedural audio (Web Audio oscillators) — no sound files
- ES module imports, no bundler
