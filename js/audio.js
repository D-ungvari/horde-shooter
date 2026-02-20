// Procedural Web Audio sound effects — no external files needed
let audioCtx = null;
let masterGain = null;
let muted = false;

function getCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(audioCtx.destination);
    }
    return audioCtx;
}

function getMaster() {
    getCtx();
    return masterGain;
}

export function setMuted(val) { muted = val; }
export function isMuted() { return muted; }

// --- Sound helpers ---

function playTone(freq, duration, type = 'square', volume = 0.3, detune = 0) {
    if (muted) return;
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (detune) osc.detune.value = detune;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(getMaster());
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
}

function playNoise(duration, volume = 0.2, bandpass = 0) {
    if (muted) return;
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() - 0.5) * 2;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    if (bandpass > 0) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = bandpass;
        filter.Q.value = 2;
        source.connect(filter);
        filter.connect(gain);
    } else {
        source.connect(gain);
    }

    gain.connect(getMaster());
    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + duration);
}

// === Public SFX ===

export function playShoot() {
    playTone(600, 0.08, 'square', 0.15);
    playNoise(0.05, 0.1, 3000);
}

export function playShotgun() {
    playNoise(0.1, 0.25, 1500);
    playTone(200, 0.1, 'sawtooth', 0.1);
}

export function playSmg() {
    playTone(800, 0.04, 'square', 0.08);
    playNoise(0.03, 0.05, 5000);
}

export function playRocket() {
    playTone(120, 0.3, 'sawtooth', 0.15);
    playNoise(0.2, 0.1, 800);
}

export function playLightning() {
    playNoise(0.15, 0.2, 2000);
    playTone(1200, 0.1, 'sine', 0.15);
    playTone(800, 0.15, 'sine', 0.1);
}

export function playFlame() {
    playNoise(0.08, 0.06, 600);
}

export function playFrostNova() {
    playTone(400, 0.2, 'sine', 0.15);
    playTone(600, 0.3, 'sine', 0.1);
    playNoise(0.15, 0.08, 4000);
}

export function playEnemyHit() {
    playTone(300, 0.06, 'square', 0.08);
}

export function playEnemyDeath() {
    playTone(200, 0.15, 'square', 0.12);
    playTone(100, 0.2, 'sawtooth', 0.08);
    playNoise(0.1, 0.08, 1000);
}

export function playBossDeath() {
    playTone(80, 0.5, 'sawtooth', 0.2);
    playTone(60, 0.6, 'square', 0.15);
    playNoise(0.4, 0.2, 500);
    // Delayed boom
    setTimeout(() => {
        playTone(40, 0.4, 'sawtooth', 0.2);
        playNoise(0.3, 0.15, 300);
    }, 200);
}

export function playPlayerHit() {
    playTone(150, 0.15, 'sawtooth', 0.2);
    playNoise(0.1, 0.1, 800);
}

export function playPlayerDeath() {
    playTone(200, 0.3, 'sawtooth', 0.25);
    playTone(100, 0.5, 'square', 0.2);
    playNoise(0.4, 0.15, 500);
}

export function playLevelUp() {
    playTone(523, 0.1, 'sine', 0.15); // C5
    setTimeout(() => playTone(659, 0.1, 'sine', 0.15), 100); // E5
    setTimeout(() => playTone(784, 0.15, 'sine', 0.2), 200); // G5
    setTimeout(() => playTone(1047, 0.25, 'sine', 0.2), 300); // C6
}

export function playXPPickup() {
    playTone(800 + Math.random() * 400, 0.05, 'sine', 0.06);
}

export function playBossWarning() {
    playTone(200, 0.3, 'square', 0.2);
    setTimeout(() => playTone(200, 0.3, 'square', 0.2), 400);
    setTimeout(() => playTone(300, 0.5, 'square', 0.25), 800);
}

export function playExplosion() {
    playTone(80, 0.3, 'sawtooth', 0.2);
    playNoise(0.25, 0.2, 400);
}

export function playPickupChoice() {
    playTone(600, 0.08, 'sine', 0.15);
    playTone(800, 0.12, 'sine', 0.12);
}
