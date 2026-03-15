# Horde Shooter

Top-down roguelike survival shooter — survive waves of enemies, level up, evolve weapons, unlock biomes.

![Gameplay](gameplay.gif)

> **Note:** `gameplay.gif` is a placeholder — record and add a GIF manually.

**[Play Now](https://d-ungvari.github.io/horde-shooter/)**

> Requires GitHub Pages to be enabled: repo Settings > Pages > Source: **GitHub Actions**

## Controls

| Input | Action |
|-------|--------|
| WASD / Arrow Keys | Move |
| Mouse | Aim |
| Left Click (hold) | Shoot |
| ESC | Pause |

## Features

- **3 Biomes** — Graveyard, Volcano, The Void — each with unique visuals and ambient particles
- **10 Weapons** with evolution system (4 evolutions implemented, 6 planned)
- **Meta-progression** — earn gold, buy permanent upgrades between runs
- **Mid-run save/load** — pause and quit without losing progress
- **Boss encounters** with warning announcements
- **Minimap** with enemy tracking
- **Weapon cooldown HUD** with passive ability icons

## Tech

- Vanilla JavaScript (ES6 modules) — zero dependencies, no build step
- Canvas 2D rendering with spatial hash collision detection
- Object pooling for enemies, projectiles, particles (no GC pauses)
- Procedural audio via Web Audio API (no audio files)
- 28 modules: renderer, physics, spawner, weapons, effects, camera, meta-progression, save system
