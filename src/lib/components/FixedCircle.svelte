<script lang="ts">
  import { T, useThrelte, useTask } from '@threlte/core';
  import * as THREE from 'three';

  interface Props {
    radius?: number;
  }

  let { radius = 1 }: Props = $props();

  const segments = 64;

  // Reactively create geometry when radius changes
  let geometry = $derived.by(() => {
    const curve = new THREE.EllipseCurve(
      0, 0,
      radius, radius,
      0, Math.PI * 2,
      false,
      0
    );
    const points = curve.getPoints(segments);
    return new THREE.BufferGeometry().setFromPoints(points);
  });

  const material = new THREE.LineBasicMaterial({
    color: 0x4ecdc4,
    linewidth: 2
  });

  const { camera } = useThrelte();

  let lineRef: THREE.Line | undefined;

  // Every frame, rotate to face camera
  useTask(() => {
    if (lineRef && camera.current) {
      lineRef.lookAt(camera.current.position);
    }
  });
</script>

<T.Line
  geometry={geometry}
  material={material}
  position={[0, 0, 0]}
  bind:ref={lineRef}
/>
