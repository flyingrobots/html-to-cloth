import * as THREE from 'three'

import type { EngineWorld, EngineSystem } from '../types'
import { CameraSpring, type CameraSpringOptions, type MutableCameraSnapshot } from './CameraSpring'

export type CameraSnapshot = Readonly<MutableCameraSnapshot>

/**
 * Engine system facade that owns a spring-driven camera and exposes read-only snapshots.
 */
export class CameraSystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly spring: CameraSpring
  private readonly snapshot: MutableCameraSnapshot
  private world: EngineWorld | null = null

  constructor(options: CameraSpringOptions = {}) {
    this.spring = new CameraSpring(options)
    this.snapshot = this.spring.getSnapshot()
  }

  /**
   * Stores the engine world reference on attachment.
   */
  onAttach(world: EngineWorld) {
    this.world = world
  }

  /**
   * Clears the world reference once detached.
   */
  onDetach() {
    this.world = null
  }

  /**
   * Advances the camera and refreshes its pooled snapshot.
   */
  fixedUpdate(dt: number) {
    this.spring.update(dt)
    this.spring.getSnapshot(this.snapshot)
  }

  /**
   * Returns the latest pooled snapshot. Treat as read-only.
   */
  getSnapshot() {
    return this.snapshot
  }

  /**
   * Copies the latest snapshot into a caller-managed structure for custom pooling.
   */
  copySnapshot(target: MutableCameraSnapshot) {
    target.position.copy(this.snapshot.position)
    target.velocity.copy(this.snapshot.velocity)
    target.target.copy(this.snapshot.target)
    target.zoom = this.snapshot.zoom
    target.zoomVelocity = this.snapshot.zoomVelocity
    target.targetZoom = this.snapshot.targetZoom
    return target
  }

  /**
   * Adjusts the spring target the camera will move toward.
   */
  setTarget(position: THREE.Vector3) {
    this.spring.setTarget(position)
  }

  /**
   * Updates the desired zoom level.
   */
  setTargetZoom(zoom: number) {
    this.spring.setTargetZoom(zoom)
  }

  /**
   * Instantly teleports the camera to a position/zoom without oscillation.
   */
  jumpTo(position: THREE.Vector3, zoom?: number) {
    this.spring.setTarget(position)
    this.spring.setPosition(position)
    if (zoom !== undefined) {
      this.spring.setTargetZoom(zoom)
      this.spring.setZoom(zoom)
    }
    this.spring.jumpToTarget()
    this.spring.getSnapshot(this.snapshot)
  }

  /**
   * Tweaks spring constants on the fly.
   */
  configure(options: Partial<Omit<CameraSpringOptions, 'position' | 'target' | 'zoom' | 'targetZoom'>>) {
    this.spring.configure(options)
  }

  /**
   * Returns the currently attached engine world, if any.
   */
  getWorld() {
    return this.world
  }
}
