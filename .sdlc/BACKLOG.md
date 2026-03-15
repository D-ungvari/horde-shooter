# Backlog

Ordered by priority. Top item = next to implement.
Phases from UPGRADE_PLAN.md, broken into atomic work items.

## Up Next

### Phase 1: Juice & Impact
### Phase 2: Enemy Visual Overhaul
- [x] **011 — Shambler composite body** — Slouching, dangling arms, stumpy legs (8346768)
- [x] **012 — Runner composite body** — Lean, forward sprint pose, sharp teeth (b023e1e)
- [x] **013 — Bat wing shapes** — Arc paths for wings, flapping animation (a8e57ff)
- [x] **014 — Brute armored body** — Wide rectangular body, horns/spikes (0972c5f)
- [x] **015 — Spitter bloated body** — Puffed cheeks, projectile windup (0972c5f)
- [x] **016 — Swarmer insectoid body** — Multiple legs, antennae (0972c5f)
- [x] **017 — Exploder wobbling body** — Crack glow, sparking particles (0972c5f)
- [x] **018 — Boss visual overhauls** — Multi-part bodies, auras, phase shifts (f48442c)
- [x] **019 — Enemy animations** — Spawn animation + LOD rendering (d65b373)

### Phase 3: Enemy Density & Horde Feel
- [x] **020 — Increase MAX_ENEMIES to 1200** — Pool sizes doubled/scaled (6ba521c)
- [x] **021 — LOD rendering system** — Already implemented in item 019 (d65b373)
- [x] **022 — Particle budget cap** — Pool increased to 2500, LOD scales particle counts (6ba521c)
- [x] **023 — Group & wave spawning** — Tiered: clusters, edge waves, continuous flood (b6f9455)
- [x] **024 — The Wall spawn pattern** — 20-30 enemies in a line, march straight for 5s (b6f9455)
- [x] **025 — Swarm burst events** — 30-50 swarmers from one edge every 30s (b6f9455)
- [ ] **026 — Performance profiling** — MANUAL: play-test at high density, profile with DevTools. Deferred to Phase 7

### Phase 4: Weapon Effects & Blast Zones
- [x] **027 — Explosion effect system** — Expanding circle + shockwave + debris (1bdc0e7)
- [x] **028 — Lingering fire zones** — Rising flame particles (1bdc0e7)
- [x] **029 — Frost zones** — Drifting mist particles (1bdc0e7)
- [x] **030 — Plague zones** — Rising green bubble particles (1bdc0e7)
- [x] **031 — Weapon trail effects** — Rocket smoke trail (1bdc0e7)
- [x] **032 — Ground scars** — Fading dark circles at blast sites (1bdc0e7)

### Phase 5: Status Effects & Combo System
- [x] **033 — Status effect system** — 5 statuses with DoT, speed/damage modifiers (d12c911)
- [x] **034 — Status visual indicators** — Tints + particles per status (d12c911)
- [x] **035 — Combo reaction triggers** — 7 combos with anti-loop safeguards (d12c911)
- [x] **036 — Combo discovery UI** — Banner + pause screen list (d12c911)
- [x] **037 — Combo VFX & SFX** — Unique visuals per combo (d12c911)

### Phase 6: Weapon Milestones & New Weapons
- [x] **038 — Level 4 & 7 behavioral unlocks** — All 10 weapons (19b7afe)
- [x] **039 — Visual upgrades at Level 3 & 6** — Enhanced trails + glow (19b7afe)
- [x] **040 — New weapon: Whip** — auto_sweep + Death Scythe evo (19b7afe)
- [x] **041 — New weapon: Holy Water** — zone_targeted + Blessed Ground evo (19b7afe)
- [x] **042 — New weapon: Sawblade** — ricochet + Eternal Saw evo (19b7afe)

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
- [x] **004 — Kill death-pop animation** — Scale up 1.3x then shrink to 0 (56d527c)
- [x] **005 — Enhanced kill particles** — 16 colored + 5 white sparks per kill (d58a12f)
- [x] **006 — Screen shake tuning** — Micro-shake on hit, kill shake, boss shake (1c66762)
- [x] **007 — Multi-kill time dilation** — 80% speed for 100ms on 10+ kills (9c11190)
- [x] **008 — AoE shockwave ring** — Expanding ring on frost nova, guardian ring, exploder (6dada0e)
- [x] **009 — Damage number polish** — Scale-in animation, color/size tiers (dbd0df4)
- [x] **010 — Projectile trail effects** — Ring buffer of 6 positions, fading afterimages (1922044)
