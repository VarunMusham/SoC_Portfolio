import { useFrame } from '@react-three/fiber';
import { useContext, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clamp01, easeOutCubic } from '../lib/motion';
import { INTRO, SceneStateContext } from './state';
import { createConduitGeometry, createPulseGeometry, createPulseMaterial, createRouteGeometry, createRouteMaterial } from './wires';
import { ipBlocks } from './world';

// The conduits between blocks, the light travelling along them, and the route lit up on hover.
export function Wires() {
  const world = useContext(SceneStateContext);
  const group = useRef<THREE.Group>(null);
  const route = useRef({ mix: 0, id: -1 });

  const conduits = useMemo(() => createConduitGeometry(), []);
  const pulses = useMemo(() => createPulseGeometry(), []);
  const routes = useMemo(() => createRouteGeometry(), []);
  const pulseMaterial = useMemo(() => createPulseMaterial(), []);
  const routeMaterial = useMemo(() => createRouteMaterial(), []);

  useEffect(
    () => () => {
      [conduits, pulses, routes, pulseMaterial, routeMaterial].forEach((resource) => resource.dispose());
    },
    [conduits, pulses, routes, pulseMaterial, routeMaterial],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;

    const q = clamp01((world.intro - INTRO.wires) / 0.9);
    g.scale.y = world.animate ? Math.max(0.001, easeOutCubic(q)) : 1;
    g.visible = q > 0;

    pulseMaterial.uniforms.uTime.value = time;
    pulseMaterial.uniforms.uFade.value = world.animate ? clamp01((world.intro - INTRO.pulses) / 0.8) : 0;

    // The route fades out on its own index after the pointer leaves, so it never snaps off.
    const target = world.hot ?? world.focus;
    const index = ipBlocks.findIndex((b) => b.slug === target);
    const r = route.current;
    if (index >= 0) r.id = index;
    r.mix += ((index >= 0 ? 1 : 0) - r.mix) * Math.min(1, dt * 9);
    routeMaterial.uniforms.uHot.value = r.id;
    routeMaterial.uniforms.uMix.value = r.mix;
    routeMaterial.uniforms.uTime.value = world.animate ? time : 0;
  });

  return (
    <group ref={group}>
      <mesh geometry={conduits}>
        <meshStandardMaterial color="#2a3340" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh geometry={pulses} material={pulseMaterial} renderOrder={2} frustumCulled={false} />
      <mesh geometry={routes} material={routeMaterial} renderOrder={3} frustumCulled={false} />
    </group>
  );
}
