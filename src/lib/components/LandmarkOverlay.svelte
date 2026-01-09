<script lang="ts">
  import type { ProjectedLandmark } from '$lib/utils/landmarks';

  type CanvasUnit = 'px' | 'cm' | 'in';

  interface Props {
    landmarks: ProjectedLandmark[];
    showLabels?: boolean;
    canvasWidth: number;
    canvasHeight: number;
    unit?: CanvasUnit;
    formatInUnit?: (px: number, unit: CanvasUnit) => string;
  }

  let {
    landmarks,
    showLabels = false,
    canvasWidth,
    canvasHeight,
    unit = 'px',
    formatInUnit = (px: number) => px.toString()
  }: Props = $props();

  let hoveredLandmark: ProjectedLandmark | null = $state(null);

  function handleMouseEnter(landmark: ProjectedLandmark) {
    hoveredLandmark = landmark;
  }

  function handleMouseLeave() {
    hoveredLandmark = null;
  }
</script>

<svg
  class="landmark-overlay"
  viewBox="0 0 {canvasWidth} {canvasHeight}"
  style="width: {canvasWidth}px; height: {canvasHeight}px;"
>
  <!-- Crosshair lines when hovering -->
  {#if hoveredLandmark}
    <!-- Vertical line -->
    <line
      x1={hoveredLandmark.x}
      y1={0}
      x2={hoveredLandmark.x}
      y2={canvasHeight}
      class="crosshair-line"
    />
    <!-- Horizontal line -->
    <line
      x1={0}
      y1={hoveredLandmark.y}
      x2={canvasWidth}
      y2={hoveredLandmark.y}
      class="crosshair-line"
    />
    <!-- X coordinate label above canvas -->
    <g class="coord-label">
      <rect
        x={hoveredLandmark.x - 30}
        y={-22}
        width="60"
        height="18"
        rx="3"
      />
      <text x={hoveredLandmark.x} y={-8}>{formatInUnit(hoveredLandmark.x, unit)}</text>
    </g>
    <!-- Y coordinate label left of canvas -->
    <g class="coord-label">
      <rect
        x={-64}
        y={hoveredLandmark.y - 9}
        width="60"
        height="18"
        rx="3"
      />
      <text x={-34} y={hoveredLandmark.y + 4}>{formatInUnit(hoveredLandmark.y, unit)}</text>
    </g>
    <!-- Landmark name tooltip -->
    <g class="landmark-tooltip">
      <rect
        x={hoveredLandmark.x + 12}
        y={hoveredLandmark.y - 12}
        width={hoveredLandmark.name.length * 8 + 16}
        height="24"
        rx="4"
      />
      <text x={hoveredLandmark.x + 20} y={hoveredLandmark.y + 4}>{hoveredLandmark.name}</text>
    </g>
  {/if}

  <!-- Landmark dots (only if within canvas bounds) -->
  {#each landmarks as landmark}
    {#if landmark.x >= 0 && landmark.x <= canvasWidth && landmark.y >= 0 && landmark.y <= canvasHeight}
      {#if landmark.visible}
        <g class="landmark-point">
          <!-- Larger invisible hit area for easier hovering -->
          <circle
            cx={landmark.x}
            cy={landmark.y}
            r="12"
            fill="transparent"
            class="hit-area"
            role="button"
            tabindex="-1"
            aria-label={landmark.name}
            onmouseenter={() => handleMouseEnter(landmark)}
            onmouseleave={handleMouseLeave}
          />
          <circle
            cx={landmark.x}
            cy={landmark.y}
            r="6"
            fill="#ff6b6b"
            stroke="#fff"
            stroke-width="2"
            class="landmark-dot"
            class:hovered={hoveredLandmark?.name === landmark.name}
          />
          {#if showLabels && hoveredLandmark?.name !== landmark.name}
            <text
              x={landmark.x + 10}
              y={landmark.y + 4}
              class="landmark-label"
            >
              {landmark.name}
            </text>
          {/if}
        </g>
      {:else}
        <!-- Show faded dot for back-facing landmarks -->
        <circle
          cx={landmark.x}
          cy={landmark.y}
          r="4"
          fill="rgba(255, 107, 107, 0.3)"
          stroke="rgba(255, 255, 255, 0.3)"
          stroke-width="1"
        />
      {/if}
    {/if}
  {/each}
</svg>

<style>
  .landmark-overlay {
    position: absolute;
    top: 30px;
    left: 70px;
    overflow: visible;
    pointer-events: none;
  }

  .crosshair-line {
    stroke: rgba(255, 107, 107, 0.6);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }

  .coord-label rect {
    fill: rgba(0, 0, 0, 0.8);
  }

  .coord-label text {
    fill: #4ecdc4;
    font-size: 12px;
    font-family: monospace;
    text-anchor: middle;
  }

  .landmark-tooltip rect {
    fill: rgba(0, 0, 0, 0.9);
  }

  .landmark-tooltip text {
    fill: #fff;
    font-size: 12px;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .hit-area {
    cursor: pointer;
    pointer-events: auto;
  }

  .landmark-dot {
    pointer-events: none;
    transition: r 0.1s ease;
  }

  .landmark-dot.hovered {
    r: 8;
    fill: #ff8a8a;
  }

  .landmark-label {
    font-size: 12px;
    fill: #fff;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    font-family: system-ui, -apple-system, sans-serif;
    pointer-events: none;
  }
</style>
