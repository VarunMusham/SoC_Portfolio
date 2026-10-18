import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';
import * as THREE from 'three';
import { ips } from '../data/ips';
import { easeInOutCubic, prefersReducedMotion } from '../lib/motion';
import { Board } from './Board';
import { IpChip } from './IpChip';
import { MainChip } from './MainChip';
import { Streaks } from './Streaks';
import { blockPosition, palette } from './layout';
import { createCircuitTexture } from './textures';

export type Origin = { x: number; y: number };

type Quality = 'high' | 'low';

type SceneProps = {
  /** Chip the camera should be on; null means the overview. */
  focusSlug: string | null;
  /** Chip highlighted from the legend, without zooming. */
  previewSlug: string | null;
  /** False while the docs fully cover the scene: rendering pauses and camera moves happen instantly. */
  active: boolean;
  labelRoot: RefObject<HTMLElement | null>;
  onSelect: (slug: string) => void;
  onArrive: (slug: string, origin: Origin) => void;
};

type Pose = { pos: THREE.Vector3; look: THREE.Vector3 };

type Tween = {
  startedAt: number;
  duration: number;
  fromPos: THREE.Vector3;
  control: THREE.Vector3;
  toPos: THREE.Vector3;
  fromLook: THREE.Vector3;
  toLook: THREE.Vector3;
  fromFov: number;
  toFov: number;
  onDone?: () => void;
};

const OVERVIEW_FOV = 36;
const FOCUS_FOV = 28;
const ZOOM_MS = 1400;
const RETURN_MS = 1500;
const ROTATION_SPEED = 0.06;
// How high the camera rises mid-flight, so the move arcs over the board instead of skimming it.
const ARC_LIFT = 3.5;
const NO_HOVER = -10;

// The SoC sits centred in the view. The layout targets laptop-sized landscape screens only.
const OVERVIEW: Pose = { pos: new THREE.Vector3(0, 8, 14.5), look: new THREE.Vector3(0, -0.6, 0) };

// Where the camera should sit to look at a chip, using the board's current spin.
function focusPose(group: THREE.Group, index: number): Pose {
  const world = group.localToWorld(blockPosition(index).setY(0.4));
  const outward = new THREE.Vector3(world.x, 0, world.z).normalize();
  const pos = world.clone().addScaledVector(outward, 3.4).add(new THREE.Vector3(0, 1.9, 0));
  return { pos, look: world };
}

// Projects a world point to viewport pixels, so the docs reveal can start from the clicked chip.
function screenPoint(camera: THREE.PerspectiveCamera, dom: HTMLCanvasElement, point: THREE.Vector3): Origin {
  const projected = point.clone().project(camera);
  const rect = dom.getBoundingClientRect();
  return {
    x: rect.left + ((projected.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - projected.y) / 2) * rect.height,
  };
}

function makeTween(
  camera: THREE.PerspectiveCamera,
  currentLook: THREE.Vector3,
  to: Pose,
  toFov: number,
  duration: number,
  onDone?: () => void,
): Tween {
  const fromPos = camera.position.clone();
  const control = fromPos.clone().lerp(to.pos, 0.5).add(new THREE.Vector3(0, ARC_LIFT, 0));
  return {
    startedAt: performance.now(),
    duration,
    fromPos,
    control,
    toPos: to.pos,
    fromLook: currentLook.clone(),
    toLook: to.look,
    fromFov: camera.fov,
    toFov,
    onDone,
  };
}

