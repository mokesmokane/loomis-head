<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';

  const radius = 1.01; // Slightly larger than sphere to sit on surface
  const segments = 48;
  const lineColor = 0xffd93d;

  // Create a circular arc on the sphere surface
  function createArc(
    startAngle: number,
    endAngle: number,
    radius: number,
    yOffset: number = 0,
    axis: 'horizontal' | 'vertical' = 'horizontal'
  ): THREE.BufferGeometry {
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / segments);

      if (axis === 'horizontal') {
        // Horizontal arc (latitude line)
        const x = Math.cos(angle) * radius * Math.cos(Math.asin(yOffset / radius));
        const z = Math.sin(angle) * radius * Math.cos(Math.asin(yOffset / radius));
        points.push(new THREE.Vector3(x, yOffset, z));
      } else {
        // Vertical arc (longitude line)
        const x = Math.sin(angle) * radius;
        const y = Math.cos(angle) * radius;
        points.push(new THREE.Vector3(x, y, 0));
      }
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }

  // Vertical centerline - full great circle on the YZ plane, visible from front
  function createCenterline(): THREE.BufferGeometry {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = 0;
      const y = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      points.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }

  // Horizontal guidelines at different heights
  // Brow line - about 1/3 from top
  const browLineGeometry = createArc(-Math.PI / 2, Math.PI / 2, radius, 0.35);

  // Eye line - at the center (equator of head)
  const eyeLineGeometry = createArc(-Math.PI / 2, Math.PI / 2, radius, 0);

  // Nose line - about 1/3 below center
  const noseLineGeometry = createArc(-Math.PI / 2, Math.PI / 2, radius, -0.35);

  // Centerline - vertical line down the middle
  const centerlineGeometry = createCenterline();

  const guideMaterial = new THREE.LineBasicMaterial({
    color: lineColor,
    linewidth: 2
  });

  const centerMaterial = new THREE.LineBasicMaterial({
    color: 0x95e1d3,
    linewidth: 2
  });
</script>

<!-- Horizontal guidelines -->
<T.Line geometry={browLineGeometry} material={guideMaterial} />
<T.Line geometry={eyeLineGeometry} material={guideMaterial} />
<T.Line geometry={noseLineGeometry} material={guideMaterial} />

<!-- Vertical centerline -->
<T.Line geometry={centerlineGeometry} material={centerMaterial} />
