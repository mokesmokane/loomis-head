import * as THREE from 'three';

export interface Landmark {
  name: string;
  position: THREE.Vector3;
  color?: string;
}

export interface ProjectedLandmark {
  name: string;
  x: number;
  y: number;
  visible: boolean; // Whether the point is facing the camera
}

export interface HeadParams {
  radius: number;
  sideCut: number;
  hairlinePos: number;
  browPos: number;
  eyeLinePos: number;
  nosePos: number;
  mouthPos: number;
  eyeWidth: number;
  noseWidth: number;
  mouthWidth: number;
  eyeCurve: number;
  noseCurve: number;
  mouthCurve: number;
  chinPos: number;
  chinWidth: number;
  chinCurve: number;
  chinLineCurve: number;
  jawDrop: number;
  jawWidth: number;
}

/**
 * Get z-position on face curve for a given y-position.
 * Features above equator stay at sphere front, features below follow the face curve.
 */
function getFaceCurveZ(yPos: number, radius: number, chinY: number, chinZ: number): number {
  if (yPos >= 0) {
    // On or above equator - stay at front of sphere
    return radius;
  }
  // Below equator - interpolate between sphere front and chin z
  const sphereBottomY = -radius;
  const t = (yPos - 0) / (chinY - 0); // 0 at equator, 1 at chin
  // Quadratic ease - more curve near chin
  const tEased = t * t;
  return radius + tEased * (chinZ - radius);
}

/**
 * Calculate 3D landmark positions in head space (before rotation).
 */
