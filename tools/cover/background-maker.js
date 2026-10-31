/* Local, seeded Canvas materials. No uploads, network access, fonts or AI service. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CoverTextures = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const styles = new Set(['paper', 'canvas', 'wash', 'cutpaper']);
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  function color(value, fallback) {
    value = value === undefined ? fallback : value;
    if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) {
      throw new TypeError('请选择有效的六位十六进制颜色。');
    }
    return [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
  }
  const mix = (a, b, weight) => a.map((value, i) => Math.round(value * (1 - weight) + b[i] * weight));
  const rgba = (rgb, opacity = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`;
  function random(seed) {
    let value = seed >>> 0;
    return function () {
      value = (value + 0x6d2b79f5) >>> 0;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normalize(options) {
    const style = options.style === undefined ? 'paper' : options.style;
    if (!styles.has(style)) throw new TypeError('不支持的材质，请重新选择。');
    const intensity = Number(options.intensity);
    const seed = Number(options.seed);
    return {
      style,
      base: color(options.base, '#f3eee2'),
      accent: color(options.accent, '#809185'),
      strength: Number.isFinite(intensity) ? clamp(intensity, 0, 100) / 100 : 0.45,
      seed: Number.isFinite(seed) && seed > 0 ? (Math.floor(seed) >>> 0) || 1 : 1,
    };
  }

  function paperLight(ctx, w, h, base, accent, strength) {
    const light = ctx.createLinearGradient(0, 0, w * 0.85, h);
    light.addColorStop(0, rgba(mix(base, [255, 255, 255], strength * 0.08)));
    light.addColorStop(0.55, rgba(base));
    light.addColorStop(1, rgba(mix(base, accent, strength * 0.04)));
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);
    const edge = ctx.createRadialGradient(w * 0.44, h * 0.38, Math.min(w, h) * 0.12,
      w * 0.44, h * 0.38, Math.max(w, h) * 0.85);
    edge.addColorStop(0, rgba(base, 0));
    edge.addColorStop(0.65, rgba(base, 0));
    edge.addColorStop(1, rgba(mix(base, accent, 0.55), strength * 0.12));
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);
  }

  function softWash(ctx, w, h, base, accent, rng, strength) {
    const stains = [
      [0.99, 0.55, 0.23, 0.40], [0.87, 0.81, 0.31, 0.30],
      [0.63, 1.03, 0.43, 0.23], [1.04, 1.05, 0.38, 0.33],
    ];
    for (const [x, y, rx, ry] of stains) {
      ctx.save();
      ctx.translate(x * w, y * h);
      ctx.rotate((rng() - 0.5) * 0.35);
      ctx.scale(rx * w, ry * h);
      const pigment = ctx.createRadialGradient(-0.15, 0.05, 0.05, 0, 0, 1);
      pigment.addColorStop(0, rgba(mix(base, accent, 0.83), strength * 0.33));
      pigment.addColorStop(0.5, rgba(accent, strength * 0.22));
      pigment.addColorStop(0.83, rgba(accent, strength * 0.11));
      pigment.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = pigment;
      ctx.beginPath();
      ctx.moveTo(-1, 0.04);
      ctx.bezierCurveTo(-0.95, -0.62, -0.38, -1.03, 0.16, -0.91);
      ctx.bezierCurveTo(0.84, -0.86, 1.07, -0.19, 0.94, 0.36);
      ctx.bezierCurveTo(0.66, 1.04, -0.25, 1.08, -0.83, 0.64);
      ctx.bezierCurveTo(-0.98, 0.43, -1.02, 0.20, -1, 0.04);
      ctx.fill();
      ctx.restore();
    }
    // Broken, dry pigment strokes stay along the lower/right margins.
    const unit = Math.min(w, h) / 1000;
    for (let i = 0; i < 115; i++) {
      const lower = i % 3 !== 0;
      const x = w * (lower ? 0.42 + rng() * 0.66 : 0.88 + rng() * 0.15);
      const y = h * (lower ? 0.84 + rng() * 0.19 : 0.42 + rng() * 0.60);
      const length = (25 + rng() * 115) * unit;
      ctx.strokeStyle = rgba(i % 4 ? accent : mix(base, [255, 255, 255], 0.5), strength * (0.025 + rng() * 0.045));
      ctx.lineWidth = (0.5 + rng() * 2.8) * unit;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + length * 0.3, y - 3 * unit,
        x + length * 0.7, y + (rng() - 0.5) * 8 * unit, x + length, y - 2 * unit);
      ctx.stroke();
    }
  }

  function paperCollage(ctx, w, h, base, accent, rng, strength) {
    const unit = Math.min(w, h) / 1000;
    const pieces = [
      { x: 0.82, y: 0.82, width: 0.64, height: 0.43, turn: -0.13, tone: mix(base, accent, 0.36) },
      { x: 1.03, y: 0.66, width: 0.40, height: 0.69, turn: 0.14, tone: mix(base, accent, 0.63) },
      { x: 0.70, y: 1.09, width: 0.78, height: 0.35, turn: 0.09, tone: mix(base, [255, 255, 255], 0.5) },
    ];
    for (const piece of pieces) {
      const pw = piece.width * w, ph = piece.height * h;
      const edge = Math.max(0.7, unit * 1.6);
      ctx.save();
      ctx.translate(piece.x * w, piece.y * h);
      ctx.rotate(piece.turn + (rng() - 0.5) * 0.04);
      ctx.beginPath();
      const points = [[-pw / 2, -ph / 2], [0, -ph / 2], [pw / 2, -ph / 2],
        [pw / 2, 0], [pw / 2, ph / 2], [0, ph / 2], [-pw / 2, ph / 2], [-pw / 2, 0]];
      points.forEach(([x, y], i) => {
        x += (rng() - 0.5) * edge;
        y += (rng() - 0.5) * edge;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.shadowColor = rgba(mix(accent, [40, 43, 35], 0.5), strength * 0.13);
      ctx.shadowBlur = 16 * unit;
      ctx.shadowOffsetX = -3 * unit;
      ctx.shadowOffsetY = 6 * unit;
      ctx.fillStyle = rgba(mix(base, piece.tone, strength));
      ctx.fill();
      ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.strokeStyle = rgba([255, 255, 255], strength * 0.50);
      ctx.lineWidth = Math.max(0.5, unit * 1.2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function grain(ctx, w, h, style, rng, strength) {
    const image = ctx.getImageData(0, 0, w, h);
    const pixels = image.data;
    const amplitude = (style === 'canvas' ? 7 : 5.5) * strength;
    const weave = style === 'canvas';
    const spacing = Math.max(3, Math.round(Math.min(w, h) / 330));
    for (let y = 0, p = 0; y < h; y++) {
      const drift = (rng() - 0.5) * strength * 0.65;
      const row = weave && y % spacing === 0 ? -1.75 * strength : 0;
      for (let x = 0; x < w; x++, p += 4) {
        const delta = (rng() - 0.5) * amplitude + drift + row
          + (weave && x % spacing === 0 ? -1.4 * strength : 0);
        pixels[p] += delta;
        pixels[p + 1] += delta;
        pixels[p + 2] += delta;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function fibres(ctx, w, h, base, accent, rng, strength, woven) {
    const unit = Math.min(w, h) / 1000;
    const count = Math.min(1600, Math.max(100, Math.round(w * h / 3000)));
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = rng() * w, y = rng() * h;
      const length = (2 + rng() * (woven ? 6 : 11)) * unit;
      const turn = woven ? (i % 2 ? 0 : Math.PI / 2) : (rng() - 0.5) * 0.6;
      const dx = Math.cos(turn) * length, dy = Math.sin(turn) * length;
      ctx.strokeStyle = rgba(i % 3 ? mix(base, accent, 0.45) : [255, 255, 255], strength * (0.05 + rng() * 0.09));
      ctx.lineWidth = Math.max(0.35, (0.35 + rng() * 0.55) * unit);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + dx * 0.3, y + dy * 0.3 - unit,
        x + dx * 0.7, y + dy * 0.7 + unit, x + dx, y + dy);
      ctx.stroke();
    }
  }

  function render(canvas, options = {}) {
    const settings = normalize(options);
    const w = canvas && canvas.width, h = canvas && canvas.height;
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1
      || w > 4096 || h > 4096 || w * h > 16777216 || typeof canvas.getContext !== 'function') {
      throw new TypeError('画布尺寸需在1到4096像素之间。');
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('当前浏览器不支持画布生成，请使用上传底图。');
    const { base, accent, strength, style, seed } = settings;
    const rng = random(seed);
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = rgba(base);
      ctx.fillRect(0, 0, w, h);
      if (strength === 0) return canvas;
      paperLight(ctx, w, h, base, accent, strength);
      if (style === 'wash') softWash(ctx, w, h, base, accent, rng, strength);
      if (style === 'cutpaper') paperCollage(ctx, w, h, base, accent, rng, strength);
      grain(ctx, w, h, style, rng, strength);
      fibres(ctx, w, h, base, accent, rng, strength, style === 'canvas');
    } finally {
      ctx.restore();
    }
    return canvas;
  }

  return Object.freeze({ render });
});
