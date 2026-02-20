// Shared drawing primitives

export function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
}

export function drawCircle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

export function drawRing(ctx, x, y, r, lineWidth) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

export function drawBar(ctx, x, y, w, h, ratio, fgColor, bgColor = '#222', borderColor = '#555') {
    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);
    // Foreground
    if (ratio > 0) {
        ctx.fillStyle = fgColor;
        ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, ratio)), h - 2);
    }
    // Border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
}

export function drawGlow(ctx, x, y, r, color, alpha = 0.3) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    drawCircle(ctx, x, y, r);
    ctx.globalAlpha = 1.0;
}

export function drawLine(ctx, x1, y1, x2, y2, color, width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}
