<script lang="ts">
  import { T } from '@threlte/core';
  import LoomisHead3D from './LoomisHead3D.svelte';
  import { headPan, headRotation } from '$lib/stores/rotation';
  import {
    calculateLandmarks,
    transformLandmarks,
    projectLandmarks,
    type ProjectedLandmark,
    type HeadParams
  } from '$lib/utils/landmarks';

  interface Props {
    canvasWidth?: number;
    canvasHeight?: number;
    radius?: number;
    sideCut?: number;
    showHiddenLines?: boolean;
    hairlinePos?: number;
    browPos?: number;
    eyeLinePos?: number;
    nosePos?: number;
    mouthPos?: number;
    eyeWidth?: number;
    noseWidth?: number;
    mouthWidth?: number;
    eyeCurve?: number;
    noseCurve?: number;
    mouthCurve?: number;
    chinPos?: number;
    chinWidth?: number;
    chinCurve?: number;
    jawDrop?: number;
    jawWidth?: number;
    chinLineCurve?: number;
    onLandmarksUpdate?: (landmarks: ProjectedLandmark[]) => void;
  }

  let {
    canvasWidth = 1920,
    canvasHeight = 1080,
    radius = 1,
    sideCut = 0.66,
    showHiddenLines = true,
    hairlinePos = 0.33,
    browPos = 0,
    eyeLinePos = -0.15,
    nosePos = -0.5,
    mouthPos = -0.75,
    eyeWidth = 0.4,
    noseWidth = 0.25,
    mouthWidth = 0.3,
    eyeCurve = 0.2,
    noseCurve = 0.2,
    mouthCurve = 0.2,
    chinPos = 0.5,
    chinWidth = 0.3,
    chinCurve = 0.2,
    jawDrop = 0.3,
    jawWidth = 0.68,
    chinLineCurve = 0,
    onLandmarksUpdate
  }: Props = $props();

  // Camera frustum matches canvas size (1 unit = 1 pixel)
  let frustumWidth = $derived(canvasWidth);
  let frustumHeight = $derived(canvasHeight);

  // Calculate projected landmarks whenever params change
  $effect(() => {
    if (!onLandmarksUpdate) return;

    const headParams: HeadParams = {
      radius,
      sideCut,
      hairlinePos,
      browPos,
      eyeLinePos,
      nosePos,
      mouthPos,
      eyeWidth,
      noseWidth,
      mouthWidth,
      eyeCurve,
      noseCurve,
      mouthCurve,
      chinPos,
      chinWidth,
      chinCurve,
      chinLineCurve,
      jawDrop,
      jawWidth
    };

    // Calculate 3D landmarks
    const landmarks3D = calculateLandmarks(headParams);

    // Transform by rotation and pan
    const transformed = transformLandmarks(landmarks3D, $headRotation, $headPan);

    // Project to 2D canvas coordinates
    const projected = projectLandmarks(transformed, canvasWidth, canvasHeight);

    onLandmarksUpdate(projected);
  });
</script>

<T.OrthographicCamera
  makeDefault
  position={[0, 0, 5000]}
  left={-frustumWidth / 2}
  right={frustumWidth / 2}
  top={frustumHeight / 2}
  bottom={-frustumHeight / 2}
  near={0.1}
  far={10000}
/>

<T.AmbientLight intensity={0.5} />
<T.DirectionalLight position={[5, 5, 5]} intensity={0.8} />

<T.Group position={[$headPan.x, $headPan.y, 0]}>
  <LoomisHead3D
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
  />
</T.Group>