export function calculateLandmarks(params: HeadParams): Landmark[] {
  const {
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
  } = params;

  // Calculate derived values
  const chinY = -radius - chinPos * radius;
  const chinZ = radius - chinLineCurve * radius;

  const eyeLineY = eyeLinePos * radius;
  const noseLineY = nosePos * radius;
  const mouthLineY = mouthPos * radius;

  const eyeWidthHalf = eyeWidth * radius;
  const noseWidthHalf = noseWidth * radius;
  const mouthWidthHalf = mouthWidth * radius;
  const chinWidthHalf = chinWidth * radius;

  // Curve depths for face features (edges curve back by this amount)
  const eyeCurveDepth = eyeCurve * radius;
  const noseCurveDepth = noseCurve * radius;
  const mouthCurveDepth = mouthCurve * radius;
  const chinCurveHeight = chinCurve * radius;

  // Calculate rim radius (for jaw drop positioning)
  const cutDistance = sideCut * radius;
  const rimRadius = Math.sqrt(radius * radius - cutDistance * cutDistance);
  const jawDropDistance = jawDrop * radius;
  const jawWidthDistance = jawWidth * radius;

  // Helper to get point on sphere surface at given y ratio
  function getPointOnSphereFront(yRatio: number): THREE.Vector3 {
    const y = yRatio * radius;
    const rSquared = radius * radius - y * y;
    const z = rSquared > 0 ? Math.sqrt(rSquared) : 0;
    return new THREE.Vector3(0, y, z);
  }

  const landmarks: Landmark[] = [
    // Center of cranial sphere (for compass use)
    {
      name: 'Sphere Center',
      position: new THREE.Vector3(0, 0, 0),
      color: '#ff00ff'
    },
    // Crown (top of head)
    {
      name: 'Crown',
      position: new THREE.Vector3(0, radius, 0),
      color: '#4ecdc4'
    },
    // Hairline center
    {
      name: 'Hairline',
      position: getPointOnSphereFront(hairlinePos),
      color: '#ffd93d'
    },
    // Brow center
    {
      name: 'Brow',
      position: getPointOnSphereFront(browPos),
      color: '#ffd93d'
    },
    // Eye line - center and sides (edges curve back by eyeCurveDepth)
    {
      name: 'Eye Center',
      position: new THREE.Vector3(0, eyeLineY, getFaceCurveZ(eyeLineY, radius, chinY, chinZ)),
      color: '#ff6b6b'
    },
    {
      name: 'Eye Left',
      position: new THREE.Vector3(-eyeWidthHalf, eyeLineY, getFaceCurveZ(eyeLineY, radius, chinY, chinZ) - eyeCurveDepth),
      color: '#ff6b6b'
    },
    {
      name: 'Eye Right',
      position: new THREE.Vector3(eyeWidthHalf, eyeLineY, getFaceCurveZ(eyeLineY, radius, chinY, chinZ) - eyeCurveDepth),
      color: '#ff6b6b'
    },
    // Nose - center and sides (edges curve back by noseCurveDepth)
    {
      name: 'Nose Center',
      position: new THREE.Vector3(0, noseLineY, getFaceCurveZ(noseLineY, radius, chinY, chinZ)),
      color: '#ff6b6b'
    },
    {
      name: 'Nose Left',
      position: new THREE.Vector3(-noseWidthHalf, noseLineY, getFaceCurveZ(noseLineY, radius, chinY, chinZ) - noseCurveDepth),
      color: '#ff6b6b'
    },
    {
      name: 'Nose Right',
      position: new THREE.Vector3(noseWidthHalf, noseLineY, getFaceCurveZ(noseLineY, radius, chinY, chinZ) - noseCurveDepth),
      color: '#ff6b6b'
    },
    // Mouth - center and sides (edges curve back by mouthCurveDepth)
    {
      name: 'Mouth Center',
      position: new THREE.Vector3(0, mouthLineY, getFaceCurveZ(mouthLineY, radius, chinY, chinZ)),
      color: '#ff6b6b'
    },
    {
      name: 'Mouth Left',
      position: new THREE.Vector3(-mouthWidthHalf, mouthLineY, getFaceCurveZ(mouthLineY, radius, chinY, chinZ) - mouthCurveDepth),
      color: '#ff6b6b'
    },
    {
      name: 'Mouth Right',
      position: new THREE.Vector3(mouthWidthHalf, mouthLineY, getFaceCurveZ(mouthLineY, radius, chinY, chinZ) - mouthCurveDepth),
      color: '#ff6b6b'
    },
    // Chin center
    {
      name: 'Chin',
      position: new THREE.Vector3(0, chinY, chinZ),
      color: '#45b7d1'
    },
    // Chin curve corners (edges curve back by chinCurveHeight)
    {
      name: 'Chin Left',
      position: new THREE.Vector3(-chinWidthHalf, chinY, chinZ - chinCurveHeight),
      color: '#45b7d1'
    },
    {
      name: 'Chin Right',
      position: new THREE.Vector3(chinWidthHalf, chinY, chinZ - chinCurveHeight),
      color: '#45b7d1'
    },
    // Jaw start points (at bottom of side rims, connected to sphere)
    {
      name: 'Jaw Start Left',
      position: new THREE.Vector3(-cutDistance, -rimRadius, 0),
      color: '#45b7d1'
    },
    {
      name: 'Jaw Start Right',
      position: new THREE.Vector3(cutDistance, -rimRadius, 0),
      color: '#45b7d1'
    },
    // Jaw drop end points (after dropping down)
    {
      name: 'Jaw Drop Left',
      position: new THREE.Vector3(-jawWidthDistance, -rimRadius - jawDropDistance, 0),
      color: '#45b7d1'
    },
    {
      name: 'Jaw Drop Right',
      position: new THREE.Vector3(jawWidthDistance, -rimRadius - jawDropDistance, 0),
      color: '#45b7d1'
    }
  ];

  return landmarks;
}

/**
 * Transform landmarks from head space to world space using rotation and pan.
 */
export function transformLandmarks(
  landmarks: Landmark[],
  rotation: THREE.Quaternion,
  pan: { x: number; y: number }
): Landmark[] {
  return landmarks.map(landmark => ({
    ...landmark,
    position: landmark.position.clone()
      .applyQuaternion(rotation)
      .add(new THREE.Vector3(pan.x, pan.y, 0))
  }));
}

/**
 * Project 3D landmarks to 2D canvas coordinates.
 * Uses orthographic projection matching the camera setup.
 */
export function projectLandmarks(
  landmarks: Landmark[],
  canvasWidth: number,
  canvasHeight: number
): ProjectedLandmark[] {
  // Orthographic camera frustum matches canvas size
  // Camera looks down -Z axis, so:
  // - X maps directly to canvas X
  // - Y maps to canvas Y (inverted)
  // - Z determines visibility (positive = facing camera)

  return landmarks.map(landmark => {
    const pos = landmark.position;

    // Convert from 3D world coords to canvas coords
    // World: center is (0,0), X+ is right, Y+ is up
    // Canvas: origin is top-left, X+ is right, Y+ is down
    const x = canvasWidth / 2 + pos.x;
    const y = canvasHeight / 2 - pos.y;

    // Point is visible if z >= 0 (facing camera)
    const visible = pos.z >= 0;

    return {
      name: landmark.name,
      x: Math.round(x),
      y: Math.round(y),
      visible
    };
  });
}
