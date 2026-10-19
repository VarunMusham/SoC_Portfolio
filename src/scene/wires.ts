import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CYCLE, pulses } from '../diagram/flow';
import { ipBlocks, routePath, wirePath } from './world';

export type TubeResult = { geometry: THREE.TubeGeometry; length: number };

// A tube along a polyline. Corners are rounded a little by the spline, which reads as a bent conduit.
export function tubeAlong(points: THREE.Vector3[], radius: number, radial = 8): TubeResult {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.08);
  const length = curve.getLength();
  const segments = Math.max(8, Math.ceil(length * 18));
  return { geometry: new THREE.TubeGeometry(curve, segments, radius, radial, false), length };
}

function setAttribute(geometry: THREE.BufferGeometry, name: string, fill: (i: number) => number) {
  const count = geometry.getAttribute('position').count;
  const data = new Float32Array(count);
  for (let i = 0; i < count; i++) data[i] = fill(i);
  geometry.setAttribute(name, new THREE.BufferAttribute(data, 1));
}

// Distance travelled along the wire, per vertex: TubeGeometry stores it in uv.x as a 0..1 fraction.
function addDistance(geometry: THREE.BufferGeometry, length: number) {
  const uv = geometry.getAttribute('uv');
  setAttribute(geometry, 'aS', (i) => uv.getX(i) * length);
  setAttribute(geometry, 'aLen', () => length);
}

// The resting conduits: one mesh for every wire.
export function createConduitGeometry(): THREE.BufferGeometry {
  const parts = pulses
    .filter((p) => p.kind === 'request')
    .map((p) => tubeAlong(wirePath(p), 0.036).geometry);
  return mergeGeometries(parts)!;
}

// Every pulse of the loop in one mesh. Each carries its own slot in the cycle, read by the shader.
export function createPulseGeometry(): THREE.BufferGeometry {
  const parts = pulses.map((p) => {
    const { geometry, length } = tubeAlong(wirePath(p), 0.115, 10);
    addDistance(geometry, length);
    setAttribute(geometry, 'aStart', () => p.start);
    setAttribute(geometry, 'aDur', () => p.dur);
    setAttribute(geometry, 'aKind', () => (p.kind === 'request' ? 0 : 1));
    return geometry;
  });
  return mergeGeometries(parts)!;
}

// The route to every peripheral, tagged with its index so the shader can show just one.
export function createRouteGeometry(): THREE.BufferGeometry {
  const parts = ipBlocks.map((b, index) => {
    const { geometry, length } = tubeAlong(routePath(b.slug!), 0.06);
    addDistance(geometry, length);
    setAttribute(geometry, 'aId', () => index);
    return geometry;
  });
  return mergeGeometries(parts)!;
}

const PULSE_VERTEX = /* glsl */ `
  attribute float aS;
  attribute float aLen;
  attribute float aStart;
  attribute float aDur;
  attribute float aKind;
  varying float vS;
  varying float vLen;
  varying float vStart;
  varying float vDur;
  varying float vKind;
  void main() {
    vS = aS; vLen = aLen; vStart = aStart; vDur = aDur; vKind = aKind;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A comet: a sharp bright head and a long soft tail, measured in world units so every wire gets
// the same comet however long it is. Outside its slot in the cycle the fragment is discarded.
const PULSE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uCycle;
  uniform float uFade;
  uniform vec3 uRequest;
  uniform vec3 uResponse;
  varying float vS;
  varying float vLen;
  varying float vStart;
  varying float vDur;
  varying float vKind;
  void main() {
    float p = mod(uTime - vStart, uCycle) / vDur;
    if (p > 1.0) discard;
    float head = mix(-0.7, vLen + 0.7, p);
    float d = head - vS;
    float body = d >= 0.0 ? exp(-d * 2.4) : exp(d * 28.0);
    float core = exp(-abs(d) * 16.0);
    vec3 colour = mix(uRequest, uResponse, vKind);
    gl_FragColor = vec4(colour * (2.2 + 4.0 * core), body * uFade);
  }
`;

const ROUTE_VERTEX = /* glsl */ `
  attribute float aS;
  attribute float aId;
  varying float vS;
  varying float vId;
  void main() {
    vS = aS; vId = aId;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A dim solid line with bright dashes running away from the bridge.
const ROUTE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uHot;
  uniform float uMix;
  uniform vec3 uColour;
  varying float vS;
  varying float vId;
  void main() {
    if (abs(vId - uHot) > 0.5) discard;
    float dash = smoothstep(0.55, 0.9, fract(vS * 0.9 - uTime * 1.5));
    gl_FragColor = vec4(uColour * (1.0 + 2.6 * dash), uMix * (0.45 + 0.55 * dash));
  }
`;

export function createPulseMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: PULSE_VERTEX,
    fragmentShader: PULSE_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uCycle: { value: CYCLE },
      uFade: { value: 0 },
      uRequest: { value: new THREE.Color('#7cc4ff') },
      uResponse: { value: new THREE.Color('#5eeac4') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

export function createRouteMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: ROUTE_VERTEX,
    fragmentShader: ROUTE_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uHot: { value: -1 },
      uMix: { value: 0 },
      uColour: { value: new THREE.Color('#2f93ff') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}
