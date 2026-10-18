import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { IP_CHIP, blockPosition, chipAngle } from './layout';
import { perimeterPins, useInstanceMatrices } from './pins';
import { createIpLidTextures } from './textures';

const { pad, body, bodyHeight, standoff, pinLength, pinsPerSide } = IP_CHIP;
const PAD_TOP = 0.04;
const BODY_Y = PAD_TOP + standoff + bodyHeight / 2;
const LIFT = 0.3;

type IpChipProps = {
  index: number;
  slug: string;
  name: string;
  version: string;
  locked: boolean;
  /** Highlighted from outside the scene, e.g. by hovering its legend button. */
  previewed: boolean;
  footprint: THREE.Texture;
  labelRoot: RefObject<HTMLElement>;
  onHover: (index: number | null) => void;
  onPick: (slug: string) => void;
};

// A QFP-style package for one IP block. It lifts and glows when hovered or previewed.
export function IpChip({ index, slug, name, version, locked, previewed, footprint, labelRoot, onHover, onPick }: IpChipProps) {
  const [hovered, setHovered] = useState(false);
  const active = hovered || previewed;
  const liftRef = useRef<THREE.Group>(null);
  const footprintMat = useRef<THREE.MeshStandardMaterial>(null);
  const lidMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const position = useMemo(() => blockPosition(index), [index]);
  const lidTextures = useMemo(() => createIpLidTextures(name, version), [name, version]);

  const pins = useMemo(
    () =>
      perimeterPins({
        perSide: pinsPerSide,
        span: body - 0.3,
        edge: body / 2 - 0.02,
        length: pinLength,
        width: 0.06,
        height: 0.035,
        y: PAD_TOP + standoff + 0.05,
      }),
    [],
  );
  const pinRef = useInstanceMatrices(pins);

  useEffect(
    () => () => {
      lidTextures.map.dispose();
      lidTextures.glowMap.dispose();
    },
    [lidTextures],
  );

  useFrame((_, delta) => {
    const damp = THREE.MathUtils.damp;
    if (liftRef.current) liftRef.current.position.y = damp(liftRef.current.position.y, active ? LIFT : 0, 7, delta);
    if (footprintMat.current) {
      footprintMat.current.emissiveIntensity = damp(footprintMat.current.emissiveIntensity, active ? 4 : 1.8, 7, delta);
    }
    if (lidMat.current) lidMat.current.emissiveIntensity = damp(lidMat.current.emissiveIntensity, active ? 2 : 0, 7, delta);
  });

  const enter = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    onHover(index);
    document.body.style.cursor = locked ? '' : 'pointer';
  };

  const leave = () => {
    setHovered(false);
    onHover(null);
    document.body.style.cursor = '';
  };

  return (
    <group position={position} rotation={[0, chipAngle(index), 0]}>
      <mesh position={[0, PAD_TOP / 2, 0]} receiveShadow>
        <boxGeometry args={[pad, PAD_TOP, pad]} />
        <meshStandardMaterial color="#0a0d13" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, PAD_TOP + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[pad - 0.03, pad - 0.03]} />
        <meshStandardMaterial
          ref={footprintMat}
          map={footprint}
          emissiveMap={footprint}
          emissive="#ffffff"
          emissiveIntensity={1.8}
          roughness={0.35}
          metalness={0.3}
        />
      </mesh>

      <group ref={liftRef}>
        <RoundedBox
          args={[body, bodyHeight, body]}
          radius={0.035}
          smoothness={3}
          position={[0, BODY_Y, 0]}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial color="#1b1e23" metalness={0.35} roughness={0.5} clearcoat={0.3} clearcoatRoughness={0.5} />
        </RoundedBox>
        <mesh position={[0, BODY_Y + bodyHeight / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[body - 0.07, body - 0.07]} />
          <meshPhysicalMaterial
            ref={lidMat}
            map={lidTextures.map}
            emissiveMap={lidTextures.glowMap}
            emissive="#4d9bff"
            emissiveIntensity={0}
            metalness={0.35}
            roughness={0.5}
            clearcoat={0.3}
          />
        </mesh>
        <instancedMesh ref={pinRef} args={[undefined, undefined, pins.length]} castShadow>
          <boxGeometry />
          <meshStandardMaterial color="#b9bec6" metalness={1} roughness={0.3} />
        </instancedMesh>
      </group>

      {/* Invisible hit target covering the footprint and the lifted package. */}
      <mesh
        position={[0, 0.45, 0]}
        onPointerOver={enter}
        onPointerOut={leave}
        onClick={(event) => {
          event.stopPropagation();
          if (!locked) onPick(slug);
        }}
      >
        <boxGeometry args={[pad, 0.9, pad]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <Html position={[0, 1.45, 0]} center pointerEvents="none" portal={labelRoot}>
        <span className={active ? 'chip-callout is-hot' : 'chip-callout'}>{name}</span>
      </Html>
    </group>
  );
}
