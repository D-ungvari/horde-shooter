import { initGame } from './game.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

function resizeCanvas() {
    const container = document.getElementById('game-container');
    const canvas = document.getElementById('game-canvas');
    if (!container || !canvas) return;

    const maxW = window.innerWidth;
    const maxH = window.innerHeight;
    const scale = Math.min(maxW / CANVAS_WIDTH, maxH / CANVAS_HEIGHT);
    canvas.style.width = (CANVAS_WIDTH * scale) + 'px';
    canvas.style.height = (CANVAS_HEIGHT * scale) + 'px';
}

window.addEventListener('load', () => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    initGame();
});
