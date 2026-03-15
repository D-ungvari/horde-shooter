# Progress

## Current Phase
TEST — verifying implementation

## Current Work Item
**002 — Hit knockback system** — Per-weapon knockback values, crowd-push physics

## Context for Next Session
- All steps implemented across 6 files
- weaponData.js: knockbackDist/knockbackSpeed on all 20 weapon definitions
- enemyData.js: knockbackResist on all 7 enemy types + 4 bosses
- enemy.js: knockback state, applyKnockback(), applyCrowdPush(), stun during knockback
- projectile.js: knockbackDist/knockbackSpeed fields
- game.js: apply knockback on projectile hit, call applyCrowdPush after spatial hash
- weapons.js: pass knockback to projectiles, apply on orbitals/guardian ring/frost nova
