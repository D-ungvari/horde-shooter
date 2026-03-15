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
export const COLOR_PLAYER = '#4488EE';
export const COLOR_PLAYER_DARK = '#2266CC';
export const COLOR_BULLET = '#FFDD44';
export const COLOR_XP_SMALL = '#44FF88';
export const COLOR_XP_MEDIUM = '#22DDAA';
export const COLOR_XP_LARGE = '#44EEFF';
export const COLOR_GOLD = '#FFD700';
export const COLOR_HEALTH_PICKUP = '#FF4466';

// Spawner
export const SPAWN_DISTANCE_MIN = 500;
export const SPAWN_DISTANCE_MAX = 700;
export const INITIAL_SPAWN_INTERVAL = 2.0;
export const MIN_SPAWN_INTERVAL = 0.3;
export const SPAWN_BUDGET_GROWTH = 0.5; // per second

// Object pool caps
export const MAX_ENEMIES = 600;
export const MAX_PROJECTILES = 500;
export const MAX_PARTICLES = 2000;
export const MAX_XP_GEMS = 500;

// Hit feedback
export const HIT_FLASH_DURATION = 0.05; // ~3 frames at 60fps
export const HIT_STOP_DURATION = 0.02; // 20ms freeze on regular kill
export const HIT_STOP_BOSS_DURATION = 0.04; // 40ms freeze on boss kill
export const HIT_STOP_MAX = 0.05; // 50ms cap to prevent cascading freezes

// Spatial hash
export const SPATIAL_CELL_SIZE = 64;
