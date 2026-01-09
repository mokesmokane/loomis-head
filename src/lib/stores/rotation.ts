import { writable } from 'svelte/store';
import * as THREE from 'three';

/**
 * Store for the head rotation quaternion.
 * This controls the orientation of the Loomis head.
 */
export const headRotation = writable(new THREE.Quaternion());

/**
 * Store for the head pan offset (X, Y translation).
 */
export const headPan = writable({ x: 0, y: 0 });

/**
 * Apply an incremental rotation to the current quaternion (world space).
 * @param axis - Rotation axis (normalized)
 * @param angle - Rotation angle in radians
 */
export function applyRotation(axis: THREE.Vector3, angle: number) {
  headRotation.update(q => {
    const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return q.clone().premultiply(deltaQ);
  });
}

/**
 * Apply rotation in local (head) space.
 * @param axis - Rotation axis in head space
 * @param angle - Rotation angle in radians
 */
export function applyLocalRotation(axis: THREE.Vector3, angle: number) {
  headRotation.update(q => {
    const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return q.clone().multiply(deltaQ); // post-multiply for local space
  });
}

/**
 * Reset rotation to identity (no rotation).
 */
export function resetRotation() {
  headRotation.set(new THREE.Quaternion());
}

/**
 * Apply an incremental pan offset.
 * @param dx - Delta X in screen units
 * @param dy - Delta Y in screen units
 */
export function applyPan(dx: number, dy: number) {
  headPan.update(p => ({ x: p.x + dx, y: p.y + dy }));
}

/**
 * Reset pan to origin.
 */
export function resetPan() {
  headPan.set({ x: 0, y: 0 });
}

/**
 * Set rotation from Euler angles (for convenience).
 * @param x - Rotation around X axis (radians)
 * @param y - Rotation around Y axis (radians)
 * @param z - Rotation around Z axis (radians)
 */
export function setRotationFromEuler(x: number, y: number, z: number) {
  const euler = new THREE.Euler(x, y, z, 'XYZ');
  headRotation.set(new THREE.Quaternion().setFromEuler(euler));
}
