# Horde Shooter — Major Visual & Weapon System Upgrade

> Last updated: 2026-03-15 | Refined: Pass 2 | Status: PLANNING

## Core Vision

**"Vampire Survivors feel"** — Waves upon waves of enemies. Hundreds on screen. The satisfaction of cutting through a wall of bodies. Screen-filling weapon effects. The power fantasy of going from vulnerable to unstoppable.

**Current gap:** The game has solid mechanics but enemies are colored circles, weapons lack visual punch, and enemy density doesn't reach the overwhelming tide that defines the genre. The upgrade addresses all three.

---

## Table of Contents
1. [Visual Upgrade — Animation System](#1-visual-upgrade--animation-system)
2. [Juice & Impact — Making Combat Feel Devastating](#2-juice--impact--making-combat-feel-devastating)
3. [Enemy Density — The Horde Feel](#3-enemy-density--the-horde-feel)
4. [Weapon System Overhaul](#4-weapon-system-overhaul)
5. [Weapon Effects — Blast Zones, Knockback, Aftereffects](#5-weapon-effects--blast-zones-knockback-aftereffects)
6. [Combo & Synergy System](#6-combo--synergy-system)
7. [New Weapons & Evolutions](#7-new-weapons--evolutions)
8. [Implementation Phases](#8-implementation-phases)

---

## 1. Visual Upgrade — Animation System

### Current State
Everything is procedural Canvas primitives:
- Player: composite circles + rectangles (body, legs, arm, gun, eyes)
- Enemies: colored circles with eyes (all types look nearly identical)
- Projectiles: 8 visual types (normal, lightning, flame, boomerang, chakram, frostburst, zones, enemy)
- Effects: circle particles, damage numbers, screen shake/flash

### Animation Approach: Hybrid Procedural + Spritesheet

**Why hybrid?** Pure spritesheets require extensive art assets. Pure procedural looks robotic. The sweet spot: **procedural bodies with spritesheet-quality detail via Canvas drawing routines, plus procedural effects/particles.**

#### Enemy Visual Overhaul

Each enemy type needs a **distinct silhouette**, not just a different color circle. Enemies should be identifiable at a glance in a sea of hundreds.

**Drawing approach:** Composite procedural shapes (like the player already uses) — multiple circles, rectangles, and paths composed into distinct creatures. No external image files needed.

| Enemy | Current | Upgraded Visual | Silhouette |
|-------|---------|----------------|------------|
| Shambler | Green circle | Slouching body, stumpy legs, dangling arms, slack jaw | Round + low |
| Runner | Red circle | Lean body, long legs mid-stride, sharp teeth, forward lean | Tall + thin |
| Bat | Purple circle | Wing shapes (arc paths), small body, red eyes, flapping animation | Wide + flat |
| Brute | Orange circle | Wide rectangular body, thick legs, horns/spikes, armored plates | Square + large |
| Spitter | Lime circle | Puffed cheeks, bloated midsection, visible projectile in mouth | Round + bulging |
| Swarmer | Dark gray circle | Tiny insectoid, multiple legs (4-6 lines), antennae | Small + spiky |
| Exploder | Red circle | Unstable body (wobbling), cracks with inner glow, sparking particles | Pulsing + jagged |

**Animation states per enemy (procedural, not frame-based):**

| State | Technique | Details |
|-------|-----------|---------|
| **Walk/Move** | Sine-wave leg cycling + body bob | Legs alternate phase, body shifts Y by 1-2px per step. Speed scales with move speed |
| **Idle** | Subtle breathing + sway | Y oscillation (0.5px), slight rotation wobble |
| **Hit reaction** | Flash white (2 frames) + scale squash | Scale to 0.8x width, 1.2x height for 50ms, then snap back. Enemy color → white for 2 frames |
| **Death** | Scale to 0 + burst particles + color desaturate | Shrink over 200ms with spin, spawn 12-20 particles in enemy color, brief white flash |
| **Spawn** | Scale from 0 + fade in | Grow from 0 to full size over 300ms with slight overshoot (1.1x → 1.0x) |
| **Attack windup** | Brief pullback + glow | Spitter: cheeks puff further. Exploder: glow intensifies. Brute: slight rear-back |

**Boss visual upgrades:**
- Significantly larger (2-3x regular enemy radius)
- Unique multi-part bodies (Flesh Colossus: central mass + dangling appendages)
- Persistent particle aura (embers for Infernal Knight, insects for Hive Queen)
- Phase-change visual shifts (color darkens, glow intensifies at 50% and 25% HP)
- Death: extended 1-second death animation with massive particle burst (50+ particles) + screen slowdown

#### Player Visual Upgrade

The player composite drawing is already good. Enhancements:
- **Weapon-specific arm/gun visuals**: Gun barrel changes shape per equipped weapon (shotgun = wide barrel, rocket = tube, flamethrower = nozzle)
- **Damage state**: At <30% HP, player sprite flickers red, leaves blood particle trail
- **Power indicators**: When fully evolved weapons equipped, subtle glow aura around player
- **Movement trail**: At high speed (Move Speed passive), faint afterimage trail (3 ghost copies at decreasing alpha)

#### XP Gem Visual Upgrade
- Keep diamond shape but add **trailing sparkle particles** as they float toward player (magnet pull)
- Gems glow brighter as they cluster (more gems nearby = brighter, giving visual feedback of a "jackpot" area)
- Large gems (from bosses/elites): pulsing golden glow with rotating highlight

---

## 2. Juice & Impact — Making Combat Feel Devastating

### The Hit Feedback Chain (Every Enemy Hit)

Layer these effects for EVERY damage instance. They're cheap individually but devastating in combination:

1. **Hit flash** (2 frames): Enemy turns pure white via `globalCompositeOperation = 'source-atop'` or simply draw white circle at enemy position
2. **Hit particles** (4-6): Burst from impact point in enemy color + white sparks. Velocity: 80-150 px/s outward
3. **Knockback**: Push enemy 5-15px away from damage source. Scaled by damage dealt. Creates satisfying "wave" ripple through packed enemies
4. **Damage number**: Pop up with velocity, scale in from 0.5x to 1.2x then settle to 1.0x. Color + size coded:
   - 1-9 DMG: `#CCCCCC` (gray), 12px — fodder hits, barely noticeable
   - 10-24 DMG: `#FFFFFF` (white), 14px — standard hits
   - 25-49 DMG: `#FFDD44` (yellow), 16px — solid hits
   - 50-99 DMG: `#FF8822` (orange), 18px, bold — heavy hits
   - 100+ DMG: `#FF2222` (red), 22px, bold + brief glow — devastating
   - Combo reactions: `#FF44FF` (magenta), 20px — visually distinct from normal damage
   - Crit/evolution hits: add "!" suffix and 1.3x size bump
5. **Screen shake**: Micro-shake (0.5-1px) per hit. Scales with damage. Capped so 50 simultaneous hits doesn't earthquake

### The Kill Feedback Chain (Every Enemy Death)

More dramatic than hits — kills are the primary reward signal:

1. **Hit stop**: 15-30ms game freeze (1-2 frames at 60fps). Only on kills, NOT hits. Creates rhythmic staccato when mowing through hordes
   - **Implementation:** Add `game.hitStopTimer` to game state. When a kill occurs, set `hitStopTimer = 0.02`. In the game loop, if `hitStopTimer > 0`, decrement by dt but skip all entity updates (still render). This freezes gameplay but keeps the frame drawing, making the freeze visible. Cap at 50ms to prevent cascading freezes from mass kills
2. **Death pop**: Enemy scales to 1.3x over 50ms, then rapidly to 0x over 100ms (squash-and-pop)
3. **Death particles**: 12-20 particles in enemy color + 4-6 white sparks. More particles for bigger enemies
4. **XP gem burst**: Gems spawn with outward velocity (fan pattern), then get pulled by magnet. Satisfying "loot explosion"
5. **Screen shake**: Slightly stronger than hit shake (1-2px). Boss kills: 8-10px shake for 300ms
6. **Score popup**: Floating "+150" with combo multiplier color coding
7. **Sound**: Descending multi-tone (already exists), pitch varies slightly per kill to avoid monotony

### Multi-Kill & AoE Feedback

When an AoE weapon hits 10+ enemies simultaneously:

1. **Time dilation**: Brief 80% speed for 100ms. Makes the moment register
2. **Radial shockwave**: Expanding translucent ring from blast center (white, fades over 200ms)
3. **Accumulated screen shake**: Capped at 4px even for massive hits (readability > juice)
4. **Bass drop sound**: Low-frequency rumble for mass kills. Procedural via Web Audio oscillator

### Boss-Specific Feedback

- **Boss hit**: Heavier shake (2-3px), larger hit flash, health bar chunk visibly depletes
- **Boss phase change** (50% HP, 25% HP): 200ms freeze, color shift, burst of particles, announcement text
- **Boss death**: 800ms slowdown to 20% speed, massive particle explosion (80+ particles), gold shower, triumphant sound, "BOSS DEFEATED" banner

---

## 3. Enemy Density — The Horde Feel

### Current Limits
- MAX_ENEMIES pool: 600 (from object pool)
- Spawn interval: starts at 2.0s, decreases to 0.3s minimum
- With spatial hash: can handle 600 entities at 60fps

### Target: 800-1200 Enemies On Screen

**Performance optimizations needed:**

1. **Hybrid LOD rendering for enemies** — 3 tiers based on distance from player:
   - **Full detail** (<250px): Composite procedural body, eyes, legs, animations, status overlays. ~15 draw calls per enemy
   - **Medium detail** (250-500px): Body shape + color only, no eyes/legs/status. ~3 draw calls per enemy
   - **Minimal** (>500px): Single filled circle in enemy color. 1 draw call per enemy
   - At 1000 enemies: ~100 full, ~300 medium, ~600 minimal = ~3450 draw calls (vs 15,000 if all full detail)
   - Transition is instant (no fade) — at these distances, the player can't perceive the switch
2. **Spatial hash cell size tuning**: Current SPATIAL_CELL_SIZE = 16. Increase to 32 for enemy-vs-projectile checks (fewer cells to query, acceptable collision precision for circles)
3. **Batch rendering**: Group enemies by type AND LOD tier. Set fill color once, draw all far-shamblers as green circles in one pass. Reduces Canvas context state changes (`fillStyle` is expensive to set)
4. **Particle budget**: Cap total active particles at 500. When budget exceeded, reuse oldest particle (ring buffer). Priority order: kill > combo reaction > hit > ambient
5. **LOD for effects** — dynamic scaling based on alive enemy count:
   - <200 enemies: full particles (6 hit, 16 kill)
   - 200-500 enemies: reduced (3 hit, 8 kill)
   - 500+ enemies: minimal (2 hit, 4 kill, skip ambient particles entirely)
   - Skip damage numbers for enemies >400px from player (nobody reads them at that distance)

**Enemy separation (prevent blobbing):**
When 200+ enemies converge, they currently stack into an unreadable blob. Add lightweight separation:
```
During enemy update, after movement:
  Query spatial hash for neighbors within enemy.radius * 2
  For each overlapping neighbor:
    push self away by overlap * 0.15 along separation vector
```
This is the same crowd-push as knockback (reuse the code) but weaker (0.15 vs 0.3). Enemies form a dense but readable mass — you can see individual silhouettes at the edges. The center of the blob can be dense (that's fine — the player mows through it). Cost: already part of the spatial hash query, negligible.

**Spawn rate changes:**
- After 5 minutes: spawn groups of 3-5 enemies at once (not individual spawns)
- After 10 minutes: spawn waves of 15-20 from screen edges simultaneously
- After 15 minutes: continuous stream with no gaps — enemies pour in like a fluid
- Swarm events: every 30 seconds, a burst of 30-50 swarmers from one direction

**New spawn pattern: "The Wall"**
- At difficulty thresholds, spawn a LINE of 20+ enemies marching from one direction
- Satisfies the core fantasy: seeing a wall of enemies and mowing through them
- Visually stunning, mechanically simple (they just walk straight)

**Wall implementation:**
```
Trigger: every 90s after minute 8, plus on boss spawn
1. Pick random edge (top/bottom/left/right)
2. Audio telegraph: rising sine sweep 500ms before spawn
3. Visual telegraph: faint red line on that screen edge, pulsing for 500ms
4. Spawn 20-30 enemies in a line along the edge, evenly spaced
   - Spacing = edge_length / count (fills the entire edge)
   - All same type (shamblers for first wall, then mixed/elites later)
   - All walk straight toward player (ignore normal AI pathfinding)
5. After 5s, surviving wall enemies revert to normal chase AI
```
The telegraph is critical — player sees the red edge, hears the warning, repositions, then unleashes weapons into the charging line. THIS is the hero moment.

**Spawn pattern: "Encirclement"** (late game, minute 18+)
- Walls from ALL 4 edges simultaneously
- 60-80 total enemies closing in
- Creates a shrinking ring — player must blast an escape route
- Triggers once, not repeating (climactic moment)

---

## 4. Weapon System Overhaul

### Design Principles (From Research)

1. **Every weapon must have unique spatial behavior** — not just different damage numbers
2. **Upgrades should cross qualitative thresholds** — level 4 shotgun shouldn't just do "+15% damage", it should add a new projectile or behavior
3. **Visible escalation** — screen should become more chaotic as weapons level up
4. **Weapon roles should be distinct**: Crowd clear, single target, area denial, crowd control, passive/ambient

### Weapon Level Milestones (New: Behavioral Upgrades)

Currently weapons just scale damage (+15%/level) and cooldown (-6%/level). Add **milestone behaviors** at key levels:

| Level | Current | New: Milestone Bonus |
|-------|---------|---------------------|
| 1 | Base stats | Base weapon |
| 2 | +15% DMG, -6% CD | — |
| 3 | +30% DMG, -12% CD | **Visual upgrade**: projectile gets trailing particles |
| 4 | +45% DMG, -18% CD | **Behavior unlock**: weapon-specific new mechanic (see below) |
| 5 | +60% DMG, -24% CD | — |
| 6 | +75% DMG, -30% CD | **Visual upgrade**: projectile size increases 20%, glow intensifies |
| 7 | +90% DMG, -36% CD | **Behavior unlock**: second weapon-specific mechanic |
| 8 | +105% DMG, -42% CD | Evolution available (with matching passive) |

**Per-weapon Level 4 and Level 7 unlocks:**

| Weapon | Level 4 Unlock | Level 7 Unlock |
|--------|---------------|---------------|
| Pistol | Bullets ricochet once off-screen edge | Every 5th shot is a piercing round |
| Shotgun | +2 pellets (7 total) | Pellets leave brief fire trail |
| SMG | Every 10th bullet is explosive (small AoE) | Bullets split on kill (2 fragments) |
| Rocket | Blast zone leaves lingering fire (2s) | Rocket fragments into 3 mini-rockets |
| Lightning | Chain hits slow enemies 20% for 1s | Lightning strikes leave static field (zone DoT) |
| Flamethrower | Burning enemies take 15% more damage from all sources | Flame cone width +50% |
| Boomerang | Boomerang passes through 3 additional enemies on return | Throws 2 boomerangs |
| Orbitals | +1 orbital (3 total) | Orbitals leave damage trail (afterimage ring) |
| Poison Cloud | Enemies in cloud move 30% slower | Poison spreads on kill (chain reaction) |
| Frost Nova | Frozen enemies shatter when killed (AoE fragment damage) | Nova radius +50%, freeze duration +1s |

### Weapon Role Classification

| Role | Weapons | Purpose |
|------|---------|---------|
| **Crowd Clear** | Shotgun, SMG, Flamethrower | Kill many weak enemies fast |
| **Single Target / Boss Killer** | Pistol, Rocket, Lightning | High damage to priority targets |
| **Area Denial** | Poison Cloud, Frost Nova, Rocket (lingering fire) | Control space, slow pushes |
| **Crowd Control** | Frost Nova (freeze), Lightning (slow), Boomerang (knockback) | Disrupt enemy movement |
| **Ambient / Passive** | Orbitals, Poison Cloud (auto) | Damage without player input |

Ideal builds combine 3+ roles. The level-up system should softly guide toward this by offering weapons from under-represented roles.

---

## 5. Weapon Effects — Blast Zones, Knockback, Aftereffects

### Blast Zones (AoE Visual Overhaul)

Current: Rocket has `aoeRadius: 80` but no visual explosion. Fix:

**Explosion Effect (Rocket, MIRV, Frost Nova, Shatter):**
```
On AoE trigger:
1. Expanding circle: 0 → full radius over 150ms
   - Fill: weapon color at 0.4 alpha
   - Stroke: brighter weapon color at 0.8 alpha, 3px
2. Shockwave ring: expanding ring at 1.5x speed of fill
   - White stroke, 2px, fades from 0.6 to 0 alpha
3. Core flash: bright white circle at center, radius 10px, fades over 50ms
4. Debris particles: 8-12 outward from center, gravity-affected
5. Ground scar: translucent circle at blast point, fades over 2s
   - Shows where explosion happened (spatial memory aid)
```

**Lingering Fire Zone (Rocket Lv4, Inferno, Flame trail):**
```
Persistent ground effect:
- Orange-red gradient circle, pulsing radius (±5%)
- Small flame particles rising from zone (3-4 at any time)
- Crackle/ember particles at edges
- Enemies inside: burn damage tick every 0.5s
- Duration: 2-4s depending on source
- Visual: starts bright, dims as duration expires
```

**Frost Zone (Frost Nova, Absolute Zero):**
```
Persistent ground effect:
- Light blue translucent circle with crystalline edge
- 6 radial ice crystal lines (drawn as angular paths)
- Frost particle mist (slow-moving, blue-white)
- Enemies inside: slowed, take DoT
- Ice crack web pattern on ground (procedural lines)
```

**Plague Zone (Poison Cloud, Plague):**
```
Persistent ground effect:
- Sickly green cloud with dashed border
- Bubble particles rising randomly within zone
- Enemies inside: periodic damage + visible "poisoned" tint
- On kill in zone (Plague evolution): new zone spawns at kill point
  with spreading ripple animation
```

### Knockback System (New)

Currently NO knockback exists. Adding it transforms combat feel:

**Knockback rules:**
| Source | Knockback Distance | Knockback Speed |
|--------|-------------------|----------------|
| Pistol/SMG bullet | 3-5px | 200 px/s |
| Shotgun pellet | 8-12px | 300 px/s |
| Rocket explosion | 30-50px | 500 px/s (from center, falloff with distance) |
| Boomerang hit | 15-20px | 250 px/s |
| Frost Nova burst | 10-15px (outward push) | 200 px/s |
| Orbital hit | 5-8px | 150 px/s |
| Lightning | 0 (electricity, no physical force) | — |
| Flamethrower | 2-3px (very slight pushback) | 100 px/s |

**Knockback implementation:**
```javascript
// On enemy hit:
enemy.knockbackVx = cos(damageAngle) * knockbackSpeed;
enemy.knockbackVy = sin(damageAngle) * knockbackSpeed;
enemy.knockbackTimer = knockbackDistance / knockbackSpeed;

// In enemy update:
if (enemy.knockbackTimer > 0) {
  enemy.x += enemy.knockbackVx * dt;
  enemy.y += enemy.knockbackVy * dt;
  enemy.knockbackTimer -= dt;
  enemy.knockbackVx *= 0.9; // friction decay
  enemy.knockbackVy *= 0.9;
}
```

**Visual during knockback:**
- Enemy slightly squashed in movement direction (0.85x width, 1.15x height)
- Small dust particles at feet
- Enemy can't act during knockback (briefly stunned)

**The horde-push fantasy:** When Rocket hits a dense pack, enemies FLY outward from the blast center. 20 enemies simultaneously knocked back creates a satisfying "parting the sea" effect. This is THE moment that defines the Vampire Survivors feel.

### Weapon Trail Effects (New)

**Projectile trails** — every projectile leaves a fading afterimage:

| Weapon | Trail Type | Visual |
|--------|-----------|--------|
| Pistol/SMG | Fading line | 2-3 previous positions as fading dots, weapon color |
| Shotgun | Scatter trail | Each pellet leaves a thin fading line |
| Rocket | Smoke trail | Gray-orange particles spawned behind projectile every 2 frames |
| Lightning | Static residue | Jagged line persists for 200ms after strike, fading |
| Flamethrower | Heat distortion | Previous flame positions linger at 30% alpha for 100ms |
| Boomerang | Arc trail | Curved line of 6-8 afterimages along flight path |
| Chakram | Spin trail | Circular afterimage ring, bright, fast fade |
| Frost Nova | Ice crystal scatter | Small ice shards radiate outward and melt (shrink + fade) |

**Implementation:** Ring buffer of last 6 positions per projectile. Each frame, draw fading circles/lines at previous positions. Alpha decreases with age. Cost: ~1 extra draw call per projectile (negligible with batching).

---

## 6. Combo & Synergy System

### Current State
- Each weapon has ONE evolution passive (deterministic)
- Passives provide flat stat bonuses
- No cross-weapon synergies
- No status effect interactions

### New: Status Effect System

Add status effects that weapons inflict. These become the basis for cross-weapon combos:

| Status Effect | Applied By | Visual | Mechanic |
|---------------|-----------|--------|----------|
| **Burning** | Flamethrower, Rocket (lingering fire), Inferno | Orange particles + red tint | 3 DMG/s for 3s, stacks intensity |
| **Frozen** | Frost Nova, Absolute Zero | Blue tint + ice crystal overlay | -50% speed for 2s. If killed while frozen: shatter (AoE) |
| **Poisoned** | Poison Cloud, Plague | Green tint + bubble particles | 2 DMG/s for 5s, -20% damage dealt |
| **Electrified** | Lightning, Thunderstorm | Blue spark particles, brief glow | Next hit from ANY source deals +30% damage |
| **Weakened** | Boomerang (blunt force), Orbitals | Darker tint | -25% speed, -15% damage for 3s |

### Cross-Weapon Combo Triggers

When two status effects combine, a **combo reaction** triggers:

| Combo | Status A + Status B | Reaction | Visual |
|-------|-------------------|----------|--------|
| **Steam Explosion** | Frozen + Burning | AoE blast (40 DMG, 80px radius), unfreezes enemy | White steam burst, whistling sound |
| **Chain Lightning** | Electrified + hit by any projectile | Lightning arcs to 3 nearby enemies (15 DMG each) | Blue lightning forks |
| **Toxic Fire** | Poisoned + Burning | Poison cloud explodes (25 DMG AoE), removes poison | Green fire burst |
| **Shatter** | Frozen + killed | Frozen enemy explodes into ice shards (20 DMG to nearby) | Ice fragment projectiles |
| **Plague Burst** | Poisoned + killed | Poison spreads to all enemies within 60px | Green ripple wave |
| **Overload** | Electrified + Electrified (hit twice) | EMP pulse: all enemies in 100px stunned 1s | Blue ring + spark shower |
| **Frostburn** | Frozen + Poisoned | Enemy takes 2x DoT from both effects | Purple crystal overlay |

**Combo Reaction Visual Specs:**

- **Steam Explosion**: Expanding white cloud (circle, 0→80px over 200ms, 0.5 alpha) + 8 white wispy particles drifting upward + shockwave ring. Distinct from normal explosions by being WHITE not orange
- **Chain Lightning**: 3 jagged lightning bolts fork from target to nearby enemies (reuse lightning rendering). Each bolt has a brief bright flash at impact point (white circle, 10px, 50ms)
- **Toxic Fire**: Green-orange gradient expanding circle + green flame particles (6-8, rising). Distinct green-tinted fire differentiates from normal fire
- **Shatter**: Enemy "breaks" — draw 6-8 ice shard triangles (light blue) flying outward with rotation. Each shard is a small triangle path (3 points). Shards fade over 300ms. The most visually distinctive combo
- **Plague Burst**: Green ripple ring expands outward from corpse (0→60px, 150ms). All enemies touched gain green tint. Spawns 4 small green bubble particles
- **Overload**: Blue EMP ring (expanding circle stroke, 3px, bright blue) + 12 blue spark particles in all directions + brief blue screen flash (5% alpha, 50ms). Stunned enemies get pulsing blue outline
- **Frostburn**: Purple crystalline overlay on enemy (mix of blue ice + green poison = purple). Swirling purple particles around enemy (3 orbiting). Doubled DoT numbers render in magenta

**Cascade example:** Lightning electrifies 5 enemies → Frost Nova freezes them all → Player kills one frozen enemy → **Shatter** triggers (ice shards hit 3 nearby frozen enemies) → those 3 die → each triggers **Shatter** again → chain reaction clears the entire group. 15 enemies dead from 1 kill. THIS is the Vampire Survivors moment.

**This is where the "wow" moments come from.** Player equips Lightning + Frost Nova. Lightning electrifies enemies, Frost Nova freezes them. Frozen+Electrified enemies shatter AND chain-lightning on death. The screen fills with cascading reactions.

### Synergy Discovery UI

When a combo triggers for the first time:
- Brief banner: "COMBO DISCOVERED: Steam Explosion!"
- Combo added to a "Discoveries" list in pause menu
- Incentivizes experimenting with weapon combinations

---

## 7. New Weapons & Evolutions

### Completed: All 10 Evolutions Implemented (a91eb09)
All base evolutions are now functional: Rail Gun, Flak Cannon, Minigun, MIRV, Thunderstorm, Inferno, Chakram, Guardian Ring, Plague, Absolute Zero. New projectile types (firezone, plaguezone, frostdot, chakram) with unique rendering and collision.

### New Weapon Concepts

| Weapon | Pattern | Role | Mechanic |
|--------|---------|------|----------|
| **Whip** | auto_sweep | Crowd Clear | Horizontal sweep hitting all enemies in a 120° arc, 100px range. Auto-targets densest direction. Classic VS weapon |
| **Holy Water** | auto_zone_targeted | Area Denial | Drops damaging zone at random enemy cluster. Auto-targets densest group |
| **Sawblade** | auto_ricochet | Crowd Clear | Bounces between enemies up to 8 times. Each bounce increases speed |
| **Mine Layer** | auto_deploy | Area Denial | Drops proximity mines behind player as they walk. Explode on enemy contact |
| **Black Hole** | auto_targeted | Crowd Control | Pulls all enemies within 120px toward center for 2s, then explodes. 15s cooldown |
| **Laser Beam** | aimed_continuous | Boss Killer | Continuous beam toward cursor. Ramps damage the longer it stays on one target (0.5x → 3x over 3s) |

### New Evolution Pairs

| Base | + Passive | = Evolution | New Mechanic |
|------|-----------|------------|-------------|
| Whip | + Area | = Death Scythe | 360° sweep, larger range, leaves dark energy trail |
| Holy Water | + Duration | = Blessed Ground | Zone lasts 2x longer, heals player inside |
| Sawblade | + Piercing | = Eternal Saw | Infinite bounces for 4s, splits into 2 on every 5th bounce |
| Mine Layer | + Damage | = Carpet Bomber | Mines are larger, chain-detonate nearby mines on explosion |
| Black Hole | + Cooldown | = Singularity | Pulls enemies tighter, explosion is 2x larger, spawns micro-holes on kill |
| Laser Beam | + Haste | = Death Ray | Beam widens over time, passes through enemies, max damage 5x |

### New Weapon Detailed Specs

**Whip (`auto_sweep`):**
- Fires automatically toward the direction with the most enemies (density scan)
- Draws a curved arc (quadratic bezier) sweeping 120° over 100ms
- Hits ALL enemies within the arc simultaneously (no pierce limit — it's a sweep)
- Base: 12 DMG, 1.2s CD, 100px range, 120° arc
- Visual: white-yellow arc line (3px stroke) that sweeps across the angle, fading trail
- Level 4: arc widens to 160°, Level 7: sweeps twice (backhand)
- **Death Scythe evolution**: 360° sweep, 150px range, dark purple trail, enemies hit are briefly pulled toward center (mini vacuum)
- Knockback: 10px perpendicular to sweep direction (enemies get "flicked" sideways)
- Sound: short whoosh (noise burst, bandpass 200-600Hz, 80ms)

**Holy Water (`auto_zone_targeted`):**
- Auto-targets the densest cluster of enemies (scan 5 candidate positions, pick highest enemy count within 80px)
- Drops a persistent damage zone at that location
- Base: 8 DMG/tick, 3.0s CD, 60px radius, 3s duration, ticks every 0.5s
- Visual: blue rippling circle, small cross icon at center, water droplet particles rising
- Level 4: zone slows enemies 30%, Level 7: zone grows 20% over its lifetime
- **Blessed Ground evolution**: 10s duration, heals player 2 HP/s while standing inside, zone pulses golden

**Sawblade (`auto_ricochet`):**
- Auto-fires toward nearest enemy
- On hit, redirects toward next nearest enemy (within 150px) — up to 8 bounces
- Each bounce: +10% speed, maintaining damage
- Base: 10 DMG, 2.0s CD, 350 speed, 8 bounces
- Visual: small spinning circle (4-spoke gear shape), metallic gray, rotation speed increases with each bounce
- Level 4: +3 bounces (11 total), Level 7: spawns sparks on each bounce (2 particles)
- **Eternal Saw evolution**: infinite bounces for 4s duration, splits into 2 on every 5th bounce, red glow

**Mine Layer (`auto_deploy`):**
- Drops a mine at player's position every cooldown tick (no targeting needed)
- Mines are stationary, arm after 0.8s (visual: dim → bright pulse when armed)
- Armed mines explode on enemy contact: AoE damage in radius
- Base: 20 DMG, 2.5s CD (deploy rate), 50px blast radius, 15s mine lifetime, max 8 active mines
- Visual: small circle with inner pulsing dot. Unarmed = dark gray. Armed = orange pulsing glow. Explosion = expanding ring + debris
- Level 4: mines detect enemies within 30px (proximity trigger, not just contact), Level 7: +4 max active mines (12 total)
- **Carpet Bomber evolution**: mines are 1.5x radius, exploding mine chain-detonates all mines within 80px (cascading explosions), mine deploy rate 1.5s
- Knockback: 25px from blast center (same as rocket)
- Sound: soft beep on deploy, satisfying boom on detonate
- Synergy with movement: fast player = wider mine field. Move Speed passive indirectly buffs this weapon

**Black Hole (`auto_targeted`):**
- Auto-targets densest enemy cluster (like Holy Water targeting)
- Creates a gravity well that pulls all enemies within 120px toward center for 2s
- After 2s: collapses with AoE explosion
- Base: 35 DMG (collapse), 15s CD, 120px pull radius, 80px explosion radius
- Enemies in pull: move toward center at 100 px/s (overrides their normal AI), stacking on top of each other
- Visual: dark circle at center with swirling particles (purple/black). Distortion ring at edge (expanding/contracting). On collapse: white flash + expanding purple ring + debris
- Level 4: pull strength +50% (150 px/s), Level 7: enemies in pull take 5 DMG/s (gravitational crush)
- **Singularity evolution**: 180px pull radius, explosion 2x larger (160px), on-kill in explosion: spawns mini black holes (40px, 1s duration, no explosion) at kill positions
- Knockback: 40px outward on collapse (enemies pulled in, then blasted out — incredibly satisfying)
- Sound: deep rumbling drone during pull (low sine 50Hz + noise), implosion whomp on collapse
- This is the crowd-control KING. Pull 30 enemies into a ball, then they explode outward. The fantasy.

**Laser Beam (`aimed_continuous`):**
- Fires a continuous beam toward cursor position (manual aim required)
- Beam damages all enemies it passes through (infinite pierce)
- Damage RAMPS the longer the beam stays on one target: 0.5x → 3.0x over 3 seconds
- Base: 8 DMG/tick (ticks every 0.1s), always active while firing (hold click), 400px range, 4px width
- Visual: thin bright line from player to max range. Glow increases with ramp multiplier. At 3x: beam is 12px wide with bright white core + colored outer glow + sparking particles along beam
- Level 4: beam width +4px (8px base), slight enemy slow on hit (10%), Level 7: beam passes through enemies and hits everything in line
- **Death Ray evolution**: beam widens to 20px at max ramp, 5x max multiplier, continuous damage zone lingers for 0.5s after beam moves away (afterburn trail)
- No knockback (beam is energy, not force)
- Sound: continuous hum (sawtooth 200Hz, volume scales with ramp multiplier), rises in pitch as ramp increases
- Unique mechanic: rewards sustained focus on one target. The boss-killer weapon. Ramp resets if beam leaves target for >0.5s
- **Interaction with auto-aim setting**: If game is auto-aim, beam auto-tracks nearest enemy but ramp is slower (1.5x max). Manual aim allows full 3x ramp — skill expression

---

## 8. Implementation Phases

### Phase 1: Juice & Impact (Highest Priority)
**Goal:** Make existing weapons FEEL powerful. No new content, just feedback.

- [ ] Hit flash (white overlay, 2 frames)
- [ ] Hit knockback system (per-weapon knockback values)
- [ ] Kill hit-stop (15-30ms freeze)
- [ ] Kill death-pop animation (scale up → shrink to 0)
- [ ] Enhanced kill particles (12-20, more dramatic)
- [ ] Screen shake tuning (micro-shake on hit, bigger on kill, massive on boss)
- [ ] Multi-kill time dilation (100ms at 80% speed for 10+ simultaneous kills)
- [ ] Shockwave ring for AoE explosions
- [ ] Damage number polish (scale-in animation, color coding)
- [ ] Projectile trail effects (ring buffer of previous positions)

### Phase 2: Enemy Visual Overhaul
**Goal:** Every enemy type visually distinct. Readable in a crowd of hundreds.

- [ ] Shambler composite body (slouching, dangling arms)
- [ ] Runner composite body (lean, forward sprint pose)
- [ ] Bat wing shapes with flap animation
- [ ] Brute rectangular armored body
- [ ] Spitter bloated body with projectile windup
- [ ] Swarmer insectoid legs/antennae
- [ ] Exploder wobbling body with crack glow
- [ ] Boss visual overhauls (multi-part bodies, auras, phase shifts)
- [ ] Spawn animation (grow from 0)
- [ ] Walk cycle (sine-wave procedural)
- [ ] LOD system: simple circles for distant enemies (>400px from camera)

### Phase 3: Enemy Density & Horde Feel
**Goal:** 800-1200 enemies on screen. Waves crashing against you.

- [ ] Increase MAX_ENEMIES pool to 1200
- [ ] Batch rendering by enemy type
- [ ] LOD rendering (full detail near, simple far)
- [ ] Particle budget cap (500 max active)
- [ ] Group spawning (3-5 at once after 5 min)
- [ ] Wave spawning (15-20 simultaneously after 10 min)
- [ ] Continuous stream after 15 min
- [ ] "The Wall" spawn pattern (line of 20+ from one direction)
- [ ] Swarm burst events (30-50 swarmers every 30s)
- [ ] Performance profiling: maintain 60fps at 1000 enemies

### Phase 4: Weapon Effects & Blast Zones
**Goal:** Every weapon has satisfying visual effects, blast zones, aftereffects.

- [ ] Explosion effect system (expanding circle + shockwave + debris)
- [ ] Lingering fire zones (Rocket Lv4, Inferno)
- [ ] Frost zones (crystalline visual, slow + DoT)
- [ ] Plague zones (green cloud with bubbles, chain spread)
- [ ] Weapon trail effects for all projectile types
- [ ] Ground scars (fading blast marks showing where explosions hit)
- [ ] Zone pulsing and lifecycle animations (birth → active → decay)
- [x] ~~MIRV implementation~~ (done in a91eb09)
- [x] ~~Chakram bounce~~ (done in a91eb09)

### Phase 5: Status Effects & Combo System
**Goal:** Cross-weapon synergies create emergent "wow" moments.

- [ ] Status effect system (Burning, Frozen, Poisoned, Electrified, Weakened)
- [ ] Status visual indicators on enemies (tints, particles, overlays)
- [ ] Combo reaction triggers (7 combos: Steam Explosion, Chain Lightning, Toxic Fire, Shatter, Plague Burst, Overload, Frostburn)
- [ ] Combo discovery UI (banner + pause menu list)
- [ ] Combo reaction visual effects (unique per combo)
- [ ] Combo reaction sounds
- [ ] Balance pass: combo damage shouldn't trivialize difficulty curve

### Phase 6: Weapon Milestones & New Weapons
**Goal:** Deeper weapon progression and expanded roster.

- [ ] Level 4 and Level 7 behavioral unlocks for all 10 existing weapons
- [ ] Visual upgrades at Level 3 and Level 6 (trails, size, glow)
- [ ] New weapons: Whip, Holy Water, Sawblade (start with 3)
- [ ] New evolutions for new weapons
- [ ] Level-up choice system: softly guide toward role diversity
- [ ] Additional weapons (Mine Layer, Black Hole, Laser Beam) in future pass

### Phase 7: Polish & Balance
**Goal:** Everything feels right.

- [ ] Weapon balance pass (DPS curves, cooldown feel, AoE coverage)
- [ ] Enemy scaling balance (HP/damage vs player power curve)
- [ ] Combo damage balance
- [ ] Audio pass: new sounds for all new effects (procedural Web Audio):
  - **Knockback impact**: Short noise burst (50ms) + low sine (80Hz, 30ms). Pitched by knockback force
  - **Explosion (Rocket/MIRV)**: White noise (100ms decay) + sine sweep 200Hz→60Hz + distortion. The bass thump
  - **Shatter (Frozen kill)**: High-frequency noise burst (2kHz bandpass, 80ms) + glass-like sine cluster (800-1200Hz, staggered)
  - **Combo reaction**: Ascending 3-note chime (400→600→800Hz, sine, 50ms each) — distinct from all weapon sounds
  - **Steam Explosion**: Noise burst + pitch-swept sine (300→100Hz) + hiss (high-pass noise, 200ms decay)
  - **Chain Lightning arc**: Quick sine chirp (1kHz→200Hz, 30ms) + crackle (noise, 50ms)
  - **Mass kill (10+)**: Low rumble (40Hz sine, 200ms) + ascending sparkle (sine sweep up)
  - **Boss phase change**: Descending ominous chord (3 sines: 200, 150, 100Hz, 500ms, fade)
  - **"The Wall" spawn warning**: Rising sine sweep (100→800Hz, 500ms) — audio telegraph before the line appears
- [ ] Performance optimization pass (target: 60fps with 1000 enemies, all effects active)
- [ ] Accessibility: option to reduce screen shake, flash effects, particle density
- [ ] Settings menu: shake intensity slider, particle density slider

---

## Visual Reference: What "Done" Looks Like

**5-minute mark:** Player has 2-3 weapons at levels 3-5. Enemies come in groups. Kills pop satisfyingly with particles and knockback. Projectiles leave trails. You're starting to feel strong.

**10-minute mark:** 4-5 weapons, some at level 7+. First evolution achieved. 200+ enemies on screen. Blast zones and lingering fire cover the ground. Enemies get knocked around by shotgun blasts. Combo reactions start chaining. Screen is chaotic but readable.

**15-minute mark:** 5-6 evolved weapons. 500+ enemies rushing in waves. "The Wall" formations. You're cleaving through them — freeze → shatter chains, lightning → chain arcs, rocket blasts sending 20 enemies flying. Ground is a patchwork of fire zones, frost zones, and poison clouds. Power fantasy at full tilt.

**20-minute mark:** 800+ enemies. Every weapon evolved. Combo reactions cascading across the screen. The horde is a tide, and you are the rocks they break against. This is the Vampire Survivors moment.

---

## Technical Notes

### Knockback & Physics Interaction
- Knocked-back enemies should push other enemies (crowd physics)
- Prevent knockback from pushing enemies through walls/off screen
- Boss/elite enemies: 50% knockback resistance
- Brutes: 70% knockback resistance

**Crowd push algorithm (cheap, not n²):**
```
During enemy update, after applying knockback velocity:
  Query spatial hash for neighbors within (enemy.radius * 2.5)
  For each neighbor:
    overlap = (enemy.radius + neighbor.radius) - distance
    if overlap > 0:
      push neighbor along separation vector by overlap * 0.3
```
This runs per-enemy during the existing spatial hash query — no extra pass needed.
The 0.3 factor prevents jitter (enemies don't fully resolve overlap each frame, they settle over 3-4 frames).
The effect: a rocket blast pushes the hit enemy, who pushes the enemy behind it, creating a ripple through the crowd.

**Knockback resistance per enemy type:**
| Type | Resistance | Effect |
|------|-----------|--------|
| Shambler | 0% | Full knockback (fodder, flies everywhere) |
| Runner | 10% | Nearly full (light, fast) |
| Bat | 0% | Full (airborne, no friction) |
| Swarmer | 0% | Full (tiny, thrown easily) |
| Spitter | 20% | Slight resistance (medium build) |
| Brute | 70% | Heavy, barely moves |
| Exploder | 0% | Full (volatile, light) |
| Elite (any) | +30% | Stacks with base type |
| Boss | 90% | Almost immovable (only rockets/explosions nudge them slightly) |

### Performance Budget Per Frame
| System | Budget (ms) | Notes |
|--------|-------------|-------|
| Enemy update (movement, AI) | 3ms | 1000 enemies × 3μs each |
| Projectile update + collision | 2ms | Spatial hash keeps this fast |
| Rendering (enemies) | 4ms | LOD reduces distant enemy cost |
| Rendering (projectiles + effects) | 2ms | Trail ring buffers are cheap |
| Particles | 1.5ms | 500 max, simple circle draws |
| UI/HUD | 0.5ms | Screen-space, no camera transform |
| **Total** | **~13ms** | **Budget: 16.6ms (60fps)** |

### Object Pool Sizes (Revised)
- Enemies: 1200 (up from 600)
- Projectiles: 800 (up from 500)
- Particles: 500 (capped, reuse oldest)
- XP Gems: 800 (up from 500)
- Damage Numbers: 100
- Trail Points: 4800 (800 projectiles × 6 trail positions)
