import * as THREE from 'three';
import { pulses, type Pulse } from '../diagram/flow';
import { ahb, apb, bridge, centreX, cpus, peripherals, VIEW, type Box } from '../diagram/layout';

// The 3D scene is the flat diagram stood up: x stays x, the diagram's y becomes depth (z),
// and hierarchy becomes height. The CPUs and AHB bus sit on a raised tier, the APB bus and
// peripherals on a lower one, so "faster bus domain" reads as "higher up".
const PX = 100;
export const wx = (x: number): number => (x - VIEW.width / 2) / PX;
export const wz = (y: number): number => (y - VIEW.height / 2) / PX;

export const TIER_A = 0.55;
export const TIER_B = 0.14;
const WIRE_A = TIER_A + 0.1;
const WIRE_B = TIER_B + 0.07;
const ROUTE_LIFT = 0.07;

export type BlockSpec = {
  id: string;
  label: string;
  kind: 'cpu' | 'bridge' | 'ip';
  slug?: string;
  cx: number;
  cz: number;
  width: number;
  depth: number;
  height: number;
  base: number;
};

const HEIGHT = { cpu: 0.7, bridge: 0.5, ip: 0.38 };

function spec(id: string, label: string, kind: BlockSpec['kind'], box: Box, slug?: string): BlockSpec {
  return {
    id,
    label,
    kind,
    slug,
    cx: wx(box.x + box.width / 2),
    cz: wz(box.y + box.height / 2),
    width: box.width / PX,
    depth: box.height / PX,
    height: HEIGHT[kind],
    base: kind === 'ip' ? TIER_B : TIER_A,
  };
}

export const blocks: BlockSpec[] = [
  ...cpus.map((cpu) => spec(cpu.label, cpu.label, 'cpu', cpu.box)),
  spec('bridge', bridge.label, 'bridge', bridge.box),
  ...peripherals.map((p) => spec(p.slug, p.name, 'ip', p.box, p.slug)),
];

export const ipBlocks = blocks.filter((b) => b.kind === 'ip');

export type Slab = { id: string; cx: number; cz: number; width: number; depth: number; top: number };

const ahbHalf = 4.4;
const ahbZ = [wz(cpus[0].box.y) - 0.55, wz(bridge.box.y + bridge.box.height) + 0.2];
const apbHalf = (apb.to - apb.from) / 2 / PX + 0.5;
const apbZ = [wz(apb.y) - 0.4, wz(Math.max(...peripherals.map((p) => p.box.y + p.box.height))) + 0.4];

export const slabs: Slab[] = [
  { id: 'ahb', cx: 0, cz: (ahbZ[0] + ahbZ[1]) / 2, width: ahbHalf * 2, depth: ahbZ[1] - ahbZ[0], top: TIER_A },
  { id: 'apb', cx: 0, cz: (apbZ[0] + apbZ[1]) / 2, width: apbHalf * 2, depth: apbZ[1] - apbZ[0], top: TIER_B },
];

export const rails = [
  { id: 'ahb', label: 'AHB', x1: wx(ahb.from), x2: wx(ahb.to), z: wz(ahb.y), y: WIRE_A },
  { id: 'apb', label: 'APB', x1: wx(apb.from), x2: wx(apb.to), z: wz(apb.y), y: WIRE_B },
];

const at = (x: number, y: number, height: number) => new THREE.Vector3(wx(x), height, wz(y));

// Where a pulse's wire runs in 3D. The one wire that leaves the bridge also drops from one tier to the next.
export function wirePath(pulse: Pulse): THREE.Vector3[] {
  const reply = pulse.kind === 'response';
  const id = reply ? pulse.id.slice(3) : pulse.id;
  const forward = pulses.find((p) => p.kind === 'request' && p.id === id) ?? pulse;
  const from = forward.from;
  const to = forward.to;

  let points: THREE.Vector3[];
  if (id === 'bridge-out') {
    const start = at(from[0], from[1], WIRE_A);
    const edge = start.z + 0.2;
    points = [start, new THREE.Vector3(start.x, WIRE_A, edge), new THREE.Vector3(start.x, WIRE_B, edge), at(to[0], to[1], WIRE_B)];
  } else {
    const height = id.startsWith('cpu') || id.startsWith('ahb') || id === 'bridge-in' ? WIRE_A : WIRE_B;
    points = [at(from[0], from[1], height), at(to[0], to[1], height)];
  }
  return reply ? points.reverse() : points;
}

// The route a request takes to one peripheral, for the hover highlight.
export function routePath(slug: string): THREE.Vector3[] {
  const block = peripherals.find((p) => p.slug === slug);
  if (!block) return [];
  const out = wirePath(pulses.find((p) => p.id === 'bridge-out')!);
  const bus = at(centreX(block.box), apb.y, WIRE_B);
  if (bus.distanceTo(out[out.length - 1]) > 1e-6) out.push(bus);
  out.push(at(centreX(block.box), block.box.y, WIRE_B));
  // Ride just above the rail and the conduits, so the lit route is never hidden inside them.
  return out.map((point) => point.add(new THREE.Vector3(0, ROUTE_LIFT, 0)));
}
