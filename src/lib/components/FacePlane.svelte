<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';

  interface Props {
    radius?: number;
  }

  let { radius = 1 }: Props = $props();

  const segments = 64;
  const sideSliceRatio = 0.65; // distance from center as ratio of radius

  // Reactively create geometries when radius changes
  let sideSliceDistance = $derived(sideSliceRatio * radius);
  let sideCircleRadius = $derived(Math.sqrt(radius * radius - sideSliceDistance * sideSliceDistance));

  let sideGeometry = $derived.by(() => {
    const curve = new THREE.EllipseCurve(
      0, 0,
      sideCircleRadius, sideCircleRadius,
      0, Math.PI * 2,
      false,
      0
    );
    return new THREE.BufferGeometry().setFromPoints(curve.getPoints(segments));
  });

  let centerGeometry = $derived.by(() => {
    const curve = new THREE.EllipseCurve(
      0, 0,
      radius, radius,
      0, Math.PI * 2,
      false,
      0
    );
    return new THREE.BufferGeometry().setFromPoints(curve.getPoints(segments));
  });

  const sideMaterial = new THREE.LineBasicMaterial({
    color: 0xc792ea,
    linewidth: 2
  });

  const centerMaterial = new THREE.LineBasicMaterial({
    color: 0xff6b6b,
    linewidth: 2
  });
</script>

<!-- Center circle (red) - rotates with head, perpendicular to side cutoffs -->
<T.Line
  geometry={centerGeometry}
  material={centerMaterial}
  position={[0, 0, 0]}
  rotation={[0, Math.PI / 2, 0]}
/>

<!-- Left side cutoff -->
<T.Line
  geometry={sideGeometry}
  material={sideMaterial}
  position={[0, 0, -sideSliceDistance]}
/>

<!-- Right side cutoff -->
<T.Line
  geometry={sideGeometry}
  material={sideMaterial}
  position={[0, 0, sideSliceDistance]}
/>
