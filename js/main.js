import { initGame } from './game.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

function resizeCanvas() {
    const container = document.getElementById('game-container');
    const canvas = document.getElementById('game-canvas');
    if (!container || !canvas) return;

    const scale = Math.min(window.innerWidth / CANVAS_WIDTH, window.innerHeight / CANVAS_HEIGHT);
    const w = (CANVAS_WIDTH * scale) + 'px';
    const h = (CANVAS_HEIGHT * scale) + 'px';
    canvas.style.width = w;
    canvas.style.height = h;
    container.style.width = w;
    container.style.height = h;
}

window.addEventListener('load', () => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    initGame();
});
