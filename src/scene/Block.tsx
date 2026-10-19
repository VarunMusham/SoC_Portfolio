import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useContext, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CYCLE } from '../diagram/flow';
import { clamp01, easeOutBack } from '../lib/motion';
import { INTRO, SceneStateContext } from './state';
import { createLabelTexture, createShadowTexture } from './textures';
import type { BlockSpec } from './world';

const COLOUR = {
  ip: new THREE.Color('#252d3a'),
  infra: new THREE.Color('#303b4a'),
  hot: new THREE.Color('#0a84ff'),
  glow: new THREE.Color('#3d9bff'),
};

// Lift is a damped spring: stiff enough to feel quick, loose enough to overshoot a little.
const STIFFNESS = 170;
const DAMPING = 13;
const LIFT_HEIGHT = 0.34;
const FLASH_SECONDS = 1.4;

let shadowTexture: THREE.CanvasTexture | null = null;

type BlockProps = {
  spec: BlockSpec;
  /** Seconds into the traffic loop at which the wave of light reaches this block. */
  flashAt: number;
  /** Position in the intro: blocks drop in one after another. */
  order: number;
  locked: boolean;
  onHover?: (slug: string | null) => void;
  onPick?: (slug: string) => void;
};

export function Block({ spec, flashAt, order, locked, onHover, onPick }: BlockProps) {
  const world = useContext(SceneStateContext);
  const lift = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshPhysicalMaterial>(null);
  const motion = useRef({ lift: 0, velocity: 0, hot: 0, dim: 0 });
  const interactive = spec.slug !== undefined;
  const base = spec.kind === 'ip' ? COLOUR.ip : COLOUR.infra;

  const label = useMemo(
    () => createLabelTexture(spec.label, { color: interactive ? '#f5f7fa' : '#aeb8c7', spacing: -0.01 }),
    [spec.label, interactive],
  );
  useEffect(() => () => label.dispose(), [label]);
  shadowTexture ??= createShadowTexture();

  const labelWidth = spec.width * 0.9;
  const labelHeight = Math.min(labelWidth * (192 / 512), spec.depth * 0.8);
  const delay = (spec.kind === 'ip' ? INTRO.peripherals : INTRO.infra) + order * INTRO.step;

  useFrame((state, delta) => {
    const group = lift.current;
    const mat = material.current;
    if (!group || !mat) return;
    const dt = Math.min(delta, 1 / 30);

    const entered = clamp01((world.intro - delay) / 0.9);
    group.visible = entered > 0;
    const drop = world.animate ? (1 - easeOutBack(entered)) * 2.4 : 0;

    const hot = interactive && (world.hot === spec.slug || world.focus === spec.slug);
    const dimmed = interactive && !hot && world.hot !== null && world.focus === null;
    const m = motion.current;
    m.velocity += (STIFFNESS * ((hot ? 1 : 0) - m.lift) - DAMPING * m.velocity) * dt;
    m.lift += m.velocity * dt;
    m.hot += ((hot ? 1 : 0) - m.hot) * Math.min(1, dt * 10);
    m.dim += ((dimmed ? 1 : 0) - m.dim) * Math.min(1, dt * 8);

    const raised = world.animate ? m.lift : 0;
    group.position.y = drop + raised * LIFT_HEIGHT;
    group.scale.setScalar(1 + raised * 0.045);

    // Where the wave of light lands, the block briefly glows.
    let flash = 0;
    if (world.animate && world.intro > INTRO.pulses) {
      const phase = (((state.clock.elapsedTime - flashAt) % CYCLE) + CYCLE) % CYCLE;
      if (phase < FLASH_SECONDS) flash = Math.exp(-phase * 3.2) * clamp01(phase / 0.07);
    }

    mat.color.copy(base).lerp(COLOUR.hot, m.hot).multiplyScalar(1 - m.dim * 0.4);
    mat.emissive.copy(COLOUR.glow);
    mat.emissiveIntensity = m.hot * 0.55 + flash * 0.42;

    const sh = shadow.current;
    if (sh) {
      const spread = 1 + raised * 0.18;
      sh.scale.set(spec.width * 1.55 * spread, spec.depth * 1.9 * spread, 1);
      (sh.material as THREE.MeshBasicMaterial).opacity = (0.55 + m.hot * 0.3) * (1 - m.dim * 0.25) * entered;
    }
  });

  const handlers = interactive
    ? {
        onPointerOver: (e: { stopPropagation: () => void }) => {
          if (locked) return;
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          onHover?.(spec.slug!);
        },
        onPointerOut: () => {
          document.body.style.cursor = '';
          onHover?.(null);
        },
        onClick: (e: { stopPropagation: () => void }) => {
          if (locked) return;
          e.stopPropagation();
          onPick?.(spec.slug!);
        },
      }
    : {};

  return (
    <group position={[spec.cx, spec.base, spec.cz]}>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position-y={0.004} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} opacity={0} toneMapped={false} />
      </mesh>
      <group ref={lift} {...handlers}>
        <RoundedBox args={[spec.width, spec.height, spec.depth]} radius={0.11} smoothness={4} position-y={spec.height / 2}>
          <meshPhysicalMaterial ref={material} color={base} roughness={0.32} metalness={0.55} clearcoat={1} clearcoatRoughness={0.2} />
        </RoundedBox>
        <mesh rotation-x={-Math.PI / 2} position-y={spec.height + 0.004}>
          <planeGeometry args={[labelWidth, labelHeight]} />
          <meshBasicMaterial map={label} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
