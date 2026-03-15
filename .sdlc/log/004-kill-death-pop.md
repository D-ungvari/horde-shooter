# Log: 004 — Kill death-pop animation
Started: 2026-03-15

## PLAN
6-step implementation (approach A: dying state on enemy object):
1. Add DEATH_ANIM_DURATION + DEATH_ANIM_EXPAND_PHASE constants
2. Add dying/deathTimer/deathRotation fields to enemy pool object
3. Create startDying() export, tick dying enemies in updateEnemies
4. Replace releaseEnemy with startDying on kill in game.js
5. Guard collision systems against dying enemies
6. Render scale/rotation/fade in drawEnemyEntity

Files: constants.js, enemy.js, game.js, renderer.js
