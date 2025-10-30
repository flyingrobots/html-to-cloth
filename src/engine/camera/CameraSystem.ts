import * as THREE from 'three'

import type { EngineSystem } from '../types'
import type { EngineWorld } from '../world'
import { CameraSpring, type CameraSpringOptions, type MutableCameraSnapshot } from './CameraSpring'

export type CameraSnapshot = Readonly<MutableCameraSnapshot>

/**
 * Engine system facade that owns a spring-driven camera and exposes read-only snapshots.
 */
export class CameraSystem implements EngineSystem<EngineWorld> {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly spring: CameraSpring
  private readonly snapshot: MutableCameraSnapshot
  private world: EngineWorld | null = null

  /**
   * @param {CameraSpringOptions} [options]
   */
  constructor(options: CameraSpringOptions = {}) {
    this.spring = new CameraSpring(options)
    this.snapshot = this.spring.getSnapshot()
  }

  /**
   * Stores the engine world reference on attachment.
   *
   * @param {EngineWorld} world
   * @returns {void}
   */
  onAttach(world: EngineWorld) {
    this.world = world
  }

  /**
   * Clears the world reference once detached.
   *
   * @returns {void}
   */
  onDetach() {
    this.world = null
  }

  /**
   * Advances the camera and refreshes its pooled snapshot.
   *
   * @param {number} dt
   * @returns {void}
   */
  fixedUpdate(dt: number) {
    this.spring.update(dt)
    this.spring.getSnapshot(this.snapshot)
  }

  /**
   * Returns an immutable deep copy of the latest camera snapshot.
   *
   * Note: The system maintains a pooled, mutable snapshot internally for
   * performance. This method defensively clones all vector fields and copies
   * primitive fields, then freezes the result so callers cannot mutate pooled
   * state by accident.
   *
   * @returns {CameraSnapshot} A frozen copy safe for external use.
   */
  getSnapshot(): CameraSnapshot {
    const src = this.snapshot
    const copy = {
      position: src.position.clone(),
      velocity: src.velocity.clone(),
      target: src.target.clone(),
      zoom: src.zoom,
      zoomVelocity: src.zoomVelocity,
      targetZoom: src.targetZoom,
    } as const
    // Freeze vector objects and the container to prevent mutation.
    Object.freeze(copy.position)
    Object.freeze(copy.velocity)
    Object.freeze(copy.target)
    return Object.freeze(copy) as unknown as CameraSnapshot
  }

  /**
   * Copies the latest snapshot into a caller-managed structure for custom pooling.
   *
   * @param {MutableCameraSnapshot} target
   * @returns {MutableCameraSnapshot}
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
   *
   * @param {THREE.Vector3} position
   * @returns {void}
   */
  setTarget(position: THREE.Vector3) {
    this.spring.setTarget(position)
  }

  /**
   * Updates the desired zoom level.
   *
   * @param {number} zoom
   * @returns {void}
   */
  setTargetZoom(zoom: number) {
    this.spring.setTargetZoom(zoom)
  }

  /**
   * Instantly teleports the camera to a position/zoom without oscillation.
   *
   * @param {THREE.Vector3} position
   * @param {number} [zoom]
   * @returns {void}
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
   *
   * @param {Partial<Omit<CameraSpringOptions, 'position' | 'target' | 'zoom' | 'targetZoom'>>} options
   * @returns {void}
   */
  configure(options: Partial<Omit<CameraSpringOptions, 'position' | 'target' | 'zoom' | 'targetZoom'>>) {
    this.spring.configure(options)
  }

  /**
   * Returns the currently attached engine world, if any.
   *
   * @returns {EngineWorld | null}
   */
  getWorld() {
    return this.world
  }
}
