# Log: Shambler composite body
Started: 2026-03-15

## PLAN
1. Extract circle body + eyes into `drawEnemyCircleFallback(ctx, e)` — pure refactor
2. Create `enemyDrawFns` dispatch map + `drawEnemyBody(ctx, e, gameTime)` router
3. Implement `drawShambler(ctx, e, gameTime)` — static composite body (ellipse, 2 legs, 2 arms, jaw, eyes)
4. Add facing direction flip via `ctx.scale(-1, 1)` based on `targetAngle`
5. Add walk animation (sine-wave leg cycling + body bob)
6. Verify hit flash, death animation, health bar still work
Files: js/renderer.js (only file modified)
