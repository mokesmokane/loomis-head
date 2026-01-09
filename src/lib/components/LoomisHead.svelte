<script lang="ts">
  import Cranium from './Cranium.svelte';
  import FacePlane from './FacePlane.svelte';
  // import Guidelines from './Guidelines.svelte';
  // import JawWedge from './JawWedge.svelte';

  interface Props {
    showWireframe?: boolean;
    radius?: number;
  }

  let { showWireframe = false, radius = 1 }: Props = $props();
</script>

<!-- Just sphere + side cutoffs for now -->
<Cranium {showWireframe} {radius} />
<FacePlane {radius} />
