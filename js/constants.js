// Canvas / viewport
export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 576;

// Player base stats
export const PLAYER_RADIUS = 16;
export const PLAYER_SPEED = 180;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_INVINCIBILITY = 0.5;
export const PLAYER_COLLECT_RADIUS = 20;
export const PLAYER_MAGNET_RADIUS = 80;

// Camera
export const CAMERA_LERP = 5;

// XP
export const XP_BASE = 10;
export const XP_EXPONENT = 1.5;

// Colors
export const COLOR_BG = '#1a1a2e';
export const COLOR_PLAYER = '#5AB8FF';
export const COLOR_PLAYER_DARK = '#1E5FB8';
export const COLOR_BULLET = '#FFE94A';
export const COLOR_BULLET_CORE = '#FFFFE0';
export const COLOR_XP_SMALL = '#5CFFA0';
export const COLOR_XP_MEDIUM = '#3DEEC0';
export const COLOR_XP_LARGE = '#6FF5FF';
export const COLOR_GOLD = '#FFD700';
export const COLOR_HEALTH_PICKUP = '#FF5577';
export const COLOR_GLOW_WARM = '#FFB347';

// Spawner
export const SPAWN_DISTANCE_MIN = 500;
export const SPAWN_DISTANCE_MAX = 700;
export const INITIAL_SPAWN_INTERVAL = 1.2;
export const MIN_SPAWN_INTERVAL = 0.3;
export const SPAWN_BUDGET_GROWTH = 0.5; // per second

// Object pool caps
export const MAX_ENEMIES = 1200;
export const MAX_PROJECTILES = 500;
export const MAX_PARTICLES = 2500;
export const MAX_XP_GEMS = 800;
export const MAX_PICKUPS = 32;

// Hit feedback
export const HIT_FLASH_DURATION = 0.05; // ~3 frames at 60fps
export const HIT_STOP_DURATION = 0.02; // 20ms freeze on regular kill
export const HIT_STOP_BOSS_DURATION = 0.04; // 40ms freeze on boss kill
export const HIT_STOP_MAX = 0.05; // 50ms cap to prevent cascading freezes

// Multi-kill time dilation
export const TIME_DILATION_FACTOR = 0.8; // 80% speed
export const TIME_DILATION_DURATION = 0.1; // 100ms
export const TIME_DILATION_KILL_THRESHOLD = 10; // kills in one frame

// Death animation
export const DEATH_ANIM_DURATION = 0.15; // 150ms total
export const DEATH_ANIM_EXPAND_PHASE = 0.05; // first 50ms: scale 1.0 → 1.3

// Spatial hash
export const SPATIAL_CELL_SIZE = 64;
