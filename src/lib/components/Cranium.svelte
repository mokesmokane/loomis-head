<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';

  interface Props {
    showWireframe?: boolean;
    radius?: number;
  }

  let { showWireframe = false, radius = 1 }: Props = $props();

  // Reactively create wireframe geometry when radius changes
  let edgesGeometry = $derived.by(() => {
    const sphereGeometry = new THREE.SphereGeometry(radius, 24, 16);
    return new THREE.EdgesGeometry(sphereGeometry, 1);
  });

  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0x4ecdc4,
    transparent: true,
    opacity: 0.3
  });
</script>

{#if showWireframe}
  <T.LineSegments geometry={edgesGeometry} material={wireframeMaterial} />
{/if}
