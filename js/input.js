const keys = {};
const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, clicked: false };

let cameraRef = null;

export function initInput(canvas, camera) {
    cameraRef = camera;

    window.addEventListener('keydown', e => {
        keys[e.key.toLowerCase()] = true;
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', e => {
        keys[e.key.toLowerCase()] = false;
    });

    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        mouse.x = (e.clientX - rect.left) * scaleX;
        mouse.y = (e.clientY - rect.top) * scaleY;
        updateWorldMouse();
    });

    canvas.addEventListener('mousedown', e => {
        if (e.button === 0) {
            mouse.down = true;
            mouse.clicked = true;
        }
    });

    canvas.addEventListener('mouseup', e => {
        if (e.button === 0) mouse.down = false;
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function updateWorldMouse() {
    if (cameraRef) {
        const world = cameraRef.screenToWorld(mouse.x, mouse.y);
        mouse.worldX = world.x;
        mouse.worldY = world.y;
    }
}

export function updateCamera(camera) {
    cameraRef = camera;
    updateWorldMouse();
}

export function isKeyDown(key) {
    return !!keys[key.toLowerCase()];
}

export function getMouse() {
    return mouse;
}

export function getMouseWorld() {
    return { x: mouse.worldX, y: mouse.worldY };
}

export function resetFrameInput() {
    mouse.clicked = false;
}
