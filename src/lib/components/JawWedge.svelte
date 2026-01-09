<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';

  const jawColor = 0xff9f43;

  // The jaw wedge connects the bottom of the face plane to the chin
  // It's a tapered shape that narrows towards the chin

  // Define the vertices of the jaw wedge wireframe
  // Top vertices (where jaw connects to sphere) - wider
  const topLeft: [number, number, number] = [-0.45, -0.6, 0.35];
  const topRight: [number, number, number] = [0.45, -0.6, 0.35];
  const topBack: [number, number, number] = [0, -0.6, -0.3];

  // Bottom vertex (chin point)
  const chin: [number, number, number] = [0, -1.4, 0.15];

  // Side vertices for jaw angle
  const jawLeft: [number, number, number] = [-0.35, -1.0, 0.25];
  const jawRight: [number, number, number] = [0.35, -1.0, 0.25];

  // Create line segments for the jaw wireframe
  function createJawGeometry(): THREE.BufferGeometry {
    const points: THREE.Vector3[] = [];

    // Top edge (connects to sphere)
    points.push(new THREE.Vector3(...topLeft));
    points.push(new THREE.Vector3(...topRight));

    // Right side of jaw
    points.push(new THREE.Vector3(...topRight));
    points.push(new THREE.Vector3(...jawRight));

    points.push(new THREE.Vector3(...jawRight));
    points.push(new THREE.Vector3(...chin));

    // Left side of jaw
    points.push(new THREE.Vector3(...topLeft));
    points.push(new THREE.Vector3(...jawLeft));

    points.push(new THREE.Vector3(...jawLeft));
    points.push(new THREE.Vector3(...chin));

    // Back connections
    points.push(new THREE.Vector3(...topLeft));
    points.push(new THREE.Vector3(...topBack));

    points.push(new THREE.Vector3(...topRight));
    points.push(new THREE.Vector3(...topBack));

    points.push(new THREE.Vector3(...topBack));
    points.push(new THREE.Vector3(...chin));

    // Jaw angle line
    points.push(new THREE.Vector3(...jawLeft));
    points.push(new THREE.Vector3(...jawRight));

    return new THREE.BufferGeometry().setFromPoints(points);
  }

  const jawGeometry = createJawGeometry();

  const jawMaterial = new THREE.LineBasicMaterial({
    color: jawColor,
    linewidth: 2
  });
</script>

<T.LineSegments geometry={jawGeometry} material={jawMaterial} />
