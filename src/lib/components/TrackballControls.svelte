<script lang="ts">
  import { applyRotation, applyPan } from '$lib/stores/rotation';
  import * as THREE from 'three';

  import type { Snippet } from 'svelte';

  interface Props {
    onImageDrag?: (dx: number, dy: number) => void;
    controlMode?: 'canvas' | 'head' | 'image';
    children: Snippet;
  }

  let { onImageDrag, controlMode = 'canvas', children }: Props = $props();

  let isDragging = false;
  let isPanning = false;
  let isImageDragging = false;
  let lastX = 0;
  let lastY = 0;

  const rotationSpeed = 0.01;
  const panSpeed = 1;

  function handlePointerDown(e: PointerEvent) {
    isDragging = true;
    // Determine behavior based on control mode
    // Canvas/Head mode: left drag moves head, right drag rotates
    // Image mode: drag moves image
    if (controlMode === 'image') {
      isImageDragging = !!onImageDrag;
      isPanning = false;
    } else {
      // Canvas or Head mode: left drag pans, right drag rotates
      isImageDragging = false;
      isPanning = e.button !== 2 && !e.shiftKey; // Left click = pan
    }
    lastX = e.clientX;
    lastY = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;

    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;

    lastX = e.clientX;
    lastY = e.clientY;

    if (isImageDragging && onImageDrag) {
      // Image drag mode: move the background image
      onImageDrag(deltaX, deltaY);
    } else if (isPanning) {
      // Pan mode: move the head
      applyPan(deltaX * panSpeed, -deltaY * panSpeed);
    } else {
      // Rotate mode: rotate the head
      if (Math.abs(deltaX) > 0) {
        const axis = new THREE.Vector3(0, 1, 0);
        applyRotation(axis, deltaX * rotationSpeed);
      }

      if (Math.abs(deltaY) > 0) {
        const axis = new THREE.Vector3(1, 0, 0);
        applyRotation(axis, deltaY * rotationSpeed);
      }
    }
  }

  function handlePointerUp(e: PointerEvent) {
    isDragging = false;
    isPanning = false;
    isImageDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
  }
</script>

<div
  class="trackball-area"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  oncontextmenu={handleContextMenu}
  role="application"
  aria-label="Drag to rotate, right-drag or shift-drag to pan, alt-drag to move image"
>
  {@render children()}
</div>

<style>
  .trackball-area {
    width: 100%;
    height: 100%;
    cursor: grab;
    touch-action: none;
  }

  .trackball-area:active {
    cursor: grabbing;
  }
</style>
