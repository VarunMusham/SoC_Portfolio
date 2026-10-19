import { createContext } from 'react';

// Mutable scene state, updated once per frame by the scene root and read by every part in its own
// frame callback. A ref-like object, so hovering or advancing the intro never re-renders React.
export type SceneState = {
  /** Seconds since the intro began; large once it is skipped or finished. */
  intro: number;
  /** Peripheral under the pointer or previewed from the list. */
  hot: string | null;
  /** Peripheral the camera is on (or flying to). */
  focus: string | null;
  /** False under Reduce Motion: no lift, no flashes, no travelling light. */
  animate: boolean;
};

export const SceneStateContext = createContext<SceneState>({ intro: 999, hot: null, focus: null, animate: true });

// When each part of the intro starts, in seconds.
export const INTRO = {
  tiers: 0.1,
  wires: 0.8,
  infra: 1.0,
  peripherals: 1.25,
  step: 0.065,
  pulses: 3.2,
  camera: 2.9,
};
