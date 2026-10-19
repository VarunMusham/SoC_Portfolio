import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { arrival } from '../diagram/flow';
import { clamp01, easeInOutCubic, easeOutCubic, prefersReducedMotion } from '../lib/motion';
import { publishBlockOrigin } from '../lib/origin';
import { Block } from './Block';
import { Stage } from './Stage';
import { INTRO, SceneStateContext, type SceneState } from './state';
import { Wires } from './Wires';
import { blocks, ipBlocks, type BlockSpec } from './world';

export type Origin = { x: number; y: number };

type Quality = 'high' | 'low';

type SceneProps = {
  /** Peripheral the camera should be on; null means the overview. */
  focusSlug: string | null;
  /** Peripheral highlighted from the list, without zooming. */
  previewSlug: string | null;
  /** False while the docs fully cover the scene: rendering pauses and camera moves happen instantly. */
  active: boolean;
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

const OVERVIEW_FOV = 32;
const FOCUS_FOV = 27;
const ZOOM_MS = 1500;
const RETURN_MS = 1600;
// How high the camera rises mid-flight, so the move arcs over the board instead of skimming it.
const ARC_LIFT = 3;
// How far the pointer can swing the camera, in world units.
const PARALLAX = { x: 0.9, y: 0.4 };

const OVERVIEW: Pose = { pos: new THREE.Vector3(0, 11.2, 17.0), look: new THREE.Vector3(0, 0, 0.45) };
// The intro starts high and far and settles into the overview.
const INTRO_POSE: Pose = { pos: new THREE.Vector3(0, 22, 31), look: new THREE.Vector3(0, 0, 0) };

// Where the camera should sit to look at a block: in front of it and above, so the label reads.
function focusPose(spec: BlockSpec): Pose {
  const top = spec.base + spec.height;
  return {
    pos: new THREE.Vector3(spec.cx * 0.6, top + 2.1, spec.cz + 3.4),
    look: new THREE.Vector3(spec.cx, top, spec.cz),
  };
}

// Projects a world point to viewport pixels, so the docs reveal can start from the clicked block.
function screenPoint(camera: THREE.PerspectiveCamera, dom: HTMLCanvasElement, point: THREE.Vector3): Origin {
  const projected = point.clone().project(camera);
  const rect = dom.getBoundingClientRect();
  return {
    x: rect.left + ((projected.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - projected.y) / 2) * rect.height,
  };
}

function makeTween(camera: THREE.PerspectiveCamera, currentLook: THREE.Vector3, to: Pose, toFov: number, duration: number, onDone?: () => void): Tween {
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

const ipSpec = (slug: string | null) => ipBlocks.find((b) => b.slug === slug);

function Scene({ focusSlug, previewSlug, active, onSelect, onArrive, quality }: SceneProps & { quality: Quality }) {
  const { camera, gl, pointer } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const [reduced] = useState(prefersReducedMotion);

  const dofRef = useRef<DepthOfFieldEffect>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const tweenRef = useRef<Tween | null>(null);
  const lookRef = useRef(OVERVIEW.look.clone());
  const hoverRef = useRef<string | null>(null);
  const previewRef = useRef<string | null>(previewSlug);
  const zoomedRef = useRef(false);
  const publishedRef = useRef(false);
  const parallax = useRef({ mix: 0, x: 0, y: 0 });
  // A deep link or Reduce Motion skips the intro: the scene appears as it will rest.
  const [hold] = useState(introHold);
  const [skipIntro] = useState(() => hold === null && (reduced || focusSlug !== null));
  const introRef = useRef<{ start: number | null; skip: boolean }>({ start: null, skip: skipIntro });
  const glowPos = useRef(new THREE.Vector3(0, 2, 0));

  const [world] = useState<SceneState>(() => ({ intro: skipIntro ? 999 : 0, hot: null, focus: focusSlug, animate: !reduced }));

  useEffect(() => {
    previewRef.current = previewSlug;
  }, [previewSlug]);

  useEffect(() => () => void (document.body.style.cursor = ''), []);

  const handleHover = useCallback((slug: string | null) => {
    hoverRef.current = slug;
  }, []);

  // Start where the intro (or the deep link) says, before the first frame is drawn. Only on mount:
  // later focus changes are flights that start from wherever the camera is.
  const [initialFocus] = useState(focusSlug);
  useLayoutEffect(() => {
    const spec = ipSpec(initialFocus);
    const start = spec ? focusPose(spec) : skipIntro ? OVERVIEW : INTRO_POSE;
    cam.position.copy(start.pos);
    lookRef.current.copy(start.look);
    cam.fov = spec ? FOCUS_FOV : OVERVIEW_FOV;
    cam.updateProjectionMatrix();
  }, [cam, initialFocus, skipIntro]);

  // Read through refs so toggling them does not restart a camera move.
  const activeRef = useRef(active);
  const arriveRef = useRef(onArrive);
  useEffect(() => {
    activeRef.current = active;
    arriveRef.current = onArrive;
  }, [active, onArrive]);

  const publish = useCallback(
    (spec: BlockSpec) => {
      cam.updateMatrixWorld();
      const point = screenPoint(cam, gl.domElement, new THREE.Vector3(spec.cx, spec.base + spec.height, spec.cz));
      publishBlockOrigin(spec.slug!, point);
      return point;
    },
    [cam, gl],
  );

  // Move the camera whenever the focus changes: fly in, fly back out, or (while covered) jump.
  useEffect(() => {
    const spec = ipSpec(focusSlug);

    if (!spec) {
      if (!zoomedRef.current) return;
      tweenRef.current = makeTween(cam, lookRef.current, OVERVIEW, OVERVIEW_FOV, reduced ? 250 : RETURN_MS, () => {
        zoomedRef.current = false;
        publishedRef.current = false;
      });
      return;
    }

    const pose = focusPose(spec);
    zoomedRef.current = true;

    // Jump instead of flying when covered, or when a deep link already placed the camera on this block.
    const alreadyThere = introRef.current.skip && !tweenRef.current && cam.position.distanceTo(pose.pos) < 0.01;
    if (!activeRef.current || alreadyThere) {
      tweenRef.current = null;
      cam.position.copy(pose.pos);
      cam.fov = FOCUS_FOV;
      cam.updateProjectionMatrix();
      lookRef.current.copy(pose.look);
      return;
    }

    // The reveal origin is measured on arrival, where the block actually sits on screen.
    tweenRef.current = makeTween(cam, lookRef.current, pose, reduced ? cam.fov : FOCUS_FOV, reduced ? 250 : ZOOM_MS, () => {
      publishedRef.current = true;
      arriveRef.current(spec.slug!, publish(spec));
    });
  }, [focusSlug, cam, reduced, publish]);

  // A resize moves the block on screen, so measure it again.
  useEffect(() => {
    const onResize = () => {
      const spec = ipSpec(focusSlug);
      if (spec && zoomedRef.current && !tweenRef.current) requestAnimationFrame(() => requestAnimationFrame(() => publish(spec)));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [focusSlug, publish]);

  // Runs before the other frame callbacks, so every part reads this frame's state.
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const intro = introRef.current;
    if (intro.start === null) intro.start = state.clock.elapsedTime;
    world.intro = hold ?? (intro.skip ? 999 : state.clock.elapsedTime - intro.start);
    world.focus = focusSlug;
    world.hot = focusSlug === null ? (hoverRef.current ?? previewRef.current) : null;

    const tween = tweenRef.current;
    if (tween) {
      const eased = easeInOutCubic(Math.min(1, (performance.now() - tween.startedAt) / tween.duration));
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
    } else if (!zoomedRef.current) {
      // The overview: the intro dolly, then the camera leans gently toward the pointer.
      const settle = intro.skip && hold === null ? 1 : easeOutCubic(clamp01(world.intro / INTRO.camera));
      const p = parallax.current;
      const live = !reduced && settle >= 1;
      p.mix += ((live ? 1 : 0) - p.mix) * Math.min(1, dt * 2);
      p.x += (pointer.x - p.x) * Math.min(1, dt * 3);
      p.y += (pointer.y - p.y) * Math.min(1, dt * 3);
      cam.position.lerpVectors(INTRO_POSE.pos, OVERVIEW.pos, settle);
      cam.position.x += p.x * PARALLAX.x * p.mix;
      cam.position.y += p.y * PARALLAX.y * p.mix;
      lookRef.current.lerpVectors(INTRO_POSE.look, OVERVIEW.look, settle);
      lookRef.current.x += p.x * PARALLAX.x * 0.25 * p.mix;
    }
    cam.lookAt(lookRef.current);
    dofRef.current?.target?.copy(lookRef.current);

    // Finish after aiming, so callbacks that project points see this frame's camera.
    if (tween && performance.now() - tween.startedAt >= tween.duration) {
      tweenRef.current = null;
      cam.updateMatrixWorld();
      tween.onDone?.();
    }

    // A deep link starts on the block: measure where it sits so closing can shrink back into it.
    const focus = ipSpec(focusSlug);
    if (focus && zoomedRef.current && !tweenRef.current && !publishedRef.current) {
      publishedRef.current = true;
      publish(focus);
    }

    // A soft light follows whichever block is lit, so it casts a blue wash on the tier around it.
    const light = glowRef.current;
    if (light) {
      const spec = ipSpec(world.hot ?? focusSlug);
      if (spec) glowPos.current.set(spec.cx, spec.base + spec.height + 1.1, spec.cz);
      light.position.lerp(glowPos.current, Math.min(1, dt * 8));
      light.intensity += ((spec ? 7 : 0) - light.intensity) * Math.min(1, dt * 7);
    }
  }, -1);

  return (
    <SceneStateContext.Provider value={world}>
      <color attach="background" args={['#05070a']} />
      <fogExp2 attach="fog" args={['#05070a', 0.021]} />

      <ambientLight intensity={0.45} color="#9fb4e0" />
      <hemisphereLight args={['#7fa4ff', '#0d1320', 0.55]} />
      <directionalLight position={[-6, 12, 9]} intensity={2.6} color="#e6eeff" />
      <directionalLight position={[9, 5, -8]} intensity={2.2} color="#3a6dff" />
      <pointLight ref={glowRef} color="#3a95ff" distance={7} decay={2} intensity={0} />

      {/* Studio reflections for the glass and metal, generated locally rather than loaded from a CDN. */}
      <Environment resolution={256} frames={1} environmentIntensity={1.4}>
        <Lightformer form="rect" intensity={3} color="#d6e1ff" position={[0, 9, -3]} rotation-x={Math.PI / 2} scale={[22, 8, 1]} />
        <Lightformer form="rect" intensity={5} color="#2f6bff" position={[-12, 3, 2]} rotation-y={Math.PI / 2} scale={[12, 2, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#8fb0ff" position={[0, 4, 12]} scale={[18, 3, 1]} />
      </Environment>

      <Stage />
      <Wires />
      {blocks.map((spec) => (
        <Block
          key={spec.id}
          spec={spec}
          flashAt={spec.kind === 'ip' ? arrival.peripheral(spec.slug!) : spec.kind === 'bridge' ? arrival.bridge : arrival.cpu}
          order={spec.kind === 'ip' ? ipBlocks.indexOf(spec) : blocks.indexOf(spec)}
          locked={focusSlug !== null}
          onHover={handleHover}
          onPick={onSelect}
        />
      ))}

      <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
        {quality === 'high' && <DepthOfField ref={dofRef} target={[0, 0, 0]} worldFocusRange={20} bokehScale={2} />}
        <Bloom mipmapBlur luminanceThreshold={0.62} luminanceSmoothing={0.3} intensity={1.15} radius={0.7} />
        <Noise premultiply opacity={0.12} />
        <Vignette offset={0.3} darkness={0.55} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </SceneStateContext.Provider>
  );
}

// `?intro=1.5` freezes the intro at that many seconds, for inspecting or tuning it frame by frame.
function introHold(): number | null {
  const value = new URLSearchParams(window.location.search).get('intro');
  const seconds = value === null ? NaN : Number(value);
  return Number.isFinite(seconds) ? seconds : null;
}

// `?quality=high` or `?quality=low` pins the render quality; otherwise it adapts to the frame rate.
function qualityOverride(): Quality | null {
  const value = new URLSearchParams(window.location.search).get('quality');
  return value === 'high' || value === 'low' ? value : null;
}

export default function SocScene(props: SceneProps) {
  const [override] = useState(qualityOverride);
  const [quality, setQuality] = useState<Quality>(override ?? 'high');

  return (
    <Canvas
      frameloop={props.active ? 'always' : 'never'}
      dpr={quality === 'high' ? [1, 1.75] : 1}
      camera={{ position: [0, 22, 31], fov: OVERVIEW_FOV, near: 0.1, far: 140 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      {!override && <PerformanceMonitor flipflops={2} onDecline={() => setQuality('low')} />}
      <Scene {...props} quality={quality} />
    </Canvas>
  );
}
