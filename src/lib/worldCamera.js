import * as THREE from 'three'

/**
 * @typedef {Object} WorldCameraOptions
 * @property {string | null | undefined} [id]
 * @property {THREE.Vector3 | null | undefined} [position]
 * @property {THREE.Vector3 | null | undefined} [target]
 * @property {THREE.Vector3 | null | undefined} [up]
 * @property {number | null | undefined} [near]
 * @property {number | null | undefined} [far]
 * @property {number | null | undefined} [aspect]
 * @property {number | null | undefined} [orthoWidth]
 * @property {number | null | undefined} [orthoHeight]
 * @property {boolean | null | undefined} [perspective]
 * @property {number | null | undefined} [fov]
 */

export class WorldCamera {
  /**
   * @param {WorldCameraOptions} [options]
   */
  constructor(options = {}) {
    const {
      id = null,
      position = null,
      target = null,
      up = null,
      near = 0.1,
      far = 1000,
      aspect = 1,
      orthoWidth = 1,
      orthoHeight = 1,
      perspective = false,
      fov = 50,
    } = options

    this.id = id
    this.position = position ? position.clone() : new THREE.Vector3(0, 0, 5)
    this.target = target ? target.clone() : new THREE.Vector3(0, 0, 0)
    this.up = up ? up.clone() : new THREE.Vector3(0, 1, 0)

    this.near = near
    this.far = far
    this.aspect = aspect
    this.orthoWidth = orthoWidth
    this.orthoHeight = orthoHeight
    this.perspective = perspective
    this.fov = fov

    this._matrix = new THREE.Matrix4()
    this._viewMatrix = new THREE.Matrix4()
    this._projectionMatrix = new THREE.Matrix4()
    this._projectionViewMatrix = new THREE.Matrix4()
    this._dirty = true
    this._dirtyProjection = true
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z)
    this._dirty = true
  }

  setTarget(x, y, z) {
    this.target.set(x, y, z)
    this._dirty = true
  }

  setAspect(aspect) {
    this.aspect = aspect
    this._dirtyProjection = true
  }

  setOrthoSize(width, height) {
    this.orthoWidth = width
    this.orthoHeight = height
    this._dirtyProjection = true
  }

  setPerspective(enabled) {
    if (this.perspective !== enabled) {
      this.perspective = enabled
      this._dirtyProjection = true
    }
  }

  setFov(fov) {
    this.fov = fov
    this._dirtyProjection = true
  }

  setClippingPlanes(near, far) {
    this.near = near
    this.far = far
    this._dirtyProjection = true
  }

  _updateMatrices() {
    if (this._dirty) {
      this._matrix.lookAt(this.position, this.target, this.up)
      this._viewMatrix.copy(this._matrix).invert()
      this._dirty = false
    }
    if (this._dirtyProjection) {
      if (this.perspective) {
        this._projectionMatrix.makePerspective(
          THREE.MathUtils.degToRad(this.fov),
          this.aspect,
          this.near,
          this.far,
        )
      } else {
        const halfWidth = this.orthoWidth / 2
        const halfHeight = this.orthoHeight / 2
        this._projectionMatrix.makeOrthographic(
          -halfWidth,
          halfWidth,
          halfHeight,
          -halfHeight,
          this.near,
          this.far,
        )
      }
      this._dirtyProjection = false
    }

    this._projectionViewMatrix.multiplyMatrices(this._projectionMatrix, this._viewMatrix)
  }

  get matrix() {
    if (this._dirty) {
      this._updateMatrices()
    }
    return this._matrix
  }

  get viewMatrix() {
    this._updateMatrices()
    return this._viewMatrix
  }

  get projectionMatrix() {
    this._updateMatrices()
    return this._projectionMatrix
  }

  get projectionViewMatrix() {
    this._updateMatrices()
    return this._projectionViewMatrix
  }

  clone() {
    return new WorldCamera({
      id: this.id,
      position: this.position,
      target: this.target,
      up: this.up,
      near: this.near,
      far: this.far,
      aspect: this.aspect,
      orthoWidth: this.orthoWidth,
      orthoHeight: this.orthoHeight,
      perspective: this.perspective,
      fov: this.fov,
    })
  }
}
