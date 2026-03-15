# Log: 001 — Hit flash system
Started: 2026-03-15T00:00:00Z

## PLAN
7-step implementation:
1. Add `hitFlashTimer` property to enemy pool object, reset on spawn
2. Add `HIT_FLASH_DURATION = 0.033` constant
3. Trigger flash on projectile damage (game.js)
4. Trigger flash on lightning chain damage (weapons.js)
5. Trigger flash on orbital/guardian ring/frost nova damage (weapons.js)
6. Decrement hitFlashTimer in enemy update loop
7. Render white circle overlay when hitFlashTimer > 0

Files: enemy.js, constants.js, game.js, weapons.js, renderer.js
