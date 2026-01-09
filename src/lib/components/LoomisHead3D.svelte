<script lang="ts">
  import { T } from '@threlte/core';
  import { headRotation } from '$lib/stores/rotation';
  import {
    circleOnPlane,
    rotatePoints,
    splitFrontBack,
    pointsToGeometry,
    calculateRimRadius,
    clipToSideBand
  } from '$lib/utils/geometry';
  import * as THREE from 'three';

  interface Props {
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
  }

  let {
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
    chinLineCurve = 0
  }: Props = $props();

  const segments = 128;

  // Colors
  const silhouetteColor = 0x4ecdc4; // Teal
  const guideColor = 0xffd93d; // Yellow
  const rimColor = 0xc792ea; // Purple
  const featureColor = 0xff6b6b; // Coral/Red for feature lines
  const jawColor = 0x45b7d1; // Light blue for jaw/chin

  // Materials (linewidth only works on some platforms due to WebGL limitations)
  const silhouetteMaterial = new THREE.LineBasicMaterial({ color: silhouetteColor, linewidth: 3 });
  const guideMaterial = new THREE.LineBasicMaterial({ color: guideColor, linewidth: 3 });
  const rimMaterial = new THREE.LineBasicMaterial({ color: rimColor, linewidth: 3 });
  const featureMaterial = new THREE.LineBasicMaterial({ color: featureColor, linewidth: 3 });
  const jawMaterial = new THREE.LineBasicMaterial({ color: jawColor, linewidth: 3 });

  // Back-facing materials (dashed, 60% opacity)
  const silhouetteBackMaterial = new THREE.LineDashedMaterial({
    color: silhouetteColor,
    dashSize: 0.05,
    gapSize: 0.03,
    opacity: 0.4,
    transparent: true
  });
  const guideBackMaterial = new THREE.LineDashedMaterial({
    color: guideColor,
    dashSize: 0.05,
    gapSize: 0.03,
    opacity: 0.4,
    transparent: true
  });
  const rimBackMaterial = new THREE.LineDashedMaterial({
    color: rimColor,
    dashSize: 0.05,
    gapSize: 0.03,
    opacity: 0.4,
    transparent: true
  });
  const featureBackMaterial = new THREE.LineDashedMaterial({
    color: featureColor,
    dashSize: 0.05,
    gapSize: 0.03,
    opacity: 0.4,
    transparent: true
  });
  const jawBackMaterial = new THREE.LineDashedMaterial({
    color: jawColor,
    dashSize: 0.05,
    gapSize: 0.03,
    opacity: 0.4,
    transparent: true
  });

  // Calculate side rim values
  let cutDistance = $derived(sideCut * radius);
  let rimRadius = $derived(calculateRimRadius(radius, cutDistance));

  // Helper to calculate horizontal circle radius at a given Y position on sphere
  // For a sphere of radius R, a horizontal slice at height y has radius sqrt(R^2 - y^2)
  function getHorizontalCircleRadius(yPos: number, sphereRadius: number): number {
    const y = yPos * sphereRadius; // Convert ratio to actual Y coordinate
    const rSquared = sphereRadius * sphereRadius - y * y;
    return rSquared > 0 ? Math.sqrt(rSquared) : 0;
  }

  // Generate a horizontal feature line at given Y position (as ratio -1 to 1)
  function generateFeatureLine(yRatio: number): THREE.Vector3[] {
    const y = yRatio * radius;
    const circleRadius = getHorizontalCircleRadius(yRatio, radius);
    if (circleRadius <= 0) return [];
    return circleOnPlane(
      new THREE.Vector3(0, y, 0),
      new THREE.Vector3(0, 1, 0), // Normal pointing up (horizontal circle)
      circleRadius,
      segments
    );
  }

  // Helper to split a line segment at z=0 for front/back rendering
  function splitLine(p1: THREE.Vector3, p2: THREE.Vector3): { front: THREE.Vector3[][], back: THREE.Vector3[][] } {
    const front: THREE.Vector3[][] = [];
    const back: THREE.Vector3[][] = [];

    const z1 = p1.z;
    const z2 = p2.z;

    if (z1 >= 0 && z2 >= 0) {
      // Both front
      front.push([p1, p2]);
    } else if (z1 < 0 && z2 < 0) {
      // Both back
      back.push([p1, p2]);
    } else {
      // Line crosses z=0, find intersection
      const t = z1 / (z1 - z2);
      const mid = new THREE.Vector3().lerpVectors(p1, p2, t);

      if (z1 >= 0) {
        front.push([p1, mid.clone()]);
        back.push([mid.clone(), p2]);
      } else {
        back.push([p1, mid.clone()]);
        front.push([mid.clone(), p2]);
      }
    }

    return { front, back };
  }

  // Generate base circle points (before rotation)
  // Silhouette: Generate in head space with camera direction as normal
  // The camera looks down -Z, so view direction is (0,0,1) in camera space
  // Transform to head space: conjugate of headRotation
  let silhouetteNormalHeadSpace = $derived(
    new THREE.Vector3(0, 0, 1).applyQuaternion($headRotation.clone().conjugate())
  );
  let silhouettePointsHeadSpace = $derived(
    circleOnPlane(new THREE.Vector3(0, 0, 0), silhouetteNormalHeadSpace, radius, segments)
  );
  // Clip silhouette in head space, then rotate to camera space
  let silhouetteClipped = $derived(clipToSideBand(silhouettePointsHeadSpace, cutDistance));
  let silhouetteSegments = $derived(
    silhouetteClipped.map(seg => rotatePoints(seg, $headRotation))
  );

  // Centerline: vertical circle in YZ plane (normal = X axis)
  let centerlinePoints = $derived(
    circleOnPlane(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), radius, segments)
  );
  // Clip in head space first
  let centerlineClipped = $derived(clipToSideBand(centerlinePoints, cutDistance));

  // Equator: horizontal circle in XZ plane (normal = Y axis)
  let equatorPoints = $derived(
    circleOnPlane(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), radius, segments)
  );
  // Clip in head space first
  let equatorClipped = $derived(clipToSideBand(equatorPoints, cutDistance));

  // Feature lines (horizontal circles at specific Y positions)
  let hairlinePoints = $derived(generateFeatureLine(hairlinePos));
  let hairlineClipped = $derived(clipToSideBand(hairlinePoints, cutDistance));

  let browPoints = $derived(generateFeatureLine(browPos));
  let browClipped = $derived(clipToSideBand(browPoints, cutDistance));

  // Face plane curves for eye, nose, mouth (at z = radius, curving back)
  let eyeLineY = $derived(eyeLinePos * radius);
  let noseLineY = $derived(nosePos * radius);
  let mouthLineY = $derived(mouthPos * radius);

  let eyeWidthHalf = $derived(eyeWidth * radius);
  let noseWidthHalf = $derived(noseWidth * radius);
  let mouthWidthHalf = $derived(mouthWidth * radius);

  // Chin point - below the sphere
  // Y position: sphere bottom (-radius) minus chinPos * radius
  let chinY = $derived(-radius - chinPos * radius);
  // Small cross marker size
  const chinMarkerSize = 0.05; // As ratio of radius
  let chinMarkerHalf = $derived(radius * chinMarkerSize);

  // Chin z-position (setback from front of sphere)
  // chinLineCurve controls how far back the chin is: 0 = at front (z=radius), positive = set back
  let chinZ = $derived(radius - chinLineCurve * radius);

  // Chin marker as a small cross (two perpendicular lines)
  // Chin is at chinZ (may be set back from front)
  let chinCrossH = $derived([
    new THREE.Vector3(-chinMarkerHalf, chinY, chinZ),
    new THREE.Vector3(chinMarkerHalf, chinY, chinZ)
  ]);
  let chinCrossV = $derived([
    new THREE.Vector3(0, chinY - chinMarkerHalf, chinZ),
    new THREE.Vector3(0, chinY + chinMarkerHalf, chinZ)
  ]);
  let chinCrossZ = $derived([
    new THREE.Vector3(0, chinY, chinZ - chinMarkerHalf),
    new THREE.Vector3(0, chinY, chinZ + chinMarkerHalf)
  ]);

  // Curved line from front of sphere to chin
  // Uses quadratic bezier-like curve that smoothly transitions z from radius to chinZ
  function generateChinLinePoints(
    startY: number,
    endY: number,
    startZ: number,
    endZ: number,
    numSegments: number = 32
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const y = startY + t * (endY - startY);
      // Smooth easing for z: use quadratic ease-in curve
      // This makes the curve bow outward (toward camera) in the middle
      // t² gives ease-in, keeping z closer to startZ longer before curving to endZ
      const zT = t * t; // quadratic ease-in
      const z = startZ + zT * (endZ - startZ);
      points.push(new THREE.Vector3(0, y, z));
    }
    return points;
  }

  let chinLinePoints = $derived(
    generateChinLinePoints(0, chinY, radius, chinZ)
  );

  // Curved chin width line (parabolic curve)
  let chinWidthHalf = $derived(chinWidth * radius);
  let chinCurveHeight = $derived(chinCurve * radius);

  // Generate parabolic curve in Z: z = baseZ - curveDepth * (x/widthHalf)²
  // Center is at front (z = baseZ), edges curve back (smaller z)
  function generateChinCurvePoints(
    yPos: number,
    widthHalf: number,
    curveDepth: number,
    baseZ: number,
    numSegments: number = 32
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const x = -widthHalf + t * 2 * widthHalf;
      const normalizedX = widthHalf > 0 ? x / widthHalf : 0; // -1 to 1
      const z = baseZ - curveDepth * normalizedX * normalizedX;
      points.push(new THREE.Vector3(x, yPos, z));
    }
    return points;
  }

  let chinCurvePoints = $derived(
    generateChinCurvePoints(chinY, chinWidthHalf, chinCurveHeight, chinZ)
  );

  // Get z-position on face curve for a given y-position
  // Features above equator stay at sphere front, features below follow the face curve
  function getFaceCurveZ(yPos: number): number {
    if (yPos >= 0) {
      // On or above equator - stay at front of sphere
      return radius;
    }
    // Below equator - follow face curve using same quadratic ease-in as centerline
    // t = 0 at y=0, t = 1 at y=chinY
    const t = yPos / chinY; // Both negative, so t is positive 0-1
    const zT = t * t; // quadratic ease-in
    return radius + zT * (chinZ - radius);
  }

  // Individual curve depths for face features
  let eyeCurveDepth = $derived(eyeCurve * radius);
  let noseCurveDepth = $derived(noseCurve * radius);
  let mouthCurveDepth = $derived(mouthCurve * radius);

  // Face plane curves for eye, nose, mouth - positioned on the face curve
  let eyeCurvePoints = $derived(
    generateChinCurvePoints(eyeLineY, eyeWidthHalf, eyeCurveDepth, getFaceCurveZ(eyeLineY))
  );
  let noseCurvePoints = $derived(
    generateChinCurvePoints(noseLineY, noseWidthHalf, noseCurveDepth, getFaceCurveZ(noseLineY))
  );
  let mouthCurvePoints = $derived(
    generateChinCurvePoints(mouthLineY, mouthWidthHalf, mouthCurveDepth, getFaceCurveZ(mouthLineY))
  );

  // Jaw lines - from bottom of side rims down to jaw drop points
  let jawDropDistance = $derived(jawDrop * radius);
  let jawWidthDistance = $derived(jawWidth * radius);
  // Left jaw line: from bottom of left rim, angling to jaw drop point
  let leftJawLine = $derived([
    new THREE.Vector3(-cutDistance, -rimRadius, 0),
    new THREE.Vector3(-jawWidthDistance, -rimRadius - jawDropDistance, 0)
  ]);
  // Right jaw line: from bottom of right rim, angling to jaw drop point
  let rightJawLine = $derived([
    new THREE.Vector3(cutDistance, -rimRadius, 0),
    new THREE.Vector3(jawWidthDistance, -rimRadius - jawDropDistance, 0)
  ]);

  // Jaw-to-chin connection lines
  let leftJawToChinLine = $derived([
    new THREE.Vector3(-jawWidthDistance, -rimRadius - jawDropDistance, 0),
    new THREE.Vector3(-chinWidthHalf, chinY, chinZ - chinCurveHeight)
  ]);
  let rightJawToChinLine = $derived([
    new THREE.Vector3(jawWidthDistance, -rimRadius - jawDropDistance, 0),
    new THREE.Vector3(chinWidthHalf, chinY, chinZ - chinCurveHeight)
  ]);

  // Left rim: at x = -cutDistance, facing left (normal = -X)
  let leftRimPoints = $derived(
    circleOnPlane(new THREE.Vector3(-cutDistance, 0, 0), new THREE.Vector3(-1, 0, 0), rimRadius, segments)
  );

  // Right rim: at x = +cutDistance, facing right (normal = +X)
  let rightRimPoints = $derived(
    circleOnPlane(new THREE.Vector3(cutDistance, 0, 0), new THREE.Vector3(1, 0, 0), rimRadius, segments)
  );

  // Cross lines for left rim (horizontal and vertical through center)
  let leftCrossH = $derived([
    new THREE.Vector3(-cutDistance, 0, -rimRadius),
    new THREE.Vector3(-cutDistance, 0, rimRadius)
  ]);
  let leftCrossV = $derived([
    new THREE.Vector3(-cutDistance, -rimRadius, 0),
    new THREE.Vector3(-cutDistance, rimRadius, 0)
  ]);

  // Cross lines for right rim
  let rightCrossH = $derived([
    new THREE.Vector3(cutDistance, 0, -rimRadius),
    new THREE.Vector3(cutDistance, 0, rimRadius)
  ]);
  let rightCrossV = $derived([
    new THREE.Vector3(cutDistance, -rimRadius, 0),
    new THREE.Vector3(cutDistance, rimRadius, 0)
  ]);

  // Rotated points (apply head rotation)
  // Rotate clipped segments for centerline and equator
  let rotatedCenterlineSegments = $derived(
    centerlineClipped.map(seg => rotatePoints(seg, $headRotation))
  );
  let rotatedEquatorSegments = $derived(
    equatorClipped.map(seg => rotatePoints(seg, $headRotation))
  );

  // Rotate feature lines
  let rotatedHairlineSegments = $derived(
    hairlineClipped.map(seg => rotatePoints(seg, $headRotation))
  );
  let rotatedBrowSegments = $derived(
    browClipped.map(seg => rotatePoints(seg, $headRotation))
  );
  // Rotate face plane curves (eye, nose, mouth)
  let rotatedEyeCurve = $derived(rotatePoints(eyeCurvePoints, $headRotation));
  let rotatedNoseCurve = $derived(rotatePoints(noseCurvePoints, $headRotation));
  let rotatedMouthCurve = $derived(rotatePoints(mouthCurvePoints, $headRotation));

  // Rotate chin marker
  let rotatedChinCrossH = $derived(rotatePoints(chinCrossH, $headRotation));
  let rotatedChinCrossV = $derived(rotatePoints(chinCrossV, $headRotation));
  let rotatedChinCrossZ = $derived(rotatePoints(chinCrossZ, $headRotation));
  let rotatedChinLine = $derived(rotatePoints(chinLinePoints, $headRotation));
  let rotatedChinCurve = $derived(rotatePoints(chinCurvePoints, $headRotation));

  let rotatedLeftRim = $derived(rotatePoints(leftRimPoints, $headRotation));
  let rotatedRightRim = $derived(rotatePoints(rightRimPoints, $headRotation));

  // Check if rim planes face the camera (normal.z > 0 means we can see into the cut)
  let leftRimNormal = $derived(
    new THREE.Vector3(-1, 0, 0).applyQuaternion($headRotation)
  );
  let rightRimNormal = $derived(
    new THREE.Vector3(1, 0, 0).applyQuaternion($headRotation)
  );
  let leftRimFacesCamera = $derived(leftRimNormal.z > 0);
  let rightRimFacesCamera = $derived(rightRimNormal.z > 0);

  // Rotated cross lines
  let rotatedLeftCrossH = $derived(rotatePoints(leftCrossH, $headRotation));
  let rotatedLeftCrossV = $derived(rotatePoints(leftCrossV, $headRotation));
  let rotatedRightCrossH = $derived(rotatePoints(rightCrossH, $headRotation));
  let rotatedRightCrossV = $derived(rotatePoints(rightCrossV, $headRotation));

  // Split into front/back segments
  // For clipped circles, we need to split each segment
  let centerlineSplits = $derived(
    rotatedCenterlineSegments.map(seg => splitFrontBack(seg))
  );
  let centerlineFront = $derived(centerlineSplits.flatMap(s => s.front));
  let centerlineBack = $derived(centerlineSplits.flatMap(s => s.back));

  let equatorSplits = $derived(
    rotatedEquatorSegments.map(seg => splitFrontBack(seg))
  );
  let equatorFront = $derived(equatorSplits.flatMap(s => s.front));
  let equatorBack = $derived(equatorSplits.flatMap(s => s.back));

  // Split feature lines into front/back
  let hairlineSplits = $derived(rotatedHairlineSegments.map(seg => splitFrontBack(seg)));
  let hairlineFront = $derived(hairlineSplits.flatMap(s => s.front));
  let hairlineBack = $derived(hairlineSplits.flatMap(s => s.back));

  let browSplits = $derived(rotatedBrowSegments.map(seg => splitFrontBack(seg)));
  let browFront = $derived(browSplits.flatMap(s => s.front));
  let browBack = $derived(browSplits.flatMap(s => s.back));

  // Split face curves into front/back
  let eyeCurveSplit = $derived(splitFrontBack(rotatedEyeCurve));
  let noseCurveSplit = $derived(splitFrontBack(rotatedNoseCurve));
  let mouthCurveSplit = $derived(splitFrontBack(rotatedMouthCurve));

  // Rotate jaw lines
  let rotatedLeftJawLine = $derived(rotatePoints(leftJawLine, $headRotation));
  let rotatedRightJawLine = $derived(rotatePoints(rightJawLine, $headRotation));
  // Split jaw lines into front/back
  let leftJawLineSplit = $derived(splitLine(rotatedLeftJawLine[0], rotatedLeftJawLine[1]));
  let rightJawLineSplit = $derived(splitLine(rotatedRightJawLine[0], rotatedRightJawLine[1]));

  // Rotate and split jaw-to-chin lines
  let rotatedLeftJawToChin = $derived(rotatePoints(leftJawToChinLine, $headRotation));
  let rotatedRightJawToChin = $derived(rotatePoints(rightJawToChinLine, $headRotation));
  let leftJawToChinSplit = $derived(splitLine(rotatedLeftJawToChin[0], rotatedLeftJawToChin[1]));
  let rightJawToChinSplit = $derived(splitLine(rotatedRightJawToChin[0], rotatedRightJawToChin[1]));

  let leftRimSplit = $derived(splitFrontBack(rotatedLeftRim));
  let rightRimSplit = $derived(splitFrontBack(rotatedRightRim));

  // Split cross lines
  let leftCrossHSplit = $derived(splitLine(rotatedLeftCrossH[0], rotatedLeftCrossH[1]));
  let leftCrossVSplit = $derived(splitLine(rotatedLeftCrossV[0], rotatedLeftCrossV[1]));
  let rightCrossHSplit = $derived(splitLine(rotatedRightCrossH[0], rotatedRightCrossH[1]));
  let rightCrossVSplit = $derived(splitLine(rotatedRightCrossV[0], rotatedRightCrossV[1]));

  // Silhouette is now handled via silhouetteSegments (already rotated)

  // Helper to create dashed geometry with line distances computed
  function createDashedGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const tempLine = new THREE.Line(geom);
    tempLine.computeLineDistances();
    return tempLine.geometry;
  }