function Scene({
  focusSlug,
  previewSlug,
  active,
  labelRoot,
  onSelect,
  onArrive,
  quality,
}: SceneProps & { quality: Quality }) {
  // The label root is mounted before the scene renders, so it is never null here.
  const portal = labelRoot as RefObject<HTMLElement>;
  const { camera, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const [reduced] = useState(prefersReducedMotion);

  const groupRef = useRef<THREE.Group>(null);
  const dofRef = useRef<DepthOfFieldEffect>(null);
  const tweenRef = useRef<Tween | null>(null);
  const lookRef = useRef(OVERVIEW.look.clone());
  const hoverRef = useRef(NO_HOVER);
  const previewRef = useRef(NO_HOVER);
  // The chip whose bus glows: pointer hover wins over a legend preview.
  const hotRef = useRef(NO_HOVER);
  const zoomedRef = useRef(false);
  const previewIndex = ips.findIndex((ip) => ip.slug === previewSlug);
  const footprint = useMemo(() => createCircuitTexture(512, 17, 14, 0.68), []);

  useEffect(() => () => footprint.dispose(), [footprint]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  const handleHover = useCallback((index: number | null) => {
    hoverRef.current = index ?? NO_HOVER;
  }, []);

  useEffect(() => {
    previewRef.current = previewIndex >= 0 ? previewIndex : NO_HOVER;
  }, [previewIndex]);

  // Start on the overview. Focus changes after mount move the camera from there.
  useLayoutEffect(() => {
    if (tweenRef.current || zoomedRef.current) return;
    cam.position.copy(OVERVIEW.pos);
    lookRef.current.copy(OVERVIEW.look);
    cam.fov = OVERVIEW_FOV;
    cam.updateProjectionMatrix();
  }, [cam]);

  // Read through refs so toggling them does not restart a camera move.
  const activeRef = useRef(active);
  const arriveRef = useRef(onArrive);
  useEffect(() => {
    activeRef.current = active;
    arriveRef.current = onArrive;
  }, [active, onArrive]);

  // Move the camera whenever the focused chip changes: fly in, fly back out, or (while covered) jump.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const index = ips.findIndex((ip) => ip.slug === focusSlug);

    if (index < 0) {
      if (!zoomedRef.current) return;
      tweenRef.current = makeTween(cam, lookRef.current, OVERVIEW, OVERVIEW_FOV, reduced ? 250 : RETURN_MS, () => {
        zoomedRef.current = false;
      });
      return;
    }

    const slug = ips[index].slug;
    const pose = focusPose(group, index);
    zoomedRef.current = true;

    if (!activeRef.current) {
      tweenRef.current = null;
      cam.position.copy(pose.pos);
      cam.fov = FOCUS_FOV;
      cam.updateProjectionMatrix();
      lookRef.current.copy(pose.look);
      return;
    }

    // The reveal origin is measured on arrival, where the chip actually sits on screen.
    tweenRef.current = makeTween(cam, lookRef.current, pose, reduced ? cam.fov : FOCUS_FOV, reduced ? 250 : ZOOM_MS, () =>
      arriveRef.current(slug, screenPoint(cam, gl.domElement, pose.look)),
    );
  }, [focusSlug, cam, gl, reduced]);

  // Priority -1 runs before the labels' own frame callbacks, so they always track this frame's spin.
  useFrame((_, delta) => {
    const tween = tweenRef.current;
    if (tween) {
      const raw = Math.min(1, (performance.now() - tween.startedAt) / tween.duration);
      const eased = easeInOutCubic(raw);
      // Quadratic Bezier through the lifted control point.
      const inv = 1 - eased;
      cam.position
        .copy(tween.fromPos)
        .multiplyScalar(inv * inv)
        .addScaledVector(tween.control, 2 * inv * eased)
        .addScaledVector(tween.toPos, eased * eased);
      lookRef.current.lerpVectors(tween.fromLook, tween.toLook, eased);
      cam.fov = THREE.MathUtils.lerp(tween.fromFov, tween.toFov, eased);
      cam.updateProjectionMatrix();
    }
    cam.lookAt(lookRef.current);
    dofRef.current?.target?.copy(lookRef.current);

    // Finish after aiming, so callbacks that project points see this frame's camera.
    if (tween && performance.now() - tween.startedAt >= tween.duration) {
      tweenRef.current = null;
      cam.updateMatrixWorld();
      tween.onDone?.();
    }

    hotRef.current = hoverRef.current !== NO_HOVER ? hoverRef.current : previewRef.current;
    const group = groupRef.current;
    const paused = tween !== null || hotRef.current !== NO_HOVER || zoomedRef.current;
    // Clamped so a stalled frame (background tab, shader compile) does not jump the board.
    if (group && !paused && !reduced) group.rotation.y += Math.min(delta, 0.1) * ROTATION_SPEED;
  }, -1);

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fogExp2 attach="fog" args={['#08101d', 0.024]} />

      <ambientLight intensity={0.5} color="#a9bde3" />
      {/* Soft sky-to-ground fill, so the board and components read in the shadows. */}
      <hemisphereLight args={["#8fb0ff", "#141c33", 0.5]} />
      <directionalLight
        position={[-7, 12, 6]}
        intensity={3.1}
        color="#eaf0ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[8, 3, -6]} intensity={3} color="#4a78ff" />

      {/* Studio reflections for the metal parts, generated locally rather than loaded from a CDN. */}
      <Environment resolution={256} frames={1} environmentIntensity={1.8}>
        <Lightformer form="rect" intensity={3} color="#d6e1ff" position={[0, 9, -3]} rotation-x={Math.PI / 2} scale={[20, 7, 1]} />
        <Lightformer form="rect" intensity={6} color="#2f6bff" position={[-12, 2, 2]} rotation-y={Math.PI / 2} scale={[12, 2, 1]} />
        <Lightformer form="rect" intensity={3} color="#ffd6a6" position={[12, 3, 5]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#8fb0ff" position={[0, 4, 12]} scale={[18, 3, 1]} />
      </Environment>

      <group ref={groupRef}>
        <Board />
        <Streaks hotRef={hotRef} animate={!reduced} />
        <MainChip animate={!reduced} />
        {ips.map((ip, i) => (
          <IpChip
            key={ip.slug}
            index={i}
            slug={ip.slug}
            name={ip.name}
            version={ip.version}
            locked={focusSlug !== null}
            previewed={i === previewIndex}
            footprint={footprint}
            labelRoot={portal}
            onHover={handleHover}
            onPick={onSelect}
          />
        ))}
      </group>

      <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
        {quality === 'high' && <DepthOfField ref={dofRef} target={[0, 0, 0]} worldFocusRange={18} bokehScale={2.2} />}
        <Bloom mipmapBlur luminanceThreshold={0.45} luminanceSmoothing={0.25} intensity={1.4} radius={0.72} />
        <Noise premultiply opacity={0.2} />
        <Vignette offset={0.3} darkness={0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}

// `?quality=high` or `?quality=low` pins the render quality; otherwise it adapts to the frame rate.
function qualityOverride(): Quality | null {
  const value = new URLSearchParams(window.location.search).get('quality');
  return value === 'high' || value === 'low' ? value : null;
}

// Labels are portalled into `labelRoot`, a div owned by React, so they unmount cleanly with the page.
export default function SocScene(props: SceneProps) {
  const [override] = useState(qualityOverride);
  const [quality, setQuality] = useState<Quality>(override ?? 'high');

  return (
    <Canvas
      shadows
      frameloop={props.active ? 'always' : 'never'}
      dpr={quality === 'high' ? [1, 1.75] : 1}
      camera={{ position: [0, 7.4, 14], fov: OVERVIEW_FOV, near: 0.1, far: 120 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      {!override && <PerformanceMonitor flipflops={2} onDecline={() => setQuality('low')} />}
      <Scene {...props} quality={quality} />
    </Canvas>
  );
}
