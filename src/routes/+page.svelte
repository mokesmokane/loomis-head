<script lang="ts">
  import { Canvas } from '@threlte/core';
  import Scene from '$lib/components/Scene.svelte';
  import TrackballControls from '$lib/components/TrackballControls.svelte';
  import LandmarkOverlay from '$lib/components/LandmarkOverlay.svelte';
  import { resetRotation, resetPan, applyRotation, applyLocalRotation } from '$lib/stores/rotation';
  import type { ProjectedLandmark } from '$lib/utils/landmarks';
  import * as THREE from 'three';

  let radius = $state(100);
  let sideCut = $state(0.68);
  let showHiddenLines = $state(true);
  let showLandmarks = $state(false);
  let showLandmarkLabels = $state(false);
  let projectedLandmarks: ProjectedLandmark[] = $state([]);

  // Facial feature line positions (as ratio: 1 = top, 0 = equator, -1 = bottom)
  let hairlinePos = $state(0.50);
  let browPos = $state(0);
  let eyeLinePos = $state(-0.20);
  let nosePos = $state(-0.70);
  let mouthPos = $state(-0.92);

  // Face line widths (as ratio of radius)
  let eyeWidth = $state(0.63);
  let noseWidth = $state(0.13);
  let mouthWidth = $state(0.24);

  // Face line curves (how much each curves back at edges)
  let eyeCurve = $state(0.14);
  let noseCurve = $state(0.0);
  let mouthCurve = $state(0.10);

  // Chin position (as ratio of radius below the sphere bottom)
  // 0 = at sphere bottom, 0.5 = half radius below, 1 = full radius below
  let chinPos = $state(0.35);
  // Chin width (as ratio of radius, total width = chinWidth * radius * 2)
  let chinWidth = $state(0.30);
  // Chin curve height (how much the sides curve up from center)
  let chinCurve = $state(0.17);
  // Jaw drop (how far the jaw extends down from the side rims)
  let jawDrop = $state(0.30);
  // Jaw width (horizontal distance of jaw drop points, as ratio of radius)
  let jawWidth = $state(0.68);
  // Chin line curve (bows forward/backward)
  let chinLineCurve = $state(0.25);

  // Background image
  let backgroundImage: string | null = $state(null);
  let imagePos = $state({ x: 0, y: 0 });
  let imageScale = $state(1);

  // Control mode: which element does drag/scroll affect?
  let controlMode: 'canvas' | 'head' | 'image' = $state('canvas');

  // Canvas size
  const canvasPresets = [
    { name: 'HD (1920x1080)', width: 1920, height: 1080 },
    { name: '4K (3840x2160)', width: 3840, height: 2160 },
    { name: 'Square (1080x1080)', width: 1080, height: 1080 },
    { name: 'Portrait (1080x1920)', width: 1080, height: 1920 },
    { name: 'A4 Portrait', width: 2480, height: 3508 },
    { name: 'A4 Landscape', width: 3508, height: 2480 },
    { name: 'Letter Portrait', width: 2550, height: 3300 },
    { name: 'Letter Landscape', width: 3300, height: 2550 },
    { name: 'Custom', width: 0, height: 0 }
  ];
  let selectedPreset = $state('HD (1920x1080)');
  let canvasWidth = $state(1920);
  let canvasHeight = $state(1080);
  let customWidth = $state(1920);
  let customHeight = $state(1080);

  function selectPreset(presetName: string) {
    selectedPreset = presetName;
    const preset = canvasPresets.find(p => p.name === presetName);
    if (preset && preset.width > 0) {
      canvasWidth = preset.width;
      canvasHeight = preset.height;
      customWidth = preset.width;
      customHeight = preset.height;
    }
  }

  function applyCustomSize() {
    canvasWidth = customWidth;
    canvasHeight = customHeight;
    selectedPreset = 'Custom';
  }

  // Canvas zoom (for viewing, not export)
  let canvasZoom = $state(0.5);

  // Dragging state
  let draggingTarget: 'none' | 'head' | 'image' = $state('none');
  let dragStart = { x: 0, y: 0 };
  let dragStartPos = { x: 0, y: 0 };

  function handleImageUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      // Load image to get dimensions and auto-scale to fit canvas
      const img = new Image();
      img.onload = () => {
        const scaleX = canvasWidth / img.naturalWidth;
        const scaleY = canvasHeight / img.naturalHeight;
        // Use the smaller scale to fit entirely within canvas (contain)
        imageScale = Math.min(scaleX, scaleY);
        imagePos = { x: 0, y: 0 };
        backgroundImage = url;
      };
      img.src = url;
    }
  }

  function clearImage() {
    if (backgroundImage) {
      URL.revokeObjectURL(backgroundImage);
      backgroundImage = null;
    }
    imagePos = { x: 0, y: 0 };
    imageScale = 1;
  }

  function resetImagePos() {
    imagePos = { x: 0, y: 0 };
  }

  function handleImageDrag(dx: number, dy: number) {
    if (backgroundImage) {
      imagePos = { x: imagePos.x + dx, y: imagePos.y + dy };
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.95 : 1.05;

    if (controlMode === 'head') {
      // Scale the head
      radius = Math.max(20, Math.min(2000, radius * delta));
    } else if (controlMode === 'image' && backgroundImage) {
      // Scale the image
      imageScale = Math.max(0.1, Math.min(10, imageScale * delta));
    } else {
      // Canvas mode: zoom the canvas view
      canvasZoom = Math.max(0.1, Math.min(2, canvasZoom * delta));
    }
  }

  // Rotation step in radians (1 degree)
  const rotationStep = Math.PI / 180;

  // World space rotation
  function rotateX(direction: number) {
    applyRotation(new THREE.Vector3(1, 0, 0), direction * rotationStep);
  }
  function rotateY(direction: number) {
    applyRotation(new THREE.Vector3(0, 1, 0), direction * rotationStep);
  }
  function rotateZ(direction: number) {
    applyRotation(new THREE.Vector3(0, 0, 1), direction * rotationStep);
  }

  // Local (head) space rotation
  function rotateLocalX(direction: number) {
    applyLocalRotation(new THREE.Vector3(1, 0, 0), direction * rotationStep);
  }
  function rotateLocalY(direction: number) {
    applyLocalRotation(new THREE.Vector3(0, 1, 0), direction * rotationStep);
  }
  function rotateLocalZ(direction: number) {
    applyLocalRotation(new THREE.Vector3(0, 0, 1), direction * rotationStep);
  }

  // Accordion state
  let openSections = $state({
    canvas: true,
    cranium: true,
    eyes: false,
    nose: false,
    mouth: false,
    jaw: true,
    display: false,
    landmarks: true
  });

  function toggleSection(section: keyof typeof openSections) {
    openSections[section] = !openSections[section];
  }
</script>

<svelte:head>
  <title>Loomis Head Projector</title>
</svelte:head>

<main>
  <TrackballControls onImageDrag={handleImageDrag} {controlMode}>
    <div class="canvas-container" onwheel={handleWheel}>
      <div class="canvas-wrapper" style="transform: scale({canvasZoom});">
        <div
          class="canvas-area"
          style="width: {canvasWidth}px; height: {canvasHeight}px;"
        >
          {#if backgroundImage}
            <img
              src={backgroundImage}
              alt="Reference"
              class="background-image"
              style="transform: translate(calc(-50% + {imagePos.x}px), calc(-50% + {imagePos.y}px)) scale({imageScale});"
            />
          {/if}
          <Canvas>
            <Scene
              {canvasWidth}
              {canvasHeight}
              {radius}
              {sideCut}
              {showHiddenLines}
              {hairlinePos}
              {browPos}
              {eyeLinePos}
              {nosePos}
              {mouthPos}
              {eyeWidth}
              {noseWidth}
              {mouthWidth}
              {eyeCurve}
              {noseCurve}
              {mouthCurve}
              {chinPos}
              {chinWidth}
              {chinCurve}
              {jawDrop}
              {jawWidth}
              {chinLineCurve}
              onLandmarksUpdate={(landmarks) => projectedLandmarks = landmarks}
            />
          </Canvas>
        </div>
        {#if showLandmarks && projectedLandmarks.length > 0}
          <LandmarkOverlay
            landmarks={projectedLandmarks}
            showLabels={showLandmarkLabels}
            {canvasWidth}
            {canvasHeight}
          />
        {/if}
      </div>
    </div>
  </TrackballControls>

  <!-- Left Sidebar -->
  <aside class="sidebar">
    <h2>Loomis Head</h2>

    <!-- Canvas Section -->
    <div class="accordion-section">
      <button class="accordion-header" onclick={() => toggleSection('canvas')}>
        <span>Canvas</span>
        <span class="arrow" class:open={openSections.canvas}>&#9662;</span>
      </button>
      {#if openSections.canvas}
        <div class="accordion-content">
          <label>
            <span class="label-text">Preset</span>
            <select onchange={(e) => selectPreset((e.target as HTMLSelectElement).value)} value={selectedPreset}>
              {#each canvasPresets as preset}
                <option value={preset.name}>{preset.name}</option>
              {/each}
            </select>
          </label>
          <div class="size-inputs">
            <label class="size-input">
              <span class="label-text">Width</span>
              <input type="number" bind:value={customWidth} min="100" max="10000" />
            </label>
            <label class="size-input">
              <span class="label-text">Height</span>
              <input type="number" bind:value={customHeight} min="100" max="10000" />
            </label>
            <button class="apply-btn" onclick={applyCustomSize}>Apply</button>
          </div>
          <div class="canvas-info">
            <span class="label-text">Current: {canvasWidth} x {canvasHeight}</span>
          </div>
          <label>
            <span class="label-text">View zoom <span class="value">{(canvasZoom * 100).toFixed(0)}%</span></span>
            <input type="range" min="0.1" max="2" step="0.05" bind:value={canvasZoom} />
          </label>
          <label>
            <span class="label-text">Head size <span class="value">{radius.toFixed(0)}</span></span>
            <input type="range" min="20" max="2000" step="1" bind:value={radius} />
          </label>
          <div class="drag-mode-toggle">
            <span class="label-text">Control mode:</span>
            <div class="toggle-buttons">
              <button class:active={controlMode === 'canvas'} onclick={() => controlMode = 'canvas'}>Canvas</button>
              <button class:active={controlMode === 'head'} onclick={() => controlMode = 'head'}>Head</button>
              {#if backgroundImage}
                <button class:active={controlMode === 'image'} onclick={() => controlMode = 'image'}>Image</button>
              {/if}
            </div>
          </div>
          <p class="hint">
            {#if controlMode === 'canvas'}
              Scroll to zoom canvas
            {:else if controlMode === 'head'}
              Scroll to resize head
            {:else}
              Scroll to resize image, drag to move image
            {/if}
          </p>
          {#if backgroundImage}
            <label>
              <span class="label-text">Image scale <span class="value">{imageScale.toFixed(2)}</span></span>
              <input type="range" min="0.1" max="10" step="0.01" bind:value={imageScale} />
            </label>
            <button class="reset-image-btn" onclick={resetImagePos}>Reset Image Position</button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Cranium Section -->
    <div class="accordion-section">
      <button class="accordion-header" onclick={() => toggleSection('cranium')}>
        <span>Cranium</span>
        <span class="arrow" class:open={openSections.cranium}>&#9662;</span>
      </button>
      {#if openSections.cranium}
        <div class="accordion-content">
          <label>
            <span class="label-text">Side cut <span class="value">{sideCut.toFixed(2)}</span></span>
            <input type="range" min="0.1" max="0.9" step="0.01" bind:value={sideCut} />
          </label>
          <label>
            <span class="label-text">Hairline <span class="value">{hairlinePos.toFixed(2)}</span></span>
            <input type="range" min="-1" max="1" step="0.01" bind:value={hairlinePos} />
          </label>
          <label>
            <span class="label-text">Brow <span class="value">{browPos.toFixed(2)}</span></span>
            <input type="range" min="-1" max="1" step="0.01" bind:value={browPos} />
          </label>
        </div>
      {/if}
    </div>

    <!-- Eyes Section -->
    <div class="accordion-section">
      <button class="accordion-header" onclick={() => toggleSection('eyes')}>
        <span>Eyes</span>
        <span class="arrow" class:open={openSections.eyes}>&#9662;</span>
      </button>
      {#if openSections.eyes}
        <div class="accordion-content">
          <label>
            <span class="label-text">Position <span class="value">{eyeLinePos.toFixed(2)}</span></span>
            <input type="range" min="-1" max="1" step="0.01" bind:value={eyeLinePos} />
          </label>
          <label>
            <span class="label-text">Width <span class="value">{eyeWidth.toFixed(2)}</span></span>
            <input type="range" min="0.1" max="1" step="0.01" bind:value={eyeWidth} />
          </label>
          <label>
            <span class="label-text">Curve <span class="value">{eyeCurve.toFixed(2)}</span></span>
            <input type="range" min="0" max="0.5" step="0.01" bind:value={eyeCurve} />
          </label>
        </div>
      {/if}
    </div>

    <!-- Nose Section -->
    <div class="accordion-section">
      <button class="accordion-header" onclick={() => toggleSection('nose')}>
        <span>Nose</span>
        <span class="arrow" class:open={openSections.nose}>&#9662;</span>
      </button>
      {#if openSections.nose}
        <div class="accordion-content">
          <label>
            <span class="label-text">Position <span class="value">{nosePos.toFixed(2)}</span></span>
            <input type="range" min="-1" max="1" step="0.01" bind:value={nosePos} />
          </label>
          <label>
            <span class="label-text">Width <span class="value">{noseWidth.toFixed(2)}</span></span>
            <input type="range" min="0.1" max="1" step="0.01" bind:value={noseWidth} />
          </label>
          <label>
            <span class="label-text">Curve <span class="value">{noseCurve.toFixed(2)}</span></span>
            <input type="range" min="0" max="0.5" step="0.01" bind:value={noseCurve} />
          </label>
        </div>
      {/if}
    </div>

    <!-- Mouth Section -->
    <div class="accordion-section">
      <button class="accordion-header" onclick={() => toggleSection('mouth')}>
        <span>Mouth</span>
        <span class="arrow" class:open={openSections.mouth}>&#9662;</span>
      </button>
      {#if openSections.mouth}
        <div class="accordion-content">
          <label>
            <span class="label-text">Position <span class="value">{mouthPos.toFixed(2)}</span></span>
            <input type="range" min="-1" max="1" step="0.01" bind:value={mouthPos} />
          </label>
          <label>
            <span class="label-text">Width <span class="value">{mouthWidth.toFixed(2)}</span></span>
            <input type="range" min="0.1" max="1" step="0.01" bind:value={mouthWidth} />
          </label>
          <label>
            <span class="label-text">Curve <span class="value">{mouthCurve.toFixed(2)}</span></span>
            <input type="range" min="0" max="0.5" step="0.01" bind:value={mouthCurve} />
          </label>
        </div>
      {/if}
    </div>

    <!-- Jaw Section -->
    <div class="accordion-section">
      <button class="accordion-header" onclick={() => toggleSection('jaw')}>
        <span>Jaw</span>
        <span class="arrow" class:open={openSections.jaw}>&#9662;</span>
      </button>
      {#if openSections.jaw}
        <div class="accordion-content">
          <label>
            <span class="label-text">Chin depth <span class="value">{chinPos.toFixed(2)}</span></span>
            <input type="range" min="0" max="1" step="0.01" bind:value={chinPos} />
          </label>
          <label>
            <span class="label-text">Chin width <span class="value">{chinWidth.toFixed(2)}</span></span>
            <input type="range" min="0.1" max="1" step="0.01" bind:value={chinWidth} />
          </label>
          <label>
            <span class="label-text">Chin curve <span class="value">{chinCurve.toFixed(2)}</span></span>
            <input type="range" min="0" max="0.5" step="0.01" bind:value={chinCurve} />
          </label>
          <label>
            <span class="label-text">Jaw drop <span class="value">{jawDrop.toFixed(2)}</span></span>
            <input type="range" min="0" max="1" step="0.01" bind:value={jawDrop} />
          </label>
          <label>
            <span class="label-text">Jaw width <span class="value">{jawWidth.toFixed(2)}</span></span>
            <input type="range" min="0.1" max="1" step="0.01" bind:value={jawWidth} />
          </label>
          <label>
            <span class="label-text">Face curve <span class="value">{chinLineCurve.toFixed(2)}</span></span>
            <input type="range" min="-0.5" max="1.0" step="0.01" bind:value={chinLineCurve} />
          </label>
        </div>
      {/if}
    </div>

    <!-- Display Section -->
    <div class="accordion-section">
      <button class="accordion-header" onclick={() => toggleSection('display')}>
        <span>Display</span>
        <span class="arrow" class:open={openSections.display}>&#9662;</span>
      </button>
      {#if openSections.display}
        <div class="accordion-content">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={showHiddenLines} />
            <span>Show hidden lines</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={showLandmarks} />
            <span>Show landmarks</span>
          </label>
          {#if showLandmarks}
            <label class="checkbox-label indent">
              <input type="checkbox" bind:checked={showLandmarkLabels} />
              <span>Show labels</span>
            </label>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Landmark Coordinates -->
    {#if showLandmarks && projectedLandmarks.length > 0}
      <div class="accordion-section">
        <button class="accordion-header" onclick={() => toggleSection('landmarks')}>
          <span>Coordinates</span>
          <span class="arrow" class:open={openSections.landmarks}>&#9662;</span>
        </button>
        {#if openSections.landmarks}
          <div class="accordion-content coordinates-panel">
            {#each projectedLandmarks as landmark}
              <div class="coordinate-row" class:faded={!landmark.visible}>
                <span class="coord-name">{landmark.name}</span>
                <span class="coord-value">({landmark.x}, {landmark.y})</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </aside>

  <!-- Bottom Toolbar -->
  <div class="toolbar">
    <div class="rotation-group">
      <span class="group-label">World</span>
      <div class="axis-controls">
        <span>X</span>
        <button onclick={() => rotateX(-1)}>-</button>
        <button onclick={() => rotateX(1)}>+</button>
        <span>Y</span>
        <button onclick={() => rotateY(-1)}>-</button>
        <button onclick={() => rotateY(1)}>+</button>
        <span>Z</span>
        <button onclick={() => rotateZ(-1)}>-</button>
        <button onclick={() => rotateZ(1)}>+</button>
      </div>
    </div>
    <div class="rotation-group">
      <span class="group-label">Head</span>
      <div class="axis-controls">
        <span>X</span>
        <button onclick={() => rotateLocalX(-1)}>-</button>
        <button onclick={() => rotateLocalX(1)}>+</button>
        <span>Y</span>
        <button onclick={() => rotateLocalY(-1)}>-</button>
        <button onclick={() => rotateLocalY(1)}>+</button>
        <span>Z</span>
        <button onclick={() => rotateLocalZ(-1)}>-</button>
        <button onclick={() => rotateLocalZ(1)}>+</button>
      </div>
    </div>
    <div class="toolbar-buttons">
      <button onclick={() => resetRotation()}>Reset Rotation</button>
      <button onclick={() => resetPan()}>Reset Pan</button>
      <button onclick={() => radius = 100}>Reset Size</button>
      <label class="file-button">
        Load Image
        <input type="file" accept="image/*" onchange={handleImageUpload} />
      </label>
      {#if backgroundImage}
        <button onclick={clearImage}>Clear Image</button>
      {/if}
    </div>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #0f0f1a;
    font-family: system-ui, -apple-system, sans-serif;
    overflow: hidden;
  }

  main {
    width: 100vw;
    height: 100vh;
    position: relative;
  }

  /* TrackballControls wrapper - fills the viewport minus sidebar */
  main > :global(.trackball-area) {
    position: absolute;
    top: 0;
    left: 260px;
    right: 0;
    bottom: 60px;
  }

  .canvas-container {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: #0a0a14;
  }

  .canvas-wrapper {
    position: relative;
    transform-origin: center;
    flex-shrink: 0;
    overflow: visible;
    padding: 30px 0 0 60px;
  }

  .canvas-area {
    position: relative;
    background: #ffffff;
    border: 2px solid #4ecdc4;
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.8);
    overflow: hidden;
  }

  /* Threlte canvas fills canvas-area */
  .canvas-area > :global(canvas) {
    position: absolute !important;
    top: 0;
    left: 0;
    width: 100% !important;
    height: 100% !important;
  }

  .background-image {
    position: absolute;
    top: 50%;
    left: 50%;
    max-width: none;
    transform-origin: center center;
    pointer-events: none;
    opacity: 0.7;
  }

  /* Sidebar */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 260px;
    height: 100vh;
    background: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%);
    border-right: 1px solid #2a2a4a;
    overflow-y: auto;
    z-index: 100;
  }

  .sidebar h2 {
    margin: 0;
    padding: 20px;
    font-size: 18px;
    font-weight: 600;
    color: #4ecdc4;
    border-bottom: 1px solid #2a2a4a;
    letter-spacing: 0.5px;
  }

  /* Accordion */
  .accordion-section {
    border-bottom: 1px solid #2a2a4a;
  }

  .accordion-header {
    width: 100%;
    padding: 14px 20px;
    background: transparent;
    border: none;
    color: #e0e0e0;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.2s;
  }

  .accordion-header:hover {
    background: rgba(78, 205, 196, 0.1);
  }

  .accordion-header .arrow {
    font-size: 10px;
    color: #666;
    transition: transform 0.2s;
  }

  .accordion-header .arrow.open {
    transform: rotate(180deg);
  }

  .accordion-content {
    padding: 8px 20px 16px;
    background: rgba(0, 0, 0, 0.2);
  }

  .accordion-content label {
    display: block;
    margin-bottom: 12px;
  }

  .accordion-content .label-text {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #888;
    margin-bottom: 6px;
  }

  .accordion-content .value {
    color: #4ecdc4;
    font-family: monospace;
  }

  .accordion-content input[type="range"] {
    width: 100%;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: #2a2a4a;
    border-radius: 2px;
    cursor: pointer;
  }

  .accordion-content input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: #4ecdc4;
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .accordion-content input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  .accordion-content input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: #4ecdc4;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 12px;
    color: #888;
  }

  .checkbox-label.indent {
    margin-left: 26px;
  }

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #4ecdc4;
    cursor: pointer;
  }

  /* Coordinate Panel */
  .coordinates-panel {
    max-height: 300px;
    overflow-y: auto;
  }

  .coordinate-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 11px;
    border-bottom: 1px solid #2a2a4a;
  }

  .coordinate-row:last-child {
    border-bottom: none;
  }

  .coordinate-row.faded {
    opacity: 0.4;
  }

  .coord-name {
    color: #888;
  }

  .coord-value {
    color: #4ecdc4;
    font-family: monospace;
  }

  /* Form elements */
  .accordion-content select {
    width: 100%;
    padding: 8px 10px;
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    border-radius: 4px;
    color: #ccc;
    font-size: 12px;
    cursor: pointer;
  }

  .accordion-content select:focus {
    outline: none;
    border-color: #4ecdc4;
  }

  .size-inputs {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    margin-bottom: 12px;
  }

  .size-input {
    flex: 1;
  }

  .size-input input[type="number"] {
    width: 100%;
    padding: 6px 8px;
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    border-radius: 4px;
    color: #ccc;
    font-size: 12px;
  }

  .size-input input[type="number"]:focus {
    outline: none;
    border-color: #4ecdc4;
  }

  .apply-btn {
    padding: 6px 12px;
    background: #4ecdc4;
    border: none;
    border-radius: 4px;
    color: #1a1a2e;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .apply-btn:hover {
    background: #3dbdb5;
  }

  .canvas-info {
    padding: 8px 0;
    border-top: 1px solid #2a2a4a;
    margin-top: 4px;
  }

  .hint {
    font-size: 10px;
    color: #666;
    margin: 4px 0 0 0;
    font-style: italic;
  }

  .drag-mode-toggle {
    margin: 12px 0 8px;
  }

  .drag-mode-toggle .label-text {
    margin-bottom: 8px;
  }

  .toggle-buttons {
    display: flex;
    gap: 4px;
  }

  .toggle-buttons button {
    flex: 1;
    padding: 6px 12px;
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    border-radius: 4px;
    color: #888;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .toggle-buttons button:hover {
    background: #3a3a5a;
    color: #ccc;
  }

  .toggle-buttons button.active {
    background: #4ecdc4;
    border-color: #4ecdc4;
    color: #1a1a2e;
    font-weight: 600;
  }

  .reset-image-btn {
    width: 100%;
    padding: 6px 12px;
    margin-top: 8px;
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    border-radius: 4px;
    color: #aaa;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .reset-image-btn:hover {
    background: #3a3a5a;
    color: #fff;
    border-color: #4ecdc4;
  }

  /* Bottom Toolbar */
  .toolbar {
    position: fixed;
    bottom: 0;
    left: 260px;
    right: 0;
    padding: 12px 20px;
    background: linear-gradient(180deg, #1a1a2e 0%, #12121f 100%);
    border-top: 1px solid #2a2a4a;
    display: flex;
    align-items: center;
    gap: 24px;
    z-index: 100;
  }

  .rotation-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .group-label {
    font-size: 11px;
    font-weight: 600;
    color: #4ecdc4;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    min-width: 40px;
  }

  .axis-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .axis-controls span {
    font-size: 11px;
    color: #666;
    margin-left: 8px;
    font-weight: 500;
  }

  .axis-controls span:first-child {
    margin-left: 0;
  }

  .axis-controls button {
    width: 24px;
    height: 24px;
    padding: 0;
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    color: #aaa;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: all 0.15s;
  }

  .axis-controls button:hover {
    background: #3a3a5a;
    color: #fff;
    border-color: #4ecdc4;
  }

  .toolbar-buttons {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .toolbar-buttons button,
  .file-button {
    padding: 8px 14px;
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    color: #ccc;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
  }

  .toolbar-buttons button:hover,
  .file-button:hover {
    background: #3a3a5a;
    color: #fff;
    border-color: #4ecdc4;
  }

  .file-button {
    display: inline-block;
  }

  .file-button input {
    display: none;
  }
</style>
