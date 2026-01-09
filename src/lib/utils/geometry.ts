import * as THREE from 'three';

/**
 * Create an orthonormal basis (u, v) from a normal vector.
 * Used to define a plane perpendicular to the normal.
 */
export function basisFromNormal(n: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  // Find axis with minimum dot product to n
  const absX = Math.abs(n.x);
  const absY = Math.abs(n.y);
  const absZ = Math.abs(n.z);

  let axis: THREE.Vector3;
  if (absX <= absY && absX <= absZ) {
    axis = new THREE.Vector3(1, 0, 0);
  } else if (absY <= absZ) {
    axis = new THREE.Vector3(0, 1, 0);
  } else {
    axis = new THREE.Vector3(0, 0, 1);
  }

  // u = normalize(n × axis)
  const u = new THREE.Vector3().crossVectors(n, axis).normalize();
  // v = n × u
  const v = new THREE.Vector3().crossVectors(n, u);

  return [u, v];
}

/**
 * Generate points for a circle on an arbitrary plane.
 * @param center - Center of the circle
 * @param normal - Normal vector of the plane (circle faces this direction)
 * @param radius - Radius of the circle
 * @param segments - Number of points to generate
 * @returns Array of Vector3 points forming the circle
 */
export function circleOnPlane(
  center: THREE.Vector3,
  normal: THREE.Vector3,
  radius: number,
  segments: number = 64
): THREE.Vector3[] {
  const [u, v] = basisFromNormal(normal.clone().normalize());
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const point = new THREE.Vector3()
      .addScaledVector(u, Math.cos(t) * radius)
      .addScaledVector(v, Math.sin(t) * radius)
      .add(center);
    points.push(point);
  }

  return points;
}

/**
 * Apply quaternion rotation to an array of points.
 */
export function rotatePoints(points: THREE.Vector3[], quaternion: THREE.Quaternion): THREE.Vector3[] {
  return points.map(p => p.clone().applyQuaternion(quaternion));
}

/**
 * Split points into front and back segments based on Z coordinate.
 * Front = z >= 0 (facing camera), Back = z < 0 (away from camera)
 * Returns arrays of continuous segments.
 */
export function splitFrontBack(points: THREE.Vector3[]): {
  front: THREE.Vector3[][];
  back: THREE.Vector3[][];
} {
  const front: THREE.Vector3[][] = [];
  const back: THREE.Vector3[][] = [];

  let currentFront: THREE.Vector3[] = [];
  let currentBack: THREE.Vector3[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const isFront = point.z >= 0;

    if (isFront) {
      // Add to front segment
      if (currentBack.length > 0) {
        // Transitioning from back to front
        back.push(currentBack);
        currentBack = [];
      }
      currentFront.push(point);
    } else {
      // Add to back segment
      if (currentFront.length > 0) {
        // Transitioning from front to back
        front.push(currentFront);
        currentFront = [];
      }
      currentBack.push(point);
    }
  }

  // Push remaining segments
  if (currentFront.length > 0) front.push(currentFront);
  if (currentBack.length > 0) back.push(currentBack);

  return { front, back };
}

/**
 * Create a BufferGeometry from an array of points (for Line rendering).
 */
export function pointsToGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return geometry;
}

/**
 * Create a BufferGeometry for dashed lines (requires computeLineDistances).
 */
export function pointsToDashedGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  // Required for dashed lines to work
  const line = new THREE.Line(geometry);
  line.computeLineDistances();
  return line.geometry;
}

/**
 * Calculate the rim radius for a side cut.
 * When you slice a sphere of radius R at distance d from center,
 * the resulting circle has radius sqrt(R² - d²).
 */
export function calculateRimRadius(sphereRadius: number, cutDistance: number): number {
  const rSquared = sphereRadius * sphereRadius - cutDistance * cutDistance;
  return Math.sqrt(Math.max(0, rSquared));
}

const EPS = 1e-6;

/**
 * Linear interpolation between two 3D points.
 */
function lerp3(p0: THREE.Vector3, p1: THREE.Vector3, t: number): THREE.Vector3 {
  return new THREE.Vector3().lerpVectors(p0, p1, t);
}

/**
 * Find intersection point where a line segment crosses x = boundary.
 * Returns null if segment doesn't cross the boundary.
 */
function intersectX(p0: THREE.Vector3, p1: THREE.Vector3, boundary: number): THREE.Vector3 | null {
  const dx = p1.x - p0.x;
  if (Math.abs(dx) < EPS) return null;

  const t = (boundary - p0.x) / dx;
  if (t >= 0 && t <= 1) {
    return lerp3(p0, p1, t);
  }
  return null;
}

/**
 * Clip a polyline (array of points) to the band where |x| <= d.
 * Returns an array of segments, each segment being an array of points.
 * Parts where |x| > d are removed.
 */
export function clipToSideBand(points: THREE.Vector3[], d: number): THREE.Vector3[][] {
  const segments: THREE.Vector3[][] = [];
  const n = points.length;

  if (n < 2) return segments;

  function isInside(p: THREE.Vector3): boolean {
    return Math.abs(p.x) <= d + EPS;
  }

  let currentSegment: THREE.Vector3[] = [];

  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const currInside = isInside(curr);

    if (i === 0) {
      // First point
      if (currInside) {
        currentSegment.push(curr.clone());
      }
      continue;
    }

    const prev = points[i - 1];
    const prevInside = isInside(prev);

    if (prevInside && currInside) {
      // Both inside - continue segment
      currentSegment.push(curr.clone());
    } else if (prevInside && !currInside) {
      // Exiting the band - find intersection and close segment
      const boundary = curr.x > d ? d : -d;
      const intersection = intersectX(prev, curr, boundary);
      if (intersection) {
        currentSegment.push(intersection);
      }
      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }
      currentSegment = [];
    } else if (!prevInside && currInside) {
      // Entering the band - find intersection and start new segment
      const boundary = prev.x > d ? d : -d;
      const intersection = intersectX(prev, curr, boundary);
      if (intersection) {
        currentSegment = [intersection, curr.clone()];
      } else {
        currentSegment = [curr.clone()];
      }
    } else {
      // Both outside - check if segment crosses entire band
      // (from one side to the other, passing through)
      if ((prev.x < -d && curr.x > d) || (prev.x > d && curr.x < -d)) {
        const int1 = intersectX(prev, curr, -d);
        const int2 = intersectX(prev, curr, d);
        if (int1 && int2) {
          // Order by parameter t
          if (prev.x < curr.x) {
            segments.push([int1, int2]);
          } else {
            segments.push([int2, int1]);
          }
        }
      }
    }
  }

  // Push remaining segment
  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  return segments;
}
