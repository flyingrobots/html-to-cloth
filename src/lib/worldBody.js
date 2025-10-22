import * as THREE from 'three'

/**
 * @typedef {Object} WorldBodyOptions
 * @property {string | null | undefined} [id]
 * @property {THREE.Object3D | null | undefined} [mesh]
 * @property {THREE.Vector3 | null | undefined} [position]
 * @property {THREE.Quaternion | null | undefined} [rotation]
 * @property {THREE.Vector3 | null | undefined} [scale]
 * @property {number | null | undefined} [mass]
 * @property {THREE.Matrix3 | null | undefined} [inertiaTensor]
 */

export class WorldBody {
  /**
   * @param {WorldBodyOptions} [options]
   */
  constructor(options = {}) {
    const {
      id = null,
      mesh = null,
      position = null,
      rotation = null,
      scale = null,
      mass = 1,
      inertiaTensor = null,
    } = options

    this.id = id
    this.mesh = mesh ?? null

    this.position = position ? position.clone() : new THREE.Vector3()
    this.rotation = rotation ? rotation.clone() : new THREE.Quaternion()
    this.scale = scale ? scale.clone() : new THREE.Vector3(1, 1, 1)

    this.mass = Number.isFinite(mass) && mass > 0 ? mass : 1
    this.inverseMass = 1 / this.mass
    this.inertiaTensor = inertiaTensor ? inertiaTensor.clone() : new THREE.Matrix3().identity()

    this.linearVelocity = new THREE.Vector3()
    this.angularVelocity = new THREE.Vector3()
    this.linearAcceleration = new THREE.Vector3()

    this._matrix = new THREE.Matrix4()
    this._dirtyMatrix = true

    this._restPosition = this.position.clone()
    this._restRotation = this.rotation.clone()
    this._restScale = this.scale.clone()

    if (this.mesh) {
      this.applyToMesh()
    }
  }

  /**
   * @returns {THREE.Matrix4}
   */
  get matrix() {
    if (this._dirtyMatrix) {
      this._matrix.compose(this.position, this.rotation, this.scale)
      this._dirtyMatrix = false
    }
    return this._matrix
  }

  /**
   * @param {THREE.Vector3} vector
   */
  setPosition(vector) {
    this.position.copy(vector)
    this._dirtyMatrix = true
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} [z]
   */
  setPositionComponents(x, y, z = 0) {
    this.position.set(x, y, z)
    this._dirtyMatrix = true
  }

  /**
   * @param {THREE.Quaternion} quaternion
   */
  setRotation(quaternion) {
    this.rotation.copy(quaternion)
    this._dirtyMatrix = true
  }

  /**
   * @param {THREE.Vector3} vector
   */
  setScale(vector) {
    this.scale.copy(vector)
    this._dirtyMatrix = true
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} [z]
   */
  setScaleComponents(x, y, z = 1) {
    this.scale.set(x, y, z)
    this._dirtyMatrix = true
  }

  /**
   * Applies the body's transform to the linked mesh (if any).
   */
  applyToMesh() {
    if (!this.mesh) return

    if (typeof this.mesh.position?.copy === 'function') {
      this.mesh.position.copy(this.position)
    }

    if (this.mesh.quaternion && typeof this.mesh.quaternion.copy === 'function') {
      this.mesh.quaternion.copy(this.rotation)
    } else if (this.mesh.rotation && typeof this.mesh.rotation.setFromQuaternion === 'function') {
      this.mesh.rotation.setFromQuaternion(this.rotation)
    }

    if (typeof this.mesh.scale?.copy === 'function') {
      this.mesh.scale.copy(this.scale)
    }

    if (typeof this.mesh.updateMatrix === 'function') {
      this.mesh.updateMatrix()
    }
    if (typeof this.mesh.updateMatrixWorld === 'function') {
      this.mesh.updateMatrixWorld(true)
    }
    this._dirtyMatrix = true
  }

  /**
   * Records the current transform as the resting baseline.
   * @param {{ position?: boolean, rotation?: boolean, scale?: boolean }} [options]
   */
  commitRestState(options = {}) {
    const { position = true, rotation = true, scale = true } = options
    if (position) this._restPosition.copy(this.position)
    if (rotation) this._restRotation.copy(this.rotation)
    if (scale) this._restScale.copy(this.scale)
  }

  /**
   * Resets the transform to the stored rest state.
   * @param {{ includePosition?: boolean }} [options]
   */
  resetTransform(options = {}) {
    const { includePosition = false } = options
    if (includePosition) {
      this.position.copy(this._restPosition)
    }
    this.rotation.copy(this._restRotation)
    this.scale.copy(this._restScale)
    this.linearVelocity.set(0, 0, 0)
    this.angularVelocity.set(0, 0, 0)
    this.linearAcceleration.set(0, 0, 0)
    this._dirtyMatrix = true
    this.applyToMesh()
  }

  /**
   * @param {THREE.Vector3} velocity
   */
  setLinearVelocity(velocity) {
    this.linearVelocity.copy(velocity)
  }

  /**
   * @param {THREE.Vector3} acceleration
   */
  setLinearAcceleration(acceleration) {
    this.linearAcceleration.copy(acceleration)
  }

  /**
   * @param {THREE.Vector3} velocity
   */
  setAngularVelocity(velocity) {
    this.angularVelocity.copy(velocity)
  }

  /**
   * Releases the mesh reference.
   */
  dispose() {
    this.mesh = null
  }
}
