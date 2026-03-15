# Backlog

Ordered by priority. Top item = next to implement.
Phases from UPGRADE_PLAN.md, broken into atomic work items.

## Up Next

### Phase 1: Juice & Impact
- [ ] **004 — Kill death-pop animation** — Scale up to 1.3x then shrink to 0 on death
- [ ] **005 — Enhanced kill particles** — 12-20 particles per kill, more dramatic
- [ ] **006 — Screen shake tuning** — Micro-shake on hit, bigger on kill, massive on boss kill
- [ ] **007 — Multi-kill time dilation** — 100ms at 80% speed for 10+ simultaneous kills
- [ ] **008 — AoE shockwave ring** — Expanding translucent ring for AoE explosions
- [ ] **009 — Damage number polish** — Scale-in animation, color/size coding by damage tier
- [ ] **010 — Projectile trail effects** — Ring buffer of previous positions per projectile

### Phase 2: Enemy Visual Overhaul
- [ ] **011 — Shambler composite body** — Slouching, dangling arms, stumpy legs
- [ ] **012 — Runner composite body** — Lean, forward sprint pose, sharp teeth
- [ ] **013 — Bat wing shapes** — Arc paths for wings, flapping animation
- [ ] **014 — Brute armored body** — Wide rectangular body, horns/spikes
- [ ] **015 — Spitter bloated body** — Puffed cheeks, projectile windup
- [ ] **016 — Swarmer insectoid body** — Multiple legs, antennae
- [ ] **017 — Exploder wobbling body** — Crack glow, sparking particles
- [ ] **018 — Boss visual overhauls** — Multi-part bodies, auras, phase shifts
- [ ] **019 — Enemy animations** — Spawn (grow from 0), walk cycle (sine-wave), LOD for distant enemies

### Phase 3: Enemy Density & Horde Feel
- [ ] **020 — Increase MAX_ENEMIES to 1200** — Expand object pool, batch rendering by type
- [ ] **021 — LOD rendering system** — Full detail near camera, simple circles far away
- [ ] **022 — Particle budget cap** — 500 max active particles, reuse oldest
- [ ] **023 — Group & wave spawning** — Groups of 3-5 after 5min, waves of 15-20 after 10min
- [ ] **024 — The Wall spawn pattern** — Line of 20+ enemies from one direction
- [ ] **025 — Swarm burst events** — 30-50 swarmers every 30s
- [ ] **026 — Performance profiling** — Maintain 60fps at 1000 enemies

### Phase 4: Weapon Effects & Blast Zones
- [ ] **027 — Explosion effect system** — Expanding circle + shockwave + debris for AoE
- [ ] **028 — Lingering fire zones** — Rocket Lv4, Inferno: persistent ground fire
- [ ] **029 — Frost zones** — Crystalline visual, slow + DoT
- [ ] **030 — Plague zones** — Green cloud with bubbles, chain spread on kill
- [ ] **031 — Weapon trail effects** — Smoke, static residue, heat distortion per weapon type
- [ ] **032 — Ground scars** — Fading blast marks at explosion locations

### Phase 5: Status Effects & Combo System
- [ ] **033 — Status effect system** — Burning, Frozen, Poisoned, Electrified, Weakened
- [ ] **034 — Status visual indicators** — Tints, particles, overlays per status
- [ ] **035 — Combo reaction triggers** — 7 combos (Steam Explosion, Chain Lightning, etc.)
- [ ] **036 — Combo discovery UI** — Banner on first trigger + pause menu list
- [ ] **037 — Combo VFX & SFX** — Unique visual and audio per combo reaction

### Phase 6: Weapon Milestones & New Weapons
- [ ] **038 — Level 4 & 7 behavioral unlocks** — Per-weapon milestone mechanics for all 10 weapons
- [ ] **039 — Visual upgrades at Level 3 & 6** — Trails, size increase, glow intensification
- [ ] **040 — New weapon: Whip** — auto_sweep, 120° arc, Death Scythe evolution
- [ ] **041 — New weapon: Holy Water** — auto_zone_targeted, Blessed Ground evolution
- [ ] **042 — New weapon: Sawblade** — auto_ricochet, 8 bounces, Eternal Saw evolution

### Phase 7: Polish & Balance
- [ ] **043 — Weapon & enemy balance pass** — DPS curves, cooldown feel, AoE coverage
- [ ] **044 — Audio pass** — Procedural Web Audio sounds for all new effects
- [ ] **045 — Accessibility options** — Reduce shake, flash, particle density sliders
- [ ] **046 — Performance optimization pass** — 60fps with 1000 enemies, all effects active

## In Progress
(nothing)

## Blocked
(nothing)

## Completed
- [x] **001 — Hit flash system** — White overlay on enemies for ~3 frames when damaged (4130059)
- [x] **002 — Hit knockback system** — Per-weapon knockback values, crowd-push physics (119ccb5)
- [x] **003 — Kill hit-stop** — 15-30ms game freeze on kills, 40ms on boss (ce34782)
