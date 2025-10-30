import * as THREE from 'three'

/** Shared state read by DebugOverlaySystem and writable from UI/controller. */
export class DebugOverlayState {
  /** World-space pointer position in canonical meters. */
  readonly pointer = new THREE.Vector2()
  /** Whether the pointer collider gizmo should be visible. */
  visible = false
  /** Whether to draw static AABBs when visible. */
  drawAABBs = false
  /** Whether to draw sleep/awake state circles when visible. */
  drawSleep = false
  /** Whether to draw pin markers when visible. */
  drawPins = false
  /** Static collision AABBs (canonical coordinates). */
  aabbs: Array<{ min: { x: number; y: number }; max: { x: number; y: number } }> = []
  /** Simulation snapshot for sleeping/awake coloring of gizmos. */
  simSnapshot?: { bodies: Array<{ id: string; center: { x: number; y: number }; radius: number; sleeping: boolean }> }
  /** World-space pin markers (small crosses). */
  pinMarkers: Array<{ x: number; y: number }> = []
}
