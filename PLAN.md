# Horde Shooter — Plan

Full design spec and implementation phases are in [UPGRADE_PLAN.md](./UPGRADE_PLAN.md).

## Summary
Roguelike survival shooter (Vampire Survivors-style). Vanilla JS + Canvas 2D. Currently playable with 10 weapons, all 10 evolutions, biomes, shop, save/load.

## Core Upgrade Goals
1. **Juice & Impact** — Hit flash, knockback, hit-stop, death-pop, screen shake, trails
2. **Enemy Visuals** — Distinct composite bodies per enemy type (not just colored circles)
3. **Horde Density** — 800-1200 enemies on screen with 60fps
4. **Weapon Effects** — Blast zones, lingering fire/frost/plague, ground scars
5. **Status & Combos** — Cross-weapon synergies (Frozen+Burning=Steam Explosion, etc.)
6. **New Weapons** — Whip, Holy Water, Sawblade + weapon level milestones
7. **Polish** — Balance, audio, accessibility, performance

## Architecture
- Single-page vanilla JS, ES modules
- Canvas 2D rendering with camera system
- Spatial hash for collision detection
- Object pool pattern for enemies, projectiles, particles, XP gems
- Procedural audio via Web Audio API
- LocalStorage for save/load and persistent upgrades
