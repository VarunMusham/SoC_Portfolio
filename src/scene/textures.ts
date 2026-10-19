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

// Outward normal and tangent for each side of a square, in canvas coordinates.
const SIDES = [
  { n: [1, 0], t: [0, 1] },
  { n: [-1, 0], t: [0, -1] },
  { n: [0, 1], t: [-1, 0] },
  { n: [0, -1], t: [1, 0] },
] as const;

/**
 * Substrate top with fan-out routing, as on a real package: parallel traces leave the die edge,
 * jog 45 degrees to spread across the side, and end in vias near the package edge.
 * Used as both colour and emissive map, so only the copper glows.
 */
export function createCircuitTexture(size: number, seed: number, lanesPerSide: number, dieFraction: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const random = mulberry32(seed);
  const s = size / 512;
  const c = size / 2;
  const inner = (size * dieFraction) / 2;
  const outer = size / 2 - 14 * s;

  ctx.fillStyle = '#03060c';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(40, 90, 190, 0.35)';
  ctx.lineWidth = 1.2 * s;
  ctx.strokeRect(8 * s, 8 * s, size - 16 * s, size - 16 * s);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const { n, t } of SIDES) {
    const at = (along: number, out: number) => [c + n[0] * out + t[0] * along, c + n[1] * out + t[1] * along] as const;
    for (let i = 0; i < lanesPerSide; i++) {
      if (random() < 0.08) continue;
      const f = ((i + 0.5) / lanesPerSide) * 2 - 1;
      const uIn = f * inner * 0.92;
      const jog = (outer - inner) * (0.06 + random() * 0.14);
      const room = Math.max(0, outer - 8 * s - inner - jog);
      const du = Math.max(-room, Math.min(room, f * outer * 0.96 - uIn));
      const uOut = uIn + du;
      const end = outer - random() * 10 * s;

      const bright = 0.45 + random() * 0.55;
      const colour = `rgba(${Math.round(60 + bright * 70)}, ${Math.round(130 + bright * 80)}, 255, ${bright})`;
      ctx.strokeStyle = colour;
      ctx.lineWidth = (0.8 + random() * 0.9) * s;
      ctx.shadowColor = '#2f7bff';
      ctx.shadowBlur = 3 * s;
      ctx.beginPath();
      ctx.moveTo(...at(uIn, inner));
      ctx.lineTo(...at(uIn, inner + jog));
      ctx.lineTo(...at(uOut, inner + jog + Math.abs(du)));
      ctx.lineTo(...at(uOut, end));
      ctx.stroke();

      // Via: a bright ring with a dark drill hole.
      const [vx, vy] = at(uOut, end);
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(vx, vy, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#03060c';
      ctx.beginPath();
      ctx.arc(vx, vy, 0.9 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sparse test pads between the lanes.
  ctx.shadowBlur = 0;
  for (let i = 0; i < lanesPerSide * 2; i++) {
    const px = random() * size;
    const py = random() * size;
    if (Math.abs(px - c) < inner + 6 * s && Math.abs(py - c) < inner + 6 * s) continue;
    ctx.fillStyle = `rgba(60, 120, 230, ${0.12 + random() * 0.25})`;
    ctx.fillRect(px, py, (2 + random() * 4) * s, (2 + random() * 2) * s);
  }

  return toTexture(canvas);
}

// The CPU's heat-spreader lid: dark brushed metal with the name and a pin-1 mark laser-etched in.
export function createChipLidTexture(name: string, caption: string) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const texture = toTexture(canvas);
  const random = mulberry32(21);

  const draw = () => {
    const sheen = ctx.createLinearGradient(0, 0, size, size);
    sheen.addColorStop(0, '#222730');
    sheen.addColorStop(0.5, '#171a20');
    sheen.addColorStop(1, '#1d2027');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 14000; i++) {
      ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(random() * size, random() * size, 1 + random(), 1 + random());
    }

    ctx.strokeStyle = 'rgba(160, 172, 190, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(100, 100, 24, 0, Math.PI * 2);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(205, 214, 228, 0.86)';
    ctx.font = `650 250px ${FAMILY}`;
    ctx.letterSpacing = '-8px';
    ctx.fillText(name, size / 2, size / 2 - 20);
    ctx.letterSpacing = '6px';
    ctx.fillStyle = 'rgba(150, 162, 180, 0.6)';
    ctx.font = `500 44px ${FAMILY}`;
    ctx.fillText(caption, size / 2, size - 150);
    texture.needsUpdate = true;
  };

  draw();
  void document.fonts?.ready.then(draw);
  return texture;
}
