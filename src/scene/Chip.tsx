import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useContext, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { arrival, CYCLE } from '../diagram/flow';
import { clamp01, easeOutBack, easeOutCubic } from '../lib/motion';
import { perimeterPins, useInstanceMatrices } from './pins';
import { INTRO, SceneStateContext } from './state';
import { createChipLidTexture, createCircuitTexture, createShadowTexture } from './textures';
import { chip } from './world';

// An exploded view of the CPU package: substrate, interposer, and the heat-spreader lid floating above.
const SUBSTRATE = chip.size;
const SUBSTRATE_HEIGHT = 0.12;
const INTERPOSER = SUBSTRATE * 0.74;
const INTERPOSER_HEIGHT = 0.08;
const LID = SUBSTRATE * 0.62;
const LID_HEIGHT = 0.22;
const LID_GAP = 0.55;
const LID_REST = SUBSTRATE_HEIGHT + INTERPOSER_HEIGHT + LID_GAP + LID_HEIGHT / 2;

const PIN = new THREE.Color('#c9b48a');
const GOLD = new THREE.Color('#d9b86a');
const FLASH_SECONDS = 1.3;

// 1 at the instant of `at` (seconds into the loop), fading out: used for the launch and return glows.
function flare(time: number, at: number): number {
  const phase = (((time - at) % CYCLE) + CYCLE) % CYCLE;
  return phase < FLASH_SECONDS ? Math.exp(-phase * 3.4) * clamp01(phase / 0.07) : 0;
}

let shadowTexture: THREE.CanvasTexture | null = null;

export function Chip() {
  const world = useContext(SceneStateContext);
  const group = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const circuit = useRef<THREE.MeshStandardMaterial>(null);
  const underglow = useRef<THREE.PointLight>(null);
  const shadow = useRef<THREE.Mesh>(null);

  const circuitTexture = useMemo(() => createCircuitTexture(1024, 3, 34, 0.62), []);
  const lidTexture = useMemo(() => createChipLidTexture('CPU', 'AHB MASTER'), []);
  shadowTexture ??= createShadowTexture();

  const pins = useMemo(
    () => perimeterPins({ perSide: 44, span: SUBSTRATE - 0.28, edge: SUBSTRATE / 2 - 0.02, length: 0.13, width: 0.03, height: 0.03, y: 0.035 }),
    [],
  );
  const pads = useMemo(
    () => perimeterPins({ perSide: 26, span: INTERPOSER - 0.5, edge: INTERPOSER / 2 - 0.2, length: 0.07, width: 0.045, height: 0.02, y: SUBSTRATE_HEIGHT + INTERPOSER_HEIGHT + 0.01 }),
    [],
  );
  const pinRef = useInstanceMatrices(pins);
  const padRef = useInstanceMatrices(pads);

  useEffect(
    () => () => {
      circuitTexture.dispose();
      lidTexture.dispose();
    },
    [circuitTexture, lidTexture],
  );

  useFrame((state) => {
    const g = group.current;
    const l = lid.current;
    if (!g || !l) return;
    const t = world.intro;
    const entered = clamp01((t - INTRO.infra) / 0.9);
    g.visible = entered > 0;
    g.position.y = chip.base + (world.animate ? (1 - easeOutBack(entered)) * 2.4 : 0);

    // After the package lands, the lid lifts away from it: the exploded view assembles itself.
    const lift = world.animate ? easeOutCubic(clamp01((t - INTRO.infra - 0.7) / 1.3)) : 1;
    const bob = world.animate ? Math.sin(state.clock.elapsedTime * 0.9) * 0.05 : 0;
    l.position.y = SUBSTRATE_HEIGHT + INTERPOSER_HEIGHT + LID_HEIGHT / 2 + LID_GAP * lift + bob * lift;

    // The package lights as it sends a request and again as the last answer returns.
    const time = state.clock.elapsedTime;
    const glow = world.animate && t > INTRO.pulses ? Math.max(flare(time, arrival.cpuLaunch), flare(time, arrival.cpu)) : 0;
    if (circuit.current) circuit.current.emissiveIntensity = 3.2 + glow * 2.6;
    if (underglow.current) underglow.current.intensity = (7 + glow * 16) * lift;
    if (shadow.current) (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * entered;
  });

  return (
    <group position={[chip.cx, 0, chip.cz]}>
      <group ref={group} position-y={chip.base}>
        <mesh ref={shadow} rotation-x={-Math.PI / 2} position-y={0.004} scale={[SUBSTRATE * 1.5, SUBSTRATE * 1.5, 1]} raycast={() => null}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} opacity={0} toneMapped={false} />
        </mesh>

        <mesh position={[0, SUBSTRATE_HEIGHT / 2, 0]}>
          <boxGeometry args={[SUBSTRATE, SUBSTRATE_HEIGHT, SUBSTRATE]} />
          <meshStandardMaterial color="#0b0e14" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, SUBSTRATE_HEIGHT + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[SUBSTRATE - 0.04, SUBSTRATE - 0.04]} />
          <meshStandardMaterial ref={circuit} map={circuitTexture} emissiveMap={circuitTexture} emissive="#ffffff" emissiveIntensity={3.2} roughness={0.3} metalness={0.3} />
        </mesh>

        <instancedMesh ref={pinRef} args={[undefined, undefined, pins.length]}>
          <boxGeometry />
          <meshStandardMaterial color={PIN} metalness={1} roughness={0.28} />
        </instancedMesh>

        <mesh position={[0, SUBSTRATE_HEIGHT + INTERPOSER_HEIGHT / 2, 0]}>
          <boxGeometry args={[INTERPOSER, INTERPOSER_HEIGHT, INTERPOSER]} />
          <meshStandardMaterial color="#0f1217" metalness={0.6} roughness={0.35} />
        </mesh>
        <instancedMesh ref={padRef} args={[undefined, undefined, pads.length]}>
          <boxGeometry />
          <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} emissive="#ffc46b" emissiveIntensity={0.1} />
        </instancedMesh>

        {/* Blue under-glow in the gap between the interposer and the lid. */}
        <pointLight ref={underglow} position={[0, SUBSTRATE_HEIGHT + INTERPOSER_HEIGHT + LID_GAP / 2 + 0.05, 0]} color="#2f7bff" intensity={0} distance={5} decay={2} />

        <group ref={lid} position-y={LID_REST}>
          <RoundedBox args={[LID, LID_HEIGHT, LID]} radius={0.05} smoothness={4}>
            <meshPhysicalMaterial color="#262b33" metalness={0.6} roughness={0.38} clearcoat={0.45} clearcoatRoughness={0.3} />
          </RoundedBox>
          <mesh position={[0, LID_HEIGHT / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[LID - 0.1, LID - 0.1]} />
            <meshPhysicalMaterial map={lidTexture} metalness={0.5} roughness={0.45} clearcoat={0.35} clearcoatRoughness={0.4} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
