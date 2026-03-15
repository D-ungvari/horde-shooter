# Log: 003 — Kill hit-stop
Started: 2026-03-15

## PLAN
4-step implementation:
1. Add HIT_STOP_DURATION, HIT_STOP_BOSS_DURATION, HIT_STOP_MAX constants
2. Add hitStopTimer variable + reset in startPlaying/resumeRun
3. Add hit-stop gate in game loop (skip update, still render)
4. Trigger hit-stop on enemy kills (capped additive)

Files: constants.js, game.js
