import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';

type PerimeterSpec = {
  perSide: number;
  /** Length of the edge the pins are spread along. */
  span: number;
  /** Distance from the package centre to the inner end of each pin. */
  edge: number;
  length: number;
  width: number;
  height: number;
  y: number;
};

// Matrices for one row of pins (or pads) along all four edges of a square package.
export function perimeterPins({ perSide, span, edge, length, width, height, y }: PerimeterSpec): THREE.Matrix4[] {
  const matrices: THREE.Matrix4[] = [];
  const step = span / perSide;
  const reach = edge + length / 2;
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < perSide; k++) {
      const t = -span / 2 + (k + 0.5) * step;
      const alongX = side >= 2;
      const sign = side % 2 === 0 ? 1 : -1;
      const matrix = new THREE.Matrix4();
      if (alongX) matrix.makeScale(width, height, length).setPosition(t, y, sign * reach);
      else matrix.makeScale(length, height, width).setPosition(sign * reach, y, t);
      matrices.push(matrix);
    }
  }
  return matrices;
}

export function useInstanceMatrices(matrices: THREE.Matrix4[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  return ref;
}
