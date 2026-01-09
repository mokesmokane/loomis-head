# Loomis Head Projector - Implementation Plan v2

## Overview
Rewrite the Loomis head projector to replicate the approach from the [loomis-head-krita](https://github.com/lm0ss/loomis-head-krita) plugin, which provides mathematically correct 3D head construction.

## Key Changes from Current Implementation

### Problem with Current Approach
- Using **perspective camera** causes circles of the same radius to appear different sizes
- Billboard approach (lookAt) doesn't align correctly with fixed circles
- Circles don't match when rotated due to perspective distortion

### Solution: Replicate Krita Plugin Approach
1. **Orthographic camera** - No perspective distortion, circles align perfectly
2. **Rotate the head, not the camera** - Head rotates via quaternion, camera stays fixed
3. **Proper 3D circle generation** - Circles defined by plane normal + center + radius
4. **Front/back visibility** - Back-facing parts render dashed at reduced opacity

---

## Technical Approach

### 1. Orthographic Camera
```
- Camera type: OrthographicCamera (not PerspectiveCamera)
- Position: Fixed at [0, 0, 5] looking at origin
- No OrbitControls on camera - head rotates instead
- Zoom controlled by camera frustum size, not position
```

### 2. Head Rotation (Quaternion-based)
```
- Store rotation as quaternion state
- Mouse drag updates quaternion (trackball-style)
- Apply quaternion to all head geometry each frame
- Camera remains stationary
```

### 3. Circle Generation Math

**Circle on arbitrary plane:**
```
Given: center, normal (plane), radius
1. Create orthonormal basis (u, v) perpendicular to normal
2. Points: p(t) = center + u*cos(t)*r + v*sin(t)*r
3. Sample t from 0 to 2π (64-256 points for smooth curve)
```

**Side cut math:**
```
side_cut = 0.66 (ratio, adjustable)
d = side_cut * radius  // distance from center
rim_radius = √(radius² - d²)  // radius of side rim circle
```

### 4. Loomis Head Shapes

| Shape | Description | Plane Normal | Center | Radius |
|-------|-------------|--------------|--------|--------|
| **Silhouette** | Outline facing camera | view direction | origin | R |
| **Centerline** | Vertical great circle | X-axis (1,0,0) | origin | R |
| **Equator** | Horizontal great circle | Y-axis (0,1,0) | origin | R |
| **Left Rim** | Side cutoff circle | X-axis (1,0,0) | (-d, 0, 0) | rim_r |
| **Right Rim** | Side cutoff circle | X-axis (-1,0,0) | (d, 0, 0) | rim_r |

### 5. Front/Back Visibility

For each circle segment:
1. Transform points by head quaternion
2. Check Z-coordinate (camera space): z > 0 = front, z < 0 = back
3. **Front segments**: solid line, full opacity
4. **Back segments**: dashed line, 60% opacity

---

## Implementation Steps

### Step 1: Switch to Orthographic Camera
**File:** `src/lib/components/Scene.svelte`
- Replace `T.PerspectiveCamera` with `T.OrthographicCamera`
- Set frustum based on viewport size
- Remove OrbitControls from camera
- Add resize handling to maintain aspect ratio

### Step 2: Create Rotation State & Trackball Controls
**New file:** `src/lib/stores/rotation.ts`
- Svelte store holding quaternion state
- Initial rotation: identity quaternion

**New file:** `src/lib/components/TrackballControls.svelte`
- Mouse drag handler (pointer down/move/up)
- Convert mouse delta to axis-angle rotation
- Multiply with current quaternion
- Update store

### Step 3: Circle Generation Utility
**New file:** `src/lib/utils/geometry.ts`
```typescript
// Create orthonormal basis from normal vector
function basisFromNormal(n: Vector3): [Vector3, Vector3]

// Generate circle points on a plane
function circleOnPlane(
  center: Vector3,
  normal: Vector3,
  radius: number,
  segments: number
): Vector3[]

// Split points into front/back based on Z
function splitFrontBack(points: Vector3[]): {
  front: Vector3[][],
  back: Vector3[][]
}
```

### Step 4: Create LoomisHead3D Component
**New file:** `src/lib/components/LoomisHead3D.svelte`

Props:
- `radius: number` - sphere radius
- `sideCut: number` - side cut ratio (default 0.66)
- `quaternion: Quaternion` - rotation state

Generated shapes:
1. Silhouette circle (perpendicular to camera)
2. Centerline circle (YZ plane)
3. Equator circle (XZ plane)
4. Left rim circle
5. Right rim circle

Each shape:
- Generate 3D points
- Apply quaternion rotation
- Split front/back
- Render front as solid, back as dashed

### Step 5: Dashed Line Material
**Update:** `src/lib/components/LoomisHead3D.svelte`
- Use `THREE.LineDashedMaterial` for back segments
- Set dashSize, gapSize, opacity
- Call `computeLineDistances()` on geometry

### Step 6: Update Main Page
**File:** `src/routes/+page.svelte`
- Import rotation store
- Pass quaternion to LoomisHead3D
- Add TrackballControls
- Update debug panel with rotation info

---

## File Structure After Refactor

```
src/
├── lib/
│   ├── components/
│   │   ├── Scene.svelte           # Orthographic camera setup
│   │   ├── LoomisHead3D.svelte    # Main head with all circles
│   │   ├── TrackballControls.svelte # Mouse rotation handling
│   │   └── Circle3D.svelte        # Reusable circle component
│   ├── stores/
│   │   └── rotation.ts            # Quaternion state
│   └── utils/
│       └── geometry.ts            # Circle generation math
├── routes/
│   └── +page.svelte               # Main page
```

---

## Parameters (Matching Krita Plugin)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `radius` | 1.0 | Sphere radius |
| `sideCut` | 0.66 | Side cut ratio (0.05 - 0.9) |
| `showCenterline` | true | Show vertical center circle |
| `showEquator` | true | Show horizontal circle |
| `showRims` | true | Show side rim circles |
| `showSilhouette` | true | Show outline circle |

---

## Colors (From Current Implementation)

| Element | Color | Hex |
|---------|-------|-----|
| Silhouette | Teal | #4ecdc4 |
| Centerline | Yellow | #ffd93d |
| Equator | Yellow | #ffd93d |
| Side Rims | Purple | #c792ea |
| Back segments | Same, 60% opacity | - |

---

## Verification

1. **Circles align**: When silhouette and centerline overlap (viewed from side), they should be exactly the same size
2. **Rotation works**: Drag to rotate head smoothly in all directions
3. **Front/back**: Back-facing parts appear dashed and faded
4. **Resize works**: Scroll to change radius, all circles scale proportionally
5. **Side rims correct**: Rim circles sit exactly on sphere surface at distance `d`

---

## Math Reference

### Quaternion Rotation
```
v' = q * v * q⁻¹
where q is quaternion, v is vector (as quaternion with w=0)
```

### Circle on Plane
```
Given normal n, find basis vectors u, v:
1. Pick axis a with minimum |n·a|
2. u = normalize(n × a)
3. v = n × u

Point at angle t:
p(t) = center + r*cos(t)*u + r*sin(t)*v
```

### Side Rim Radius
```
d = sideCut * R
rimRadius = √(R² - d²)
```

### Front/Back Test
```
After rotation, point is front-facing if z > 0
(assuming camera looks down -Z axis)
```
