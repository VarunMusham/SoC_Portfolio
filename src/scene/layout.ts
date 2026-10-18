import * as THREE from 'three';
import { ips } from '../data/ips';

export const RING_RADIUS = 7;
// Half a step of rotation, so no chip sits dead centre in front of the camera at rest.
export const RING_PHASE = Math.PI / ips.length;
export const BOARD_SIZE = 56;

export const MAIN_CHIP = {
  substrate: 4.6,
  substrateHeight: 0.16,
  interposer: 3.3,
  interposerHeight: 0.1,
  lid: 2.7,
  lidHeight: 0.28,
  lidGap: 0.4,
};

export const IP_CHIP = {
  pad: 1.95,
  body: 1.42,
  bodyHeight: 0.3,
  standoff: 0.06,
  pinLength: 0.22,
  pinsPerSide: 10,
};

export const palette = {
  background: '#04060a',
  signal: new THREE.Color(0.28, 0.58, 1.0),
  pin: '#c9b48a',
  gold: '#d9b86a',
};

export function chipAngle(index: number): number {
  return (index / ips.length) * Math.PI * 2 + RING_PHASE;
}

// Centre of an IP chip footprint on the board, in board-local space.
export function blockPosition(index: number): THREE.Vector3 {
  const angle = chipAngle(index);
  return new THREE.Vector3(Math.sin(angle) * RING_RADIUS, 0, Math.cos(angle) * RING_RADIUS);
}

const ipPositions = ips.map((_, i) => blockPosition(i));

// Board-local point is free of the main chip, IP chips and the bus corridors between them.
export function isClear(x: number, z: number, margin = 0): boolean {
  const mainHalf = MAIN_CHIP.substrate / 2 + 0.8 + margin;
  if (Math.abs(x) < mainHalf && Math.abs(z) < mainHalf) return false;
  for (const p of ipPositions) {
    if (Math.hypot(x - p.x, z - p.z) < IP_CHIP.pad / 2 + 0.75 + margin) return false;
    const lengthSq = p.x * p.x + p.z * p.z;
    const t = Math.min(1, Math.max(0, (x * p.x + z * p.z) / lengthSq));
    if (Math.hypot(x - p.x * t, z - p.z * t) < 0.5 + margin) return false;
  }
  return true;
}

// Deterministic PRNG, so the procedural board is identical on every load.
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
