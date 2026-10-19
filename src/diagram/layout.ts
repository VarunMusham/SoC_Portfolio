import { ips } from '../data/ips';

// Everything is drawn in one fixed coordinate space that the SVG scales to the screen,
// so the layout is identical at every laptop resolution.
export const VIEW = { width: 1600, height: 900 };

export type Box = { x: number; y: number; width: number; height: number };

export const centreX = (box: Box) => box.x + box.width / 2;

const box = (cx: number, y: number, width: number, height: number): Box => ({ x: cx - width / 2, y, width, height });

// One CPU on the AHB bus. The bridge sits below it and steps down to APB. The CPU is a square
// package, drawn as a chip rather than a box, so it is given more room than the other blocks.
const CPU_SIZE = 260;
const BRIDGE_SIZE = { width: 230, height: 84 };
const CENTRE_X = VIEW.width / 2;

export const cpu = { label: 'CPU', box: box(CENTRE_X, 40, CPU_SIZE, CPU_SIZE) };

// With a single master the AHB bus is a short rail: the CPU taps it at the centre, and so does the bridge.
export const ahb = { y: 355, from: CENTRE_X - 220, to: CENTRE_X + 220, label: 'AHB' };
export const bridge = { label: 'AHB2APB', box: box(CENTRE_X, 435, BRIDGE_SIZE.width, BRIDGE_SIZE.height) };
export const apb = { y: 595, from: 70, to: VIEW.width - 70, label: 'APB' };

// Peripherals alternate between two rows. A neighbour's arrow then drops between two boxes
// of the other row, which is what lets 13 blocks fit on one bus.
const PERIPHERAL_SIZE = { width: 160, height: 72 };
const ROW_Y = [665, 790];
const FIRST_CX = 160;
const LAST_CX = VIEW.width - 160;

export type Peripheral = { slug: string; name: string; box: Box; row: number };

export const peripherals: Peripheral[] = ips.map((ip, i) => {
  const step = (LAST_CX - FIRST_CX) / Math.max(1, ips.length - 1);
  const row = i % 2;
  return { slug: ip.slug, name: ip.name, row, box: box(FIRST_CX + i * step, ROW_Y[row], PERIPHERAL_SIZE.width, PERIPHERAL_SIZE.height) };
});
