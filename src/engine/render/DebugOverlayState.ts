import * as THREE from 'three'
import type { SimWorldSnapshot as SimSnapshot } from '../../lib/simWorld'

export type CollisionAABB = {
  min: { x: number; y: number }
  max: { x: number; y: number }
}

export type WorldSphere = {
  center: { x: number; y: number }
  radius: number
}

/** Shared state read by DebugOverlaySystem and writable from UI/controller. */
export class DebugOverlayState {
  /** World-space pointer position in canonical meters. */
  readonly pointer = new THREE.Vector2()
  /** World-space pointer collider radius (meters) for the gizmo. */
  pointerRadius = 0.01
  /** Whether the pointer collider gizmo should be visible. */
  visible = false
  /** Whether to draw static AABBs when visible. */
  drawAABBs = false
  /** Whether to draw sleep/awake state circles when visible. */
  drawSleep = false
  /** Whether to draw pin markers when visible. */
  drawPins = false
  /** Whether to draw world-space bounding spheres (static and/or sim). */
  drawSpheres = false
  /** Static collision AABBs (canonical coordinates). */
  aabbs: CollisionAABB[] = []
  /** Static world-space spheres (derived from AABBs). */
  staticSpheres: WorldSphere[] = []
  /** Simulation snapshot for sleeping/awake coloring of gizmos. */
  simSnapshot?: Readonly<SimSnapshot>
  /** World-space pin markers (small crosses). */
  pinMarkers: Array<{ x: number; y: number }> = []
}
