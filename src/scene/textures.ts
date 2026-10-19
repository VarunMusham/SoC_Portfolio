import * as THREE from 'three';

const FAMILY = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif";

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

type LabelOptions = { color?: string; weight?: number; spacing?: number; width?: number; height?: number };

// Text for a block's top face. Drawn again once the web fonts have loaded, so it never shows the fallback face.
export function createLabelTexture(text: string, { color = '#f5f7fa', weight = 600, spacing = 0, width = 512, height = 192 }: LabelOptions = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const texture = toTexture(canvas);

  const draw = () => {
    ctx.clearRect(0, 0, width, height);
    let size = height * 0.74;
    const setFont = () => {
      ctx.font = `${weight} ${size}px ${FAMILY}`;
      ctx.letterSpacing = `${spacing * size}px`;
    };
    setFont();
    const fit = (width * 0.9) / ctx.measureText(text).width;
    if (fit < 1) {
      size *= fit;
      setFont();
    }
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2 + size * 0.04);
    texture.needsUpdate = true;
  };

  draw();
  void document.fonts?.ready.then(draw);
  return texture;
}

// The top of a tier: a faint dot grid and a lit border, so the slab reads as a lit surface.
export function createSlabTexture(widthUnits: number, depthUnits: number, pxPerUnit = 110) {
  const w = Math.round(widthUnits * pxPerUnit);
  const h = Math.round(depthUnits * pxPerUnit);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(130, 175, 255, 0.16)';
  const step = pxPerUnit / 2;
  for (let x = step; x < w; x += step) for (let y = step; y < h; y += step) ctx.fillRect(x - 1, y - 1, 2, 2);

  const inset = pxPerUnit * 0.1;
  ctx.strokeStyle = 'rgba(80, 160, 255, 0.55)';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(40, 130, 255, 0.9)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, pxPerUnit * 0.12);
  ctx.stroke();
  return toTexture(canvas);
}

// A soft rounded shadow, stretched over each block's footprint. It grows as the block lifts.
export function createShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  // Draw the shape far off-canvas and keep only its blurred shadow, which works in every browser.
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetX = 2000;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.roundRect(60 - 2000, 60, 136, 136, 26);
  ctx.fill();
  return toTexture(canvas);
}

// The board surface: faint tile lines, repeated across a large plane.
export function createBoardTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#080b10';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(100, 150, 230, 0.10)';
  ctx.fillRect(0, 0, size, 1.5);
  ctx.fillRect(0, 0, 1.5, size);
  ctx.fillStyle = 'rgba(100, 150, 230, 0.05)';
  ctx.fillRect(0, size / 2, size, 1);
  ctx.fillRect(size / 2, 0, 1, size);
  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(90, 90);
  return texture;
}

// Deterministic PRNG, so the surrounding board is identical on every load.
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
