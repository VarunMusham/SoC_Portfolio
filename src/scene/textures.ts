import * as THREE from 'three';
import { mulberry32 } from './layout';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function makeCanvas(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement, anisotropy = 8): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

// Draws now, then again once the web fonts are ready, so etched text never sticks with a fallback face.
function drawWithFonts(draw: () => void, textures: THREE.Texture[]) {
  draw();
  document.fonts
    ?.load(`600 64px ${MONO}`)
    .then(() => {
      draw();
      textures.forEach((t) => (t.needsUpdate = true));
    })
    .catch(() => {});
}

function speckle(ctx: CanvasRenderingContext2D, size: number, count: number, seed: number) {
  const random = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(random() * size, random() * size, 1 + random(), 1 + random());
  }
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
  const { canvas, ctx } = makeCanvas(size);
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

/** Board surface: near-black laminate with a fine pad grid and faint component outlines. */
export function createBoardTexture() {
  const size = 1024;
  const { canvas, ctx } = makeCanvas(size);
  const random = mulberry32(11);

  ctx.fillStyle = '#10141b';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 70; i++) {
    const w = 30 + random() * 220;
    const h = 20 + random() * 160;
    const x = random() * size;
    const y = random() * size;
    ctx.fillStyle = `rgba(40, 50, 66, ${0.25 + random() * 0.35})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(110, 140, 190, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  ctx.fillStyle = 'rgba(140, 160, 190, 0.07)';
  for (let y = 0; y < size; y += 8) {
    for (let x = 0; x < size; x += 8) {
      if (random() < 0.55) ctx.fillRect(x + 3, y + 3, 2, 2);
    }
  }

  ctx.strokeStyle = 'rgba(70, 120, 210, 0.1)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    const horizontal = random() > 0.5;
    const p = random() * size;
    const a = random() * size;
    const b = a + 80 + random() * 300;
    if (horizontal) {
      ctx.moveTo(a, p);
      ctx.lineTo(b, p);
    } else {
      ctx.moveTo(p, a);
      ctx.lineTo(p, b);
    }
    ctx.stroke();
  }

  speckle(ctx, size, 9000, 12);

  const texture = toTexture(canvas, 16);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Main SoC lid: matte dark metal with faint laser marking and a pin-1 mark. */
export function createMainLidTexture() {
  const size = 1024;
  const { canvas, ctx } = makeCanvas(size);
  const texture = toTexture(canvas);

  drawWithFonts(() => {
    const sheen = ctx.createLinearGradient(0, 0, size, size);
    sheen.addColorStop(0, '#1d2026');
    sheen.addColorStop(0.5, '#15171b');
    sheen.addColorStop(1, '#1a1c21');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, 14000, 21);

    ctx.strokeStyle = 'rgba(150, 160, 175, 0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(90, 90, 22, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(150, 160, 175, 0.3)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 54px ${MONO}`;
    ctx.fillText('LEGACY IP SoC', 80, size - 130);
    ctx.font = `400 32px ${MONO}`;
    ctx.fillStyle = 'rgba(150, 160, 175, 0.2)';
    ctx.fillText('8 PERIPHERALS  SHARED BUS', 80, size - 80);
  }, [texture]);

  return texture;
}

/** IP chip lid: etched name and version, plus a glow map holding only the text for hover. */
export function createIpLidTextures(name: string, version: string) {
  const size = 512;
  const base = makeCanvas(size);
  const glow = makeCanvas(size);
  const map = toTexture(base.canvas);
  const glowMap = toTexture(glow.canvas);

  drawWithFonts(() => {
    const { ctx } = base;
    ctx.fillStyle = '#16181c';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, 5000, name.length * 7 + 3);

    ctx.fillStyle = '#0d0f12';
    ctx.strokeStyle = 'rgba(160, 170, 185, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(70, 70, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    for (const target of [base.ctx, glow.ctx]) {
      if (target === glow.ctx) {
        target.fillStyle = '#000';
        target.fillRect(0, 0, size, size);
      }
      target.textAlign = 'center';
      target.textBaseline = 'middle';
      target.font = `600 ${name.length > 3 ? 116 : 136}px ${MONO}`;
      target.fillStyle = target === glow.ctx ? '#ffffff' : 'rgba(170, 180, 196, 0.88)';
      target.fillText(name, size / 2, size / 2 - 20);
      target.font = `400 38px ${MONO}`;
      target.fillStyle = target === glow.ctx ? 'rgba(255,255,255,0.45)' : 'rgba(120, 130, 146, 0.8)';
      target.fillText(version.toUpperCase(), size / 2, size / 2 + 78);
    }
  }, [map, glowMap]);

  return { map, glowMap };
}
