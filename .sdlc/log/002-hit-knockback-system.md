# Log: 002 — Hit knockback system
Started: 2026-03-15

## PLAN
10-step implementation:
1. Add knockback data to weapon definitions (weaponData.js)
2. Add knockback resistance to enemy type definitions (enemyData.js)
3. Add knockback state fields to enemy object (enemy.js)
4. Add applyKnockback() helper function (enemy.js)
5. Apply knockback velocity in enemy update loop (enemy.js)
6. Apply knockback on projectile collision (game.js) + store on projectiles (projectile.js, weapons.js)
7. Apply knockback from direct-damage weapons (weapons.js)
8. Implement crowd-push via spatial hash (enemy.js + game.js)
9. Add knockbackResist field to enemy spawn with elite bonus (enemy.js)
10. Boundary clamping — not needed, existing despawn handles it

Files: weaponData.js, enemyData.js, enemy.js, game.js, weapons.js, projectile.js

## DEV
All 10 steps implemented in a single pass across 6 files.
- Result: done
- Notes: knockbackDist/Speed values tuned per UPGRADE_PLAN spec

## TEST
- Run: code review (no test suite)
- Result: PASS
- Output: All damage paths verified, resistance values match spec, DOT zones correctly skip knockback, no bugs
- Fix attempts: 0

## REVIEW
- Result: APPROVED
- Feedback: Clean implementation, consistent with codebase patterns. Minor note about frame-dependent decay factor (0.9), acceptable.
- Fix rounds: 0

## COMMIT
- Hash: 119ccb5
- Message: feat: add hit knockback system with per-weapon values and crowd-push
- Files: js/weaponData.js, js/enemyData.js, js/projectile.js, js/enemy.js, js/game.js, js/weapons.js
- Timestamp: 2026-03-15
