import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { MAIN_CHIP, palette } from './layout';
import { perimeterPins, useInstanceMatrices } from './pins';
import { createCircuitTexture, createMainLidTexture } from './textures';

const { substrate, substrateHeight, interposer, interposerHeight, lid, lidHeight, lidGap } = MAIN_CHIP;
const LID_Y = substrateHeight + interposerHeight + lidGap + lidHeight / 2;

// Exploded view of the SoC package: substrate, interposer, and the heat-spreader lid floating above.
export function MainChip({ animate }: { animate: boolean }) {
  const lidRef = useRef<THREE.Group>(null);
  const circuit = useMemo(() => createCircuitTexture(1024, 3, 40, 0.66), []);
  const lidTexture = useMemo(() => createMainLidTexture(), []);

  const pins = useMemo(
    () =>
      perimeterPins({
        perSide: 64,
        span: substrate - 0.3,
        edge: substrate / 2 - 0.02,
        length: 0.14,
        width: 0.032,
        height: 0.035,
        y: 0.04,
      }),
    [],
  );
  const pads = useMemo(
    () =>
      perimeterPins({
        perSide: 30,
        span: interposer - 0.55,
        edge: interposer / 2 - 0.24,
        length: 0.07,
        width: 0.05,
        height: 0.02,
        y: substrateHeight + interposerHeight + 0.01,
      }),
    [],
  );
  const pinRef = useInstanceMatrices(pins);
  const padRef = useInstanceMatrices(pads);

  useEffect(
    () => () => {
      circuit.dispose();
      lidTexture.dispose();
    },
    [circuit, lidTexture],
  );

  useFrame(({ clock }) => {
    if (lidRef.current && animate) {
      lidRef.current.position.y = LID_Y + Math.sin(clock.elapsedTime * 0.9) * 0.06;
    }
  });

  return (
    <group>
      <mesh position={[0, substrateHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[substrate, substrateHeight, substrate]} />
        <meshStandardMaterial color="#0b0e14" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, substrateHeight + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[substrate - 0.04, substrate - 0.04]} />
        <meshStandardMaterial
          map={circuit}
          emissiveMap={circuit}
          emissive="#ffffff"
          emissiveIntensity={3.4}
          roughness={0.3}
          metalness={0.3}
        />
      </mesh>

      <instancedMesh ref={pinRef} args={[undefined, undefined, pins.length]} castShadow>
        <boxGeometry />
        <meshStandardMaterial color={palette.pin} metalness={1} roughness={0.28} />
      </instancedMesh>

      <mesh position={[0, substrateHeight + interposerHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[interposer, interposerHeight, interposer]} />
        <meshStandardMaterial color="#0f1217" metalness={0.6} roughness={0.35} />
      </mesh>

      <instancedMesh ref={padRef} args={[undefined, undefined, pads.length]}>
        <boxGeometry />
        <meshStandardMaterial
          color={palette.gold}
          metalness={1}
          roughness={0.25}
          emissive="#ffc46b"
          emissiveIntensity={0.08}
        />
      </instancedMesh>

      {/* Blue under-glow in the gap between interposer and lid. */}
      <pointLight
        position={[0, substrateHeight + interposerHeight + lidGap / 2, 0]}
        color="#2f7bff"
        intensity={9}
        distance={4.5}
        decay={2}
      />

      <group ref={lidRef} position={[0, LID_Y, 0]}>
        <RoundedBox args={[lid, lidHeight, lid]} radius={0.05} smoothness={4} castShadow receiveShadow>
          <meshPhysicalMaterial color="#23272e" metalness={0.55} roughness={0.4} clearcoat={0.4} clearcoatRoughness={0.35} />
        </RoundedBox>
        <mesh position={[0, lidHeight / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[lid - 0.1, lid - 0.1]} />
          <meshPhysicalMaterial map={lidTexture} metalness={0.5} roughness={0.45} clearcoat={0.35} clearcoatRoughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
