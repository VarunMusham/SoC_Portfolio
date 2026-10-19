import { ahb, apb, bridge, centreX, cpu, peripherals, type Peripheral } from './layout';

// One loop of traffic: a request travels CPU -> AHB -> bridge -> APB -> peripheral, then each
// peripheral answers back along the same wires. The schedule comes from the geometry, so a
// block at the end of the APB bus is reached later than one beside the bridge.
export const CYCLE = 8;

type Point = readonly [number, number];
export type Pulse = {
  id: string;
  from: Point;
  to: Point;
  start: number;
  dur: number;
  kind: 'request' | 'response';
};

const REQUEST = { cpu: 0, ahb: 0.45, bridgeIn: 0.55, bridgeOut: 0.95, apb: 1.35 };
const DURATION = { cpu: 0.5, ahb: 0.7, bridge: 0.35, apb: 1.3, leaf: 0.45 };
const RESPONSE_AT = 3.6;

const cx = centreX(bridge.box);
const bridgeBottom = bridge.box.y + bridge.box.height;
const apbHalf = (apb.to - apb.from) / 2;

function requests(): Pulse[] {
  const out: Pulse[] = [];
  out.push({ id: 'cpu', from: [cx, cpu.box.y + cpu.box.height], to: [cx, ahb.y], start: REQUEST.cpu, dur: DURATION.cpu, kind: 'request' });
  // The CPU is the only master, so the bus rail simply carries the request out from its tap.
  out.push({ id: 'ahb-left', from: [cx, ahb.y], to: [ahb.from, ahb.y], start: REQUEST.ahb, dur: DURATION.ahb, kind: 'request' });
  out.push({ id: 'ahb-right', from: [cx, ahb.y], to: [ahb.to, ahb.y], start: REQUEST.ahb, dur: DURATION.ahb, kind: 'request' });
  out.push({ id: 'bridge-in', from: [cx, ahb.y], to: [cx, bridge.box.y], start: REQUEST.bridgeIn, dur: DURATION.bridge, kind: 'request' });
  out.push({ id: 'bridge-out', from: [cx, bridgeBottom], to: [cx, apb.y], start: REQUEST.bridgeOut, dur: DURATION.bridge, kind: 'request' });
  out.push({ id: 'apb-left', from: [cx, apb.y], to: [apb.from, apb.y], start: REQUEST.apb, dur: DURATION.apb, kind: 'request' });
  out.push({ id: 'apb-right', from: [cx, apb.y], to: [apb.to, apb.y], start: REQUEST.apb, dur: DURATION.apb, kind: 'request' });
  for (const p of peripherals) {
    const x = centreX(p.box);
    // The arrow lights as the wave passes its tap on the bus.
    const reached = REQUEST.apb + (Math.abs(x - cx) / apbHalf) * DURATION.apb;
    out.push({ id: `leaf-${p.slug}`, from: [x, apb.y], to: [x, p.box.y], start: reached, dur: DURATION.leaf, kind: 'request' });
  }
  return out;
}

const forward = requests();
const forwardEnd = Math.max(...forward.map((p) => p.start + p.dur));

// The reply is the request played backwards: same wires, reversed in direction and in time.
const replies: Pulse[] = forward.map((p) => ({
  id: `re-${p.id}`,
  from: p.to,
  to: p.from,
  start: RESPONSE_AT + (forwardEnd - (p.start + p.dur)),
  dur: p.dur,
  kind: 'response',
}));

export const pulses: Pulse[] = [...forward, ...replies];

// When the wave reaches a block, for its arrival flash.
export const arrival = {
  bridge: REQUEST.bridgeOut,
  /** The CPU lights as it sends a request, and again when the last response comes back to it. */
  cpuLaunch: REQUEST.cpu,
  cpu: RESPONSE_AT + forwardEnd,
  peripheral: (slug: string): number => {
    const leaf = forward.find((p) => p.id === `leaf-${slug}`);
    return leaf ? leaf.start + leaf.dur : 0;
  },
};

export const pulsePath = (p: Pulse): string => `M${p.from[0]} ${p.from[1]}L${p.to[0]} ${p.to[1]}`;

// The route a request takes to one peripheral, for the hover highlight.
export function routeFor(p: Peripheral): string {
  return `M${cx} ${bridgeBottom}V${apb.y}H${centreX(p.box)}V${p.box.y}`;
}

// Each pulse is a short dash that crosses its wire once per cycle and is hidden the rest of the time.
// The dash is measured against pathLength=100, so one keyframe shape fits every wire length.
export function flowCss(): string {
  const pct = (seconds: number) => (Math.max(0, seconds / CYCLE) * 100).toFixed(3);
  return pulses
    .map((p) => {
      const a = p.start;
      const b = p.start + p.dur;
      return `@keyframes pulse-${p.id}{0%,${pct(a - 0.01)}%{stroke-dashoffset:14;opacity:0}${pct(a)}%{stroke-dashoffset:14;opacity:1}${pct(b)}%{stroke-dashoffset:-100;opacity:1}${pct(b + 0.01)}%,100%{stroke-dashoffset:-100;opacity:0}}`;
    })
    .join('');
}