</script>

<!-- Silhouette circle (clipped at side cuts) -->
{#each silhouetteSegments as segment}
  <T.Line geometry={pointsToGeometry(segment)} material={silhouetteMaterial} />
{/each}

<!-- Centerline (vertical) - front segments -->
{#each centerlineFront as segment}
  <T.Line geometry={pointsToGeometry(segment)} material={guideMaterial} />
{/each}

<!-- Centerline - back segments (dashed) -->
{#if showHiddenLines}
  {#each centerlineBack as segment}
    <T.Line geometry={createDashedGeometry(segment)} material={guideBackMaterial} />
  {/each}
{/if}

<!-- Equator (horizontal) - front segments -->
{#each equatorFront as segment}
  <T.Line geometry={pointsToGeometry(segment)} material={guideMaterial} />
{/each}

<!-- Equator - back segments (dashed) -->
{#if showHiddenLines}
  {#each equatorBack as segment}
    <T.Line geometry={createDashedGeometry(segment)} material={guideBackMaterial} />
  {/each}
{/if}

<!-- Left rim -->
{#if leftRimFacesCamera}
  <!-- Rim faces camera - render entirely solid -->
  <T.Line geometry={pointsToGeometry(rotatedLeftRim)} material={rimMaterial} />
{:else}
  <!-- Rim faces away - use front/back split -->
  {#each leftRimSplit.front as segment}
    <T.Line geometry={pointsToGeometry(segment)} material={rimMaterial} />
  {/each}
  {#if showHiddenLines}
    {#each leftRimSplit.back as segment}
      <T.Line geometry={createDashedGeometry(segment)} material={rimBackMaterial} />
    {/each}
  {/if}
{/if}

<!-- Right rim -->
{#if rightRimFacesCamera}
  <!-- Rim faces camera - render entirely solid -->
  <T.Line geometry={pointsToGeometry(rotatedRightRim)} material={rimMaterial} />
{:else}
  <!-- Rim faces away - use front/back split -->
  {#each rightRimSplit.front as segment}
    <T.Line geometry={pointsToGeometry(segment)} material={rimMaterial} />
  {/each}
  {#if showHiddenLines}
    {#each rightRimSplit.back as segment}
      <T.Line geometry={createDashedGeometry(segment)} material={rimBackMaterial} />
    {/each}
  {/if}
{/if}

<!-- Left rim cross -->
{#if leftRimFacesCamera}
  <!-- Rim faces camera - render cross entirely solid -->
  <T.Line geometry={pointsToGeometry(rotatedLeftCrossH)} material={rimMaterial} />
  <T.Line geometry={pointsToGeometry(rotatedLeftCrossV)} material={rimMaterial} />
{:else}
  <!-- Rim faces away - use front/back split -->
  {#each leftCrossHSplit.front as segment}
    <T.Line geometry={pointsToGeometry(segment)} material={rimMaterial} />
  {/each}
  {#each leftCrossVSplit.front as segment}
    <T.Line geometry={pointsToGeometry(segment)} material={rimMaterial} />
  {/each}
  {#if showHiddenLines}
    {#each leftCrossHSplit.back as segment}
      <T.Line geometry={createDashedGeometry(segment)} material={rimBackMaterial} />
    {/each}
    {#each leftCrossVSplit.back as segment}
      <T.Line geometry={createDashedGeometry(segment)} material={rimBackMaterial} />
    {/each}
  {/if}
{/if}

<!-- Right rim cross -->
{#if rightRimFacesCamera}
  <!-- Rim faces camera - render cross entirely solid -->
  <T.Line geometry={pointsToGeometry(rotatedRightCrossH)} material={rimMaterial} />
  <T.Line geometry={pointsToGeometry(rotatedRightCrossV)} material={rimMaterial} />
{:else}
  <!-- Rim faces away - use front/back split -->
  {#each rightCrossHSplit.front as segment}
    <T.Line geometry={pointsToGeometry(segment)} material={rimMaterial} />
  {/each}
  {#each rightCrossVSplit.front as segment}
    <T.Line geometry={pointsToGeometry(segment)} material={rimMaterial} />
  {/each}
  {#if showHiddenLines}
    {#each rightCrossHSplit.back as segment}
      <T.Line geometry={createDashedGeometry(segment)} material={rimBackMaterial} />
    {/each}
    {#each rightCrossVSplit.back as segment}
      <T.Line geometry={createDashedGeometry(segment)} material={rimBackMaterial} />
    {/each}
  {/if}
{/if}

<!-- Feature Lines -->
<!-- Hairline -->
{#each hairlineFront as segment}
  <T.Line geometry={pointsToGeometry(segment)} material={featureMaterial} />
{/each}
{#if showHiddenLines}
  {#each hairlineBack as segment}
    <T.Line geometry={createDashedGeometry(segment)} material={featureBackMaterial} />
  {/each}
{/if}

<!-- Brow -->
{#each browFront as segment}
  <T.Line geometry={pointsToGeometry(segment)} material={featureMaterial} />
{/each}
{#if showHiddenLines}
  {#each browBack as segment}
    <T.Line geometry={createDashedGeometry(segment)} material={featureBackMaterial} />
  {/each}
{/if}

<!-- Eye Line (face plane curve) - always solid, external to sphere -->
<T.Line geometry={pointsToGeometry(rotatedEyeCurve)} material={featureMaterial} />

<!-- Nose (face plane curve) - always solid, external to sphere -->
<T.Line geometry={pointsToGeometry(rotatedNoseCurve)} material={featureMaterial} />

<!-- Mouth (face plane curve) - always solid, external to sphere -->
<T.Line geometry={pointsToGeometry(rotatedMouthCurve)} material={featureMaterial} />

<!-- Chin marker (3D cross below the sphere) - always solid, external to sphere -->
<T.Line geometry={pointsToGeometry(rotatedChinCrossH)} material={jawMaterial} />
<T.Line geometry={pointsToGeometry(rotatedChinCrossV)} material={jawMaterial} />
<T.Line geometry={pointsToGeometry(rotatedChinCrossZ)} material={jawMaterial} />

<!-- Chin line (from front of sphere to chin) - always solid, external to sphere -->
<T.Line geometry={pointsToGeometry(rotatedChinLine)} material={jawMaterial} />

<!-- Chin curve (parabolic curve at chin) - always solid, external to sphere -->
<T.Line geometry={pointsToGeometry(rotatedChinCurve)} material={jawMaterial} />

<!-- Jaw lines (dropping from side rims) - always solid, external to sphere -->
<T.Line geometry={pointsToGeometry(rotatedLeftJawLine)} material={jawMaterial} />
<T.Line geometry={pointsToGeometry(rotatedRightJawLine)} material={jawMaterial} />

<!-- Jaw-to-chin connection lines - always solid, external to sphere -->
<T.Line geometry={pointsToGeometry(rotatedLeftJawToChin)} material={jawMaterial} />
<T.Line geometry={pointsToGeometry(rotatedRightJawToChin)} material={jawMaterial} />
