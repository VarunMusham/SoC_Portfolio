import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ips } from '../data/ips';
import { BOARD_SIZE, IP_CHIP, MAIN_CHIP, RING_RADIUS, chipAngle, mulberry32, palette } from './layout';

type Streak = {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  /** Head speed in world units per second; negative runs the line in reverse. */
  speed: number;
  /** IP index for bus lines, -1 for ambient board lines. */
  group: number;
  /** Resting glow of the whole line. */
  base: number;
};

const vertexShader = /* glsl */ `
  attribute vec4 aParams;
  attribute float aLength;
  varying vec2 vUv;
  varying vec4 vParams;
  varying float vLength;
  varying float vDepth;
  void main() {
    vUv = uv;
    vParams = aParams;
    vLength = aLength;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

// A bright head with an exponential tail travels along each line; lines fade with distance.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uHot;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec4 vParams;
  varying float vLength;
  varying float vDepth;
  void main() {
    float speed = vParams.y;
    float u = speed < 0.0 ? 1.0 - vUv.x : vUv.x;
    float head = fract(vParams.x + uTime * abs(speed) / vLength);
    float behind = head - u;
    behind = behind < 0.0 ? behind + 1.0 : behind;
    float tail = exp(-behind * vLength / 1.4);
    float hot = 1.0 - step(0.5, abs(vParams.z - uHot));
    float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float ends = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x);
    float fade = 1.0 - smoothstep(12.0, 38.0, vDepth);
    float glow = vParams.w * (1.0 + hot * 2.0) + tail * (1.4 + hot * 2.6);
    float intensity = glow * across * ends * fade;
    gl_FragColor = vec4(uColor * intensity, intensity);
  }
`;

function buildStreaks(): Streak[] {
  const random = mulberry32(31);
  const streaks: Streak[] = [];

  // Buses: six parallel lines from the SoC pins to each IP chip.
  const inner = MAIN_CHIP.substrate / 2 + 0.3;
  const outer = RING_RADIUS - IP_CHIP.pad / 2 - 0.05;
  ips.forEach((_, index) => {
    const angle = chipAngle(index);
    const dir = { x: Math.sin(angle), z: Math.cos(angle) };
    const side = { x: dir.z, z: -dir.x };
    for (let lane = 0; lane < 6; lane++) {
      const offset = (lane - 2.5) * 0.085;
      streaks.push({
        x1: dir.x * inner + side.x * offset,
        z1: dir.z * inner + side.z * offset,
        x2: dir.x * outer + side.x * offset,
        z2: dir.z * outer + side.z * offset,
        width: 0.035,
        speed: (lane % 2 === 0 ? 1 : -1) * (1.6 + random() * 1.4),
        group: index,
        base: 0.16,
      });
    }
  });

  // Ambient: long axis-aligned light runs across the whole board.
  const half = BOARD_SIZE / 2 - 2;
  for (let i = 0; i < 70; i++) {
    const horizontal = random() > 0.5;
    const across = (random() * 2 - 1) * half;
    const length = 6 + random() * 22;
    const start = (random() * 2 - 1) * half;
    const end = Math.max(-half, Math.min(half, start + (random() > 0.5 ? length : -length)));
    const width = 0.025 + random() * 0.03;
    const speed = (random() > 0.5 ? 1 : -1) * (1.5 + random() * 4);
    const base = 0.04 + random() * 0.1;
    streaks.push(
      horizontal
        ? { x1: start, z1: across, x2: end, z2: across, width, speed, group: -1, base }
        : { x1: across, z1: start, x2: across, z2: end, width, speed, group: -1, base },
    );
  }

  return streaks;
}

export function Streaks({ hotRef, animate }: { hotRef: RefObject<number>; animate: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const streaks = useMemo(() => buildStreaks(), []);

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    const params = new Float32Array(streaks.length * 4);
    const lengths = new Float32Array(streaks.length);
    const random = mulberry32(5);
    streaks.forEach((s, i) => {
      params.set([random(), s.speed, s.group, s.base], i * 4);
      lengths[i] = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
    });
    plane.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4));
    plane.setAttribute('aLength', new THREE.InstancedBufferAttribute(lengths, 1));
    return plane;
  }, [streaks]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uHot: { value: -10 },
          uColor: { value: palette.signal.clone() },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    streaks.forEach((s, i) => {
      const dx = s.x2 - s.x1;
      const dz = s.z2 - s.z1;
      rotation.setFromAxisAngle(up, Math.atan2(-dz, dx));
      matrix.compose(
        new THREE.Vector3((s.x1 + s.x2) / 2, 0.014, (s.z1 + s.z2) / 2),
        rotation,
        new THREE.Vector3(Math.hypot(dx, dz), 1, s.width),
      );
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [streaks]);

  useFrame((_, delta) => {
    if (animate) material.uniforms.uTime.value += delta;
    material.uniforms.uHot.value = hotRef.current;
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={meshRef} args={[geometry, material, streaks.length]} frustumCulled={false} />;
}
