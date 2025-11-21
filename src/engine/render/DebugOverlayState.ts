import * as THREE from 'three'
import type { SimWorldSnapshot as SimSnapshot } from '../../lib/simWorld'

export type CollisionAABB = {
  min: { x: number; y: number }
  max: { x: number; y: number }
}

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
  /** Whether to highlight recently woken bodies (neighbor-wake). */
  drawWake = false
  /** World-space positions of recently woken bodies (small pulsing markers). */
  wakeMarkers: Array<{ x: number; y: number }> = []
  /** Static collision AABBs (canonical coordinates). */
  aabbs: CollisionAABB[] = []
  /** Simulation snapshot for sleeping/awake coloring of gizmos. */
  simSnapshot?: Readonly<SimSnapshot>
  /** World-space pin markers (small crosses). */
  pinMarkers: Array<{ x: number; y: number }> = []
  /** Debug representation of rigid bodies (centers + half extents). */
  rigidBodies: Array<{ id: number; center: { x: number; y: number }; half: { x: number; y: number } }> = []
}
