# Plan 016 — Visual Vibrancy Overhaul

Goal: shift horde-shooter from dark/desaturated to vibrant/saturated like platform-shooter, while keeping existing gameplay readability and the three-biome theme.

## Diagnosis (from recon)
- Backgrounds near-black (`#0a0a15`) eat foreground color.
- Tile colors desaturated (`#1a2a1a` etc.) — no contrast vs bg.
- Player/enemies are flat circles with 2-3 muted colors, no banding/anatomy.
- Projectiles flat yellow, no gradient core / outer glow.
- HUD CSS uses cool blue glows; no warm-vibrant accents in gameplay.
- Particle bursts undersized, alpha-faint over dark bg.

## Strategy
Brighten bg one stop, saturate tile palette ~1.5x, bump primary entity colors to high-saturation hues, add radial gradients + glow on projectiles/gems, increase particle counts and core brightness, warm up overlay/HUD CSS. Keep biome identity (greenish graveyard, fiery volcano, purple void) but at higher chroma.

## Steps

### Step 1 — Palette saturation (constants.js + biomes.js)
- `constants.js`: brighten primaries
  - `COLOR_PLAYER` `#4488EE` → `#5AB8FF` (vibrant cyan-blue)
  - `COLOR_PLAYER_DARK` `#2266CC` → `#1E5FB8`
  - `COLOR_BULLET` `#FFDD44` → `#FFE94A` + add `COLOR_BULLET_CORE` `#FFFFE0`
  - `COLOR_XP_SMALL/MEDIUM/LARGE` brighten ~20%
  - `COLOR_HEALTH_PICKUP` `#FF4466` → `#FF5577`
  - Add `COLOR_GLOW_WARM` `#FFB347` for accents
- `biomes.js`:
  - graveyard: `bgColor` `#0a0a15` → `#142a24` (dark teal); tiles `#1a2a1a..` → `#2c4a2c, #345434, #2e4a2e, #284028`; gridColor alpha 0.03→0.06; propColors stoneHighlight `#3a3a3a` → `#6a7060`; glow `#445544` → `#88cc99`
  - volcano: `bgColor` `#150a05` → `#2a1208`; tiles → `#48241a, #54301c, #4e2a18, #421e10`; glow `#FF4400` → `#FF6622` (already), bump alpha use; lava `#FF3300` → `#FF4422`
  - void: `bgColor` `#050510` → `#161630`; tiles → `#1f1f4a, #25254e, #21214a, #1c1c40`; glow `#4444FF` → `#6666FF`; crystal `#5522cc` → `#8844ff`
  - All biomes: bump ambient `alpha` ~+0.15, ambient `count` +25-40%

### Step 2 — Brighten background props + dual-layer parallax fog (background.js)
- Increase `drawTileVariation` `varAlpha` from 0.04+0.04n to 0.08+0.08n (more visible color banding within tiles).
- Bump prop `globalAlpha` values where currently <0.3 (graveyard fog wisps 0.06→0.18, volcano lava pool outer glow 0.08→0.18, void rune circles 0.1→0.22, void floating debris 0.15→0.3).
- Add a far-fog layer drawn before tiles: a viewport-relative gradient overlay tinted to biome glow at 0.12 alpha — gives parallax-ish depth without per-tile cost.
- Brighten ambient particles (graveyard mist alpha 0.15→0.28, ember 0.4→0.55, spark 0.5→0.7).

### Step 3 — Player vibrancy (renderer.js drawPlayerEntity ~L1014)
- Replace flat fill with radial gradient (`COLOR_PLAYER` at center, `COLOR_PLAYER_DARK` at rim).
- Add a 2-pixel cyan-white inner highlight arc on top-left.
- Add tiny visor/eye accent: bright rectangle in look direction tinted to weapon (use existing weapon color).
- Add subtle outer shadowBlur glow (8px, COLOR_PLAYER, alpha 0.4) when not invincible.

### Step 4 — Enemy vibrancy (renderer.js drawEnemyEntity / drawEnemyBody / drawEnemyCircleFallback)
- For each enemy `colorBody` fill, replace with radial gradient (lighter center → existing dark rim).
- Add 2 small black-pupil eyes or single bright eye highlight per enemy type to give "face".
- Increase outline thickness on body silhouette to 1.5 (was none / hairline) using a darker shade for definition.
- Boss bodies: add a 12px shadowBlur in their accent color.

### Step 5 — Projectile + bullet glow (renderer.js drawProjectile / drawEnemyProjectile / drawProjectileTrail)
- Bullets: draw 3-stop radial gradient — outer 2x radius `rgba(255,200,80,0)` → `COLOR_BULLET` → `COLOR_BULLET_CORE` (white-ish).
- Trails: increase trail segment count by 50%, alpha 0.4→0.6, blend mode 'lighter'.
- Enemy projectiles: same gradient pattern but in their accent.
- Orbitals: add inner white core + outer translucent halo.

### Step 6 — XP gems + pickups vibrancy (renderer.js drawXPGem / drawPickup)
- XP gems: replace flat fill with diamond gradient (bright center → tier color rim) + pulsing halo synced to existing animation timer.
- Health pickup: heart shape with red gradient (bright pink center → deep red rim) + 8px shadowBlur.
- Bomb/magnet: gradient + warm glow.

### Step 7 — Particle bursts (effects.js spawnKillParticles / spawnHitParticles / spawnExplosion)
- Increase default `count` parameters by ~40% (16→22, 8→12).
- Particles: draw lighter color core (mix toward white 30%) when life < 30%; existing fade out remains.
- spawnExplosion: outer ring brighter, double inner spark count.
- triggerShake/triggerFlash unchanged (not visual quality).

### Step 8 — CSS HUD warmth (style.css)
- Body bg `#050510` → `#0e1430` (lifts from pure black).
- `.overlay h1` text-shadow: stack a warm glow `0 0 24px rgba(255,179,71,0.45)` + existing blue.
- `.overlay h2` color `#FFDD44` → `#FFB347` (warmer gold).
- Buttons: gradient backgrounds (e.g. linear-gradient warm orange-red) for primary action; cool blue for secondary.
- HUD score/level number: add `text-shadow: 0 0 12px rgba(255,179,71,0.7)`.

## Files touched
constants.js, biomes.js, background.js, renderer.js, effects.js, style.css

## Verification
- Start `npx serve .` (user-side)
- Manual: load each biome, observe bg contrast, player highlight, enemy faces, projectile glow, particle density.
- No code paths should change behavior — only visual constants and draw calls.

## Out of scope
- New gameplay mechanics
- Sprite assets (still procedural)
- Per-enemy-type complete redraws (only gradient + face accent pass)
