import * as THREE from 'three'

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

export type MutableCameraSnapshot = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  target: THREE.Vector3
  zoom: number
  zoomVelocity: number
  targetZoom: number
}

export type CameraSnapshot = Readonly<MutableCameraSnapshot>

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

export class CameraSpring {
  private readonly position = new THREE.Vector3()
  private readonly velocity = new THREE.Vector3()
  private readonly target = new THREE.Vector3()

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

  update(dt: number) {
    if (dt <= 0) return

    const acceleration = this.target
      .clone()
      .sub(this.position)
      .multiplyScalar(this.stiffness)
      .sub(this.velocity.clone().multiplyScalar(this.damping))

    this.velocity.add(acceleration.multiplyScalar(dt))
    this.position.add(this.velocity.clone().multiplyScalar(dt))

    const zoomAcceleration =
      this.zoomStiffness * (this.targetZoom - this.zoom) - this.zoomDamping * this.zoomVelocity
    this.zoomVelocity += zoomAcceleration * dt
    this.zoom += this.zoomVelocity * dt
  }

  setTarget(position: THREE.Vector3) {
    this.target.copy(position)
  }

  setPosition(position: THREE.Vector3) {
    this.position.copy(position)
  }

  setZoom(zoom: number) {
    this.zoom = zoom
  }

  setTargetZoom(zoom: number) {
    this.targetZoom = zoom
  }

  jumpToTarget() {
    this.position.copy(this.target)
    this.velocity.set(0, 0, 0)
    this.zoom = this.targetZoom
    this.zoomVelocity = 0
  }

  configure(options: Partial<Omit<CameraSpringOptions, 'position' | 'target' | 'zoom' | 'targetZoom'>>) {
    if (options.stiffness !== undefined) this.stiffness = options.stiffness
    if (options.damping !== undefined) this.damping = options.damping
    if (options.zoomStiffness !== undefined) this.zoomStiffness = options.zoomStiffness
    if (options.zoomDamping !== undefined) this.zoomDamping = options.zoomDamping
  }

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
}
