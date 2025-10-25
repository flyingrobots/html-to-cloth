import * as THREE from 'three'

/**
 * User-adjustable parameters used to bootstrap and tune the camera spring.
 */
export type CameraSpringOptions = {
  stiffness?: number
  damping?: number
  zoomStiffness?: number
  zoomDamping?: number
  position?: THREE.Vector3
  target?: THREE.Vector3
  zoom?: number
  targetZoom?: number
}

/**
 * Mutable structure reused internally for snapshot pooling.
 */
export type MutableCameraSnapshot = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  target: THREE.Vector3
  zoom: number
  zoomVelocity: number
  targetZoom: number
}

export type CameraSnapshot = Readonly<MutableCameraSnapshot>

/**
 * Maximum delta time (in seconds) integrated per step to avoid overshooting.
 */
export const CAMERA_SPRING_MAX_DELTA = 1 / 30

const DEFAULT_STIFFNESS = 120
const DEFAULT_DAMPING = 20

const createMutableSnapshot = (): MutableCameraSnapshot => ({
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  target: new THREE.Vector3(),
  zoom: 1,
  zoomVelocity: 0,
  targetZoom: 1,
})

/**
 * Critically damped spring that eases camera position and zoom toward a moving target.
 */
export class CameraSpring {
  private readonly position = new THREE.Vector3()
  private readonly velocity = new THREE.Vector3()
  private readonly target = new THREE.Vector3()
  private readonly offset = new THREE.Vector3()
  private readonly dampingForce = new THREE.Vector3()
  private readonly acceleration = new THREE.Vector3()

  private zoom = 1
  private zoomVelocity = 0
  private targetZoom = 1

  private stiffness: number
  private damping: number
  private zoomStiffness: number
  private zoomDamping: number

  constructor(options: CameraSpringOptions = {}) {
    this.stiffness = options.stiffness ?? DEFAULT_STIFFNESS
    this.damping = options.damping ?? DEFAULT_DAMPING
    this.zoomStiffness = options.zoomStiffness ?? DEFAULT_STIFFNESS
    this.zoomDamping = options.zoomDamping ?? DEFAULT_DAMPING

    if (options.position) {
      this.position.copy(options.position)
    }
    if (options.target) {
      this.target.copy(options.target)
    }
    if (options.zoom !== undefined) {
      this.zoom = options.zoom
    }
    if (options.targetZoom !== undefined) {
      this.targetZoom = options.targetZoom
    } else {
      this.targetZoom = this.zoom
    }
  }

  /**
   * Advances the spring simulation, subdividing large deltas to maintain stability.
   */
  update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return

    let remaining = Math.min(dt, Number.MAX_SAFE_INTEGER)
    let iteration = 0
    while (remaining > 0) {
      const step = Math.min(remaining, CAMERA_SPRING_MAX_DELTA)
      this.integrate(step)
      remaining -= step
      iteration += 1
      if (iteration > 10_000) {
        // Defensive break in case dt is extremely large or NaN sneaks through.
        break
      }
    }
  }

  /**
   * Binds the spring target to a new world-space position.
   */
  setTarget(position: THREE.Vector3) {
    this.target.copy(position)
  }

  /**
   * Immediately sets the spring's current position.
   */
  setPosition(position: THREE.Vector3) {
    this.position.copy(position)
  }

  /**
   * Immediately sets the spring's current zoom level.
   */
  setZoom(zoom: number) {
    this.zoom = zoom
  }

  /**
   * Updates the desired zoom level that the spring should approach.
   */
  setTargetZoom(zoom: number) {
    this.targetZoom = zoom
  }

  /**
   * Teleports the spring to its target and clears accumulated velocity.
   */
  jumpToTarget() {
    this.position.copy(this.target)
    this.velocity.set(0, 0, 0)
    this.zoom = this.targetZoom
    this.zoomVelocity = 0
  }

  /**
   * Adjusts spring constants on the fly. Values are clamped to non-negative ranges.
   */
  configure(options: Partial<Omit<CameraSpringOptions, 'position' | 'target' | 'zoom' | 'targetZoom'>>) {
    if (options.stiffness !== undefined) this.stiffness = Math.max(0, options.stiffness)
    if (options.damping !== undefined) this.damping = Math.max(0, options.damping)
    if (options.zoomStiffness !== undefined) this.zoomStiffness = Math.max(0, options.zoomStiffness)
    if (options.zoomDamping !== undefined) this.zoomDamping = Math.max(0, options.zoomDamping)
  }

  /**
   * Returns a pooled snapshot of the spring state. An optional mutable target can be supplied to avoid allocations.
   *
   * Callers must treat the returned object and nested vectors as read-only views.
   */
  getSnapshot(target?: MutableCameraSnapshot): MutableCameraSnapshot {
    const snapshot = target ?? createMutableSnapshot()
    snapshot.position.copy(this.position)
    snapshot.velocity.copy(this.velocity)
    snapshot.target.copy(this.target)
    snapshot.zoom = this.zoom
    snapshot.zoomVelocity = this.zoomVelocity
    snapshot.targetZoom = this.targetZoom
    return snapshot
  }

  private integrate(step: number) {
    if (step <= 0) return
    this.offset.copy(this.target).sub(this.position).multiplyScalar(this.stiffness)
    this.dampingForce.copy(this.velocity).multiplyScalar(this.damping)
    this.acceleration.copy(this.offset).sub(this.dampingForce)

    this.velocity.addScaledVector(this.acceleration, step)
    this.position.addScaledVector(this.velocity, step)

    const zoomAcceleration =
      this.zoomStiffness * (this.targetZoom - this.zoom) - this.zoomDamping * this.zoomVelocity
    this.zoomVelocity += zoomAcceleration * step
    this.zoom += this.zoomVelocity * step
  }
}
