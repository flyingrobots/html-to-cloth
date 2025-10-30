import * as THREE from 'three'

export type WorldBodyOptions = {
  id?: string | null
  mesh?: THREE.Object3D | null
  position?: THREE.Vector3 | null
  rotation?: THREE.Quaternion | null
  scale?: THREE.Vector3 | null
}

/**
 * Lightweight transform helper that maintains local↔world conversions and
 * applies transforms to an attached mesh. This lets simulation operate in a
 * stable model space while the rendered object moves/scales in world space.
 */
export class WorldBody {
  id: string | null
  mesh: THREE.Object3D | null

  position: THREE.Vector3
  rotation: THREE.Quaternion | null
  scale: THREE.Vector3

  // We intentionally avoid heavy matrix math here to keep the dependency
  // surface small and test-friendly. Current usage only requires translation
  // and uniform/non-uniform scale. Rotation can be added later if needed.

  constructor(options: WorldBodyOptions = {}) {
    const {
      id = null,
      mesh = null,
      position = null,
      rotation = null,
      scale = null,
    } = options

    this.id = id
    this.mesh = mesh ?? null
    this.position = position ? position.clone() : new THREE.Vector3()
    this.rotation = rotation ? rotation.clone() : null
    this.scale = scale ? scale.clone() : new THREE.Vector3(1, 1, 1)

    if (this.mesh) this.applyToMesh()
  }

  // Matrix helpers removed; we operate with simple translate/scale math.

  setPositionComponents(x: number, y: number, z = 0) {
    this.position.set(x, y, z)
  }

  setScaleComponents(x: number, y: number, z = 1) {
    this.scale.set(x, y, z)
  }

  /** Applies current transform to the attached mesh (if any). */
  applyToMesh() {
    if (!this.mesh) return
    const posUnknown = (this.mesh as THREE.Object3D).position as unknown
    if (typeof (posUnknown as { copy?: unknown }).copy === 'function') {
      ;(posUnknown as { copy: (v: THREE.Vector3) => void }).copy(this.position)
    } else if (typeof (posUnknown as { set?: unknown }).set === 'function') {
      ;(posUnknown as { set: (x: number, y: number, z: number) => void }).set(
        this.position.x,
        this.position.y,
        this.position.z,
      )
    }

    const meshQuatRot = this.mesh as unknown as {
      quaternion?: { copy?: (q: THREE.Quaternion) => void }
      rotation?: { setFromQuaternion?: (q: THREE.Quaternion) => void }
    }
    if (this.rotation && typeof meshQuatRot.quaternion?.copy === 'function') {
      meshQuatRot.quaternion!.copy(this.rotation)
    } else if (this.rotation && typeof meshQuatRot.rotation?.setFromQuaternion === 'function') {
      meshQuatRot.rotation!.setFromQuaternion(this.rotation)
    }

    const scaleUnknown = (this.mesh as THREE.Object3D).scale as unknown
    if (typeof (scaleUnknown as { copy?: unknown }).copy === 'function') {
      ;(scaleUnknown as { copy: (v: THREE.Vector3) => void }).copy(this.scale)
    } else if (typeof (scaleUnknown as { set?: unknown }).set === 'function') {
      ;(scaleUnknown as { set: (x: number, y: number, z: number) => void }).set(
        this.scale.x,
        this.scale.y,
        this.scale.z,
      )
    }

    const updatable = this.mesh as unknown as { updateMatrix?: () => void; updateMatrixWorld?: (force?: boolean) => void }
    updatable.updateMatrix?.()
    updatable.updateMatrixWorld?.(true)
  }

  /** Converts a point from local/model space to world space. */
  localToWorldPoint(local: THREE.Vector3, target = new THREE.Vector3()) {
    // world = local * scale + position
    return target
      .set(local.x * this.scale.x, local.y * this.scale.y, local.z * this.scale.z)
      .add(this.position)
  }

  /** Converts a point from world space to local/model space. */
  worldToLocalPoint(world: THREE.Vector3, target = new THREE.Vector3()) {
    // local = (world - position) / scale
    return target
      .set(world.x - this.position.x, world.y - this.position.y, world.z - this.position.z)
      .set(
        target.x / (this.scale.x || 1),
        target.y / (this.scale.y || 1),
        target.z / (this.scale.z || 1),
      )
  }

  /** Converts a direction/vector from local to world space (ignores translation). */
  localToWorldVector(local: THREE.Vector3, target = new THREE.Vector3()) {
    return target.set(local.x * this.scale.x, local.y * this.scale.y, local.z * this.scale.z)
  }

  /** Converts a direction/vector from world to local space (ignores translation). */
  worldToLocalVector(world: THREE.Vector3, target = new THREE.Vector3()) {
    return target.set(
      world.x / (this.scale.x || 1),
      world.y / (this.scale.y || 1),
      world.z / (this.scale.z || 1),
    )
  }
}
