import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BOARD_SIZE, isClear, mulberry32 } from './layout';
import { createBoardTexture } from './textures';

type Rect = { x: number; z: number; halfW: number; halfD: number };

type Greeble = { x: number; z: number; w: number; d: number; h: number; shade: number };

type Led = { x: number; z: number; color: THREE.Color };

// Rows of tiny status lights, placed first so components keep clear of them.
function buildLeds(): { leds: Led[]; zones: Rect[] } {
  const random = mulberry32(99);
  const leds: Led[] = [];
  const zones: Rect[] = [];
  const spacing = 0.12;
  let tries = 0;
  while (zones.length < 30 && tries < 600) {
    tries++;
    const cx = (random() * 2 - 1) * 18;
    const cz = (random() * 2 - 1) * 18;
    const rows = 2 + Math.floor(random() * 4);
    const cols = 3 + Math.floor(random() * 9);
    const halfW = (cols * spacing) / 2;
    const halfD = (rows * spacing) / 2;
    if (!isClear(cx, cz, Math.max(halfW, halfD) + 0.2)) continue;
    const gold = random() < 0.15;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (random() < 0.12) continue;
        const level = 0.5 + random() * 1.6;
        const color = gold ? new THREE.Color(1.6 * level, 0.95 * level, 0.3 * level) : new THREE.Color(0.35 * level, 0.75 * level, 2.2 * level);
        leds.push({ x: cx - halfW + (c + 0.5) * spacing, z: cz - halfD + (r + 0.5) * spacing, color });
      }
    }
    zones.push({ x: cx, z: cz, halfW: halfW + 0.15, halfD: halfD + 0.15 });
  }
  return { leds, zones };
}

function inZone(x: number, z: number, zones: Rect[], margin: number) {
  return zones.some((r) => Math.abs(x - r.x) < r.halfW + margin && Math.abs(z - r.z) < r.halfD + margin);
}

// Low components packed in "city blocks", with occasional tall parts and larger flat packages.
function buildGreebles(zones: Rect[]): Greeble[] {
  const random = mulberry32(7);
  const items: Greeble[] = [];
  const half = BOARD_SIZE / 2 - 1;

  const cell = 0.7;
  for (let gx = -half; gx < half; gx += cell) {
    for (let gz = -half; gz < half; gz += cell) {
      const field = Math.sin(gx * 0.31 + 1.3) * Math.cos(gz * 0.23 - 0.7) + 0.5 * Math.sin((gx + gz) * 0.17);
      if (random() > 0.42 + field * 0.32) continue;
      const w = cell * (0.3 + random() * 0.6);
      const d = cell * (0.3 + random() * 0.6);
      const x = gx + cell / 2 + (random() - 0.5) * (cell - w) * 0.8;
      const z = gz + cell / 2 + (random() - 0.5) * (cell - d) * 0.8;
      const margin = Math.max(w, d) / 2;
      if (!isClear(x, z, margin) || inZone(x, z, zones, margin)) continue;
      const tall = random() < 0.07;
      const h = tall ? 0.28 + random() * 0.55 : 0.03 + random() * random() * 0.24;
      items.push({ x, z, w, d, h, shade: 0.55 + random() * 0.6 });
    }
  }

  const bigCell = 2.6;
  for (let gx = -half; gx < half; gx += bigCell) {
    for (let gz = -half; gz < half; gz += bigCell) {
      if (random() > 0.22) continue;
      const w = 0.9 + random() * 1.4;
      const d = 0.9 + random() * 1.4;
      const x = gx + bigCell / 2;
      const z = gz + bigCell / 2;
      const margin = Math.max(w, d) / 2;
      if (!isClear(x, z, margin) || inZone(x, z, zones, margin)) continue;
      items.push({ x, z, w, d, h: 0.1 + random() * 0.14, shade: 0.45 + random() * 0.3 });
    }
  }

  return items;
}

export function Board() {
  const greebleRef = useRef<THREE.InstancedMesh>(null);
  const ledRef = useRef<THREE.InstancedMesh>(null);
  const texture = useMemo(() => {
    const t = createBoardTexture();
    t.repeat.set(BOARD_SIZE / 8, BOARD_SIZE / 8);
    return t;
  }, []);
  const { leds, greebles } = useMemo(() => {
    const built = buildLeds();
    return { leds: built.leds, greebles: buildGreebles(built.zones) };
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  useLayoutEffect(() => {
    const mesh = greebleRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const base = new THREE.Color('#4f5b70');
    const color = new THREE.Color();
    greebles.forEach((g, i) => {
      matrix.makeScale(g.w, g.h, g.d).setPosition(g.x, g.h / 2, g.z);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.copy(base).multiplyScalar(g.shade));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [greebles]);

  useLayoutEffect(() => {
    const mesh = ledRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    leds.forEach((led, i) => {
      matrix.makeScale(0.045, 0.02, 0.045).setPosition(led.x, 0.012, led.z);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, led.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [leds]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshStandardMaterial map={texture} roughness={0.62} metalness={0.45} />
      </mesh>

      <instancedMesh ref={greebleRef} args={[undefined, undefined, greebles.length]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color="#ffffff" metalness={0.55} roughness={0.42} />
      </instancedMesh>

      <instancedMesh ref={ledRef} args={[undefined, undefined, leds.length]}>
        <boxGeometry />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
