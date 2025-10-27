import * as THREE from 'three'

/** Shared state read by DebugOverlaySystem and writable from UI/controller. */
export class DebugOverlayState {
  /** World-space pointer position in canonical meters. */
  readonly pointer = new THREE.Vector2()
  /** Whether the pointer collider gizmo should be visible. */
  visible = false
}

