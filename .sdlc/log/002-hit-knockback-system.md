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
