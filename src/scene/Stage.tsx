import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clamp01, easeOutCubic } from '../lib/motion';
import { SceneStateContext, INTRO } from './state';
import { createBoardTexture, createLabelTexture, createSlabTexture, mulberry32 } from './textures';
import { rails, slabs, type Slab } from './world';

const BOARD_SIZE = 90;

// The board stretches well past the tiers, so the camera never sees its edge.
function Board() {
  const texture = useMemo(() => createBoardTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.001}>
      <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
      <meshStandardMaterial map={texture} color="#9aa7bd" roughness={0.5} metalness={0.5} />
    </mesh>
  );
}

const GREEBLES = 420;
const LEDS = 90;
// The area the tiers occupy, kept clear of clutter.
const KEEP_OUT = { x: 8.6, zMin: -4.8, zMax: 5.2 };

// Small dark components scattered around the tiers, for depth and a sense of scale.
function Surroundings() {
  const body = useRef<THREE.InstancedMesh>(null);
  const leds = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = body.current;
    const ledMesh = leds.current;
    if (!mesh || !ledMesh) return;
    const rand = mulberry32(7);
    const m = new THREE.Matrix4();
    const colour = new THREE.Color();
    const tops: THREE.Vector3[] = [];
    let placed = 0;
    let guard = 0;
    while (placed < GREEBLES && guard++ < GREEBLES * 20) {
      const x = (rand() - 0.5) * 46;
      const z = (rand() - 0.5) * 34;
      if (Math.abs(x) < KEEP_OUT.x && z > KEEP_OUT.zMin && z < KEEP_OUT.zMax) continue;
      const w = 0.3 + rand() * 1.0;
      const d = 0.3 + rand() * 0.9;
      const h = 0.04 + Math.pow(rand(), 2.6) * 0.55;
      m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      mesh.setMatrixAt(placed, m);
      colour.setHSL(0.6, 0.3, 0.025 + rand() * 0.035);
      mesh.setColorAt(placed, colour);
      tops.push(new THREE.Vector3(x + (rand() - 0.5) * w * 0.6, h + 0.012, z + (rand() - 0.5) * d * 0.6));
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    ledMesh.count = Math.min(LEDS, tops.length);
    for (let i = 0; i < ledMesh.count; i++) {
      m.compose(tops[Math.floor(rand() * tops.length)], new THREE.Quaternion(), new THREE.Vector3(0.07, 0.02, 0.07));
      ledMesh.setMatrixAt(i, m);
      colour.set(rand() > 0.82 ? '#ffb454' : '#5aaeff');
      ledMesh.setColorAt(i, colour);
    }
    ledMesh.instanceMatrix.needsUpdate = true;
    if (ledMesh.instanceColor) ledMesh.instanceColor.needsUpdate = true;
  }, []);

  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, GREEBLES]}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.6} metalness={0.45} />
      </instancedMesh>
      <instancedMesh ref={leds} args={[undefined, undefined, LEDS]}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} color="#ffffff" />
      </instancedMesh>
    </>
  );
}

// One tier: a slab of dark glass with a lit top and a glowing front edge.
function TierSlab({ slab, index }: { slab: Slab; index: number }) {
  const world = useContext(SceneStateContext);
  const group = useRef<THREE.Group>(null);
  const top = useMemo(() => createSlabTexture(slab.width, slab.depth), [slab]);
  useEffect(() => () => top.dispose(), [top]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const q = clamp01((world.intro - INTRO.tiers - index * 0.2) / 1.1);
    g.position.y = world.animate ? -(1 - easeOutCubic(q)) * 1.2 : 0;
    g.visible = q > 0;
  });

  const front = slab.cz + slab.depth / 2;
  return (
    <group ref={group}>
      <RoundedBox args={[slab.width, slab.top, slab.depth]} radius={0.1} smoothness={4} position={[slab.cx, slab.top / 2, slab.cz]}>
        <meshPhysicalMaterial color="#18202b" roughness={0.3} metalness={0.7} clearcoat={1} clearcoatRoughness={0.25} />
      </RoundedBox>
      <mesh rotation-x={-Math.PI / 2} position={[slab.cx, slab.top + 0.002, slab.cz]}>
        <planeGeometry args={[slab.width, slab.depth]} />
        <meshBasicMaterial map={top} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* The lit lip along the front edge: this is what makes the step between tiers visible. */}
      <mesh position={[slab.cx, slab.top - 0.02, front - 0.012]}>
        <boxGeometry args={[slab.width - 0.3, 0.025, 0.025]} />
        <meshBasicMaterial color="#3a8dff" toneMapped={false} />
      </mesh>
    </group>
  );
}

// The two buses as raised rails with a fine lit line along the top, and a label at the end.
function Rails() {
  const world = useContext(SceneStateContext);
  const group = useRef<THREE.Group>(null);
  const labels = useMemo(() => rails.map((r) => createLabelTexture(r.label, { color: '#8a95a6', spacing: 0.1, height: 128 })), []);
  useEffect(() => () => labels.forEach((t) => t.dispose()), [labels]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const q = clamp01((world.intro - INTRO.wires) / 0.9);
    g.scale.y = world.animate ? Math.max(0.001, easeOutCubic(q)) : 1;
    g.visible = q > 0;
  });

  return (
    <group ref={group}>
      {rails.map((rail, i) => {
        const length = rail.x2 - rail.x1;
        const topY = rail.y + 0.05;
        const floor = rail.id === 'ahb' ? slabs[0].top : slabs[1].top;
        return (
          <group key={rail.id}>
            <mesh position={[(rail.x1 + rail.x2) / 2, rail.y, rail.z]}>
              <boxGeometry args={[length, 0.1, 0.14]} />
              <meshStandardMaterial color="#2b3441" metalness={0.8} roughness={0.32} />
            </mesh>
            <mesh position={[(rail.x1 + rail.x2) / 2, topY + 0.004, rail.z]}>
              <boxGeometry args={[length - 0.1, 0.008, 0.03]} />
              <meshBasicMaterial color="#2f7be6" toneMapped={false} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position={[rail.x2 - 0.45, floor + 0.004, rail.z - 0.3]}>
              <planeGeometry args={[0.8, 0.2]} />
              <meshBasicMaterial map={labels[i]} transparent depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function Stage() {
  return (
    <>
      <Board />
      <Surroundings />
      {slabs.map((slab, i) => (
        <TierSlab key={slab.id} slab={slab} index={i} />
      ))}
      <Rails />
    </>
  );
}
