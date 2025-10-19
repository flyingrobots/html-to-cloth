import * as THREE from 'three'

/**
 * @typedef {Object} ClothOptions
 * @property {number} [damping]
 * @property {number} [constraintIterations]
 * @property {THREE.Vector3} [gravity]
 */

/**
 * @typedef {Object} Particle
 * @property {THREE.Vector3} position
 * @property {THREE.Vector3} previous
 * @property {number} mass
 * @property {boolean} pinned
 */

/**
 * @typedef {Object} Constraint
 * @property {number} p1
 * @property {number} p2
 * @property {number} restLength
 */

export class ClothPhysics {
  /**
   * @param {THREE.Mesh} mesh
   * @param {ClothOptions} [options]
   */
  constructor(mesh, options = {}) {
    this.mesh = mesh
    this.particles = []
    this.constraints = []
    this.tmpVector = new THREE.Vector3()
    this.accelVector = new THREE.Vector3()
    this.tmpVector2 = new THREE.Vector2()
    this.gravity = new THREE.Vector3(0, -2, 0)
    this.damping = 0.98
    this.constraintIterations = 3
    this.sleeping = false
    this.sleepFrameCounter = 0
    this.sleepVelocityThresholdSq = 1e-6
    this.sleepFrameThreshold = 60

    const geom = mesh.geometry
    this.widthSegments = (geom.parameters.widthSegments ?? 1) + 1
    this.heightSegments = (geom.parameters.heightSegments ?? 1) + 1

    if (options.gravity) this.gravity.copy(options.gravity)
    if (options.damping) this.damping = options.damping
    if (options.constraintIterations) this.constraintIterations = options.constraintIterations

    this._initializeParticles()
    this._initializeConstraints()
  }

  setGravity(value) {
    this.gravity.copy(value)
  }

  setConstraintIterations(iterations) {
    if (!Number.isFinite(iterations)) return
    this.constraintIterations = Math.max(1, Math.round(iterations))
  }

  setDamping(value) {
    if (!Number.isFinite(value)) return
    this.damping = Math.max(0, Math.min(value, 0.999))
  }

  setSubsteps(substeps) {
    if (!Number.isFinite(substeps)) return
  }

  releaseAllPins() {
    for (const particle of this.particles) {
      particle.pinned = false
    }
  }

  clearPins() {
    for (const particle of this.particles) {
      particle.pinned = false
    }
  }

  getVertexPositions() {
    return this.particles.map((particle) => particle.position.clone())
  }

  isSleeping() {
    return this.sleeping
  }

  wake() {
    this.sleeping = false
    this.sleepFrameCounter = 0
  }

  /**
   * @param {THREE.Vector2} point
   */
  wakeIfPointInside(point) {
    if (!this.sleeping) return
    const sphere = this.getBoundingSphere()
    const dx = point.x - sphere.center.x
    const dy = point.y - sphere.center.y
    if (dx * dx + dy * dy <= sphere.radius * sphere.radius) {
      this.wake()
    }
  }

  getBoundingSphere() {
    const sphere = this.mesh.geometry.boundingSphere
    if (sphere) {
      return sphere.clone()
    }
    const fallback = new THREE.Sphere()
    this.mesh.geometry.computeBoundingSphere()
    return (this.mesh.geometry.boundingSphere ?? fallback).clone()
  }

  /**
   * @param {THREE.Vector2} center
   * @param {THREE.Vector2} velocity
   * @param {number} [radius]
   * @param {number} [strength]
   */
  applyPointForce(center, velocity, radius = 0.25, strength = 1) {
    if (velocity.lengthSq() === 0) return

    this.wake()

    const radiusSq = radius * radius
    const scaledVelocity = this.tmpVector2.copy(velocity).multiplyScalar(strength)

    for (const particle of this.particles) {
      if (particle.pinned) continue

      const dx = particle.position.x - center.x
      const dy = particle.position.y - center.y
      const distanceSq = dx * dx + dy * dy
      if (distanceSq > radiusSq) continue

      const falloff = 1 - distanceSq / radiusSq
      particle.position.x += scaledVelocity.x * falloff
      particle.position.y += scaledVelocity.y * falloff
    }
  }

  /**
   * @param {THREE.Vector2} point
   * @param {THREE.Vector2} force
   * @param {number} [radius]
   */
  applyImpulse(point, force, radius = 0.25) {
    if (force.lengthSq() === 0) return
    this.wake()

    const fx = force.x
    const fy = force.y
    const radiusSq = radius * radius

    for (const particle of this.particles) {
      if (particle.pinned) continue

      const dx = particle.position.x - point.x
      const dy = particle.position.y - point.y
      const distanceSq = dx * dx + dy * dy
      if (distanceSq > radiusSq) continue

      const falloff = 1 - distanceSq / radiusSq
      const impulseX = fx * falloff
      const impulseY = fy * falloff

      particle.position.x += impulseX
      particle.position.y += impulseY
      particle.previous.x -= impulseX
      particle.previous.y -= impulseY
    }
  }

  /**
   * @param {THREE.Vector2} min
   * @param {THREE.Vector2} max
   * @param {number} [damping]
   */
  constrainWithinAABB(min, max, damping = 0.6) {
    let anyCollided = false

    for (const particle of this.particles) {
      if (particle.pinned) continue

      let collided = false

      if (particle.position.x < min.x) {
        particle.position.x = min.x
        collided = true
      } else if (particle.position.x > max.x) {
        particle.position.x = max.x
        collided = true
      }

      if (particle.position.y < min.y) {
        particle.position.y = min.y
        collided = true
      } else if (particle.position.y > max.y) {
        particle.position.y = max.y
        collided = true
      }

      if (collided) {
        particle.previous.lerp(particle.position, damping)
        anyCollided = true
      }
    }

    if (anyCollided) {
      this.wake()
      this._syncGeometry()
    }
  }

  pinTopEdge() {
    for (let x = 0; x < this.widthSegments; x++) {
      const index = (this.heightSegments - 1) * this.widthSegments + x
      this.particles[index].pinned = true
    }
  }

  pinBottomEdge() {
    for (let x = 0; x < this.widthSegments; x++) {
      const index = this._index(x, 0)
      this.particles[index].pinned = true
    }
  }

  pinCorners() {
    const topRow = this.heightSegments - 1
    const rightCol = this.widthSegments - 1

    const topLeft = this._index(0, topRow)
    const topRight = this._index(rightCol, topRow)
    const bottomLeft = this._index(0, 0)
    const bottomRight = this._index(rightCol, 0)

    this.particles[topLeft].pinned = true
    this.particles[topRight].pinned = true
    this.particles[bottomLeft].pinned = true
    this.particles[bottomRight].pinned = true
  }

  addTurbulence(amount = 0.05) {
    for (const particle of this.particles) {
      if (particle.pinned) continue
      particle.position.x += (Math.random() - 0.5) * amount
      particle.position.y += (Math.random() - 0.5) * amount
    }
    this.wake()
    this._syncGeometry()
  }

  update(deltaSeconds) {
    if (deltaSeconds <= 0) return
    if (this.sleeping) return

    const acceleration = this.accelVector
      .copy(this.gravity)
      .multiplyScalar(deltaSeconds * deltaSeconds)

    let maxDeltaSq = 0

    for (const particle of this.particles) {
      if (particle.pinned) continue

      const current = particle.position
      const previous = particle.previous

      const oldX = current.x
      const oldY = current.y
      const oldZ = current.z

      const velocityX = (current.x - previous.x) * this.damping
      const velocityY = (current.y - previous.y) * this.damping
      const velocityZ = (current.z - previous.z) * this.damping

      const nextX = current.x + velocityX + acceleration.x
      const nextY = current.y + velocityY + acceleration.y
      const nextZ = current.z + velocityZ + acceleration.z

      particle.previous.set(current.x, current.y, current.z)
      current.set(nextX, nextY, nextZ)

      const deltaX = nextX - oldX
      const deltaY = nextY - oldY
      const deltaZ = nextZ - oldZ
      const deltaSq = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ
      if (deltaSq > maxDeltaSq) {
        maxDeltaSq = deltaSq
      }
    }

    for (let i = 0; i < this.constraintIterations; i++) {
      for (const constraint of this.constraints) {
        this._satisfyConstraint(constraint)
      }
    }

    this._syncGeometry()

    if (maxDeltaSq < this.sleepVelocityThresholdSq) {
      this.sleepFrameCounter++
      if (this.sleepFrameCounter >= this.sleepFrameThreshold) {
        this.sleeping = true
      }
    } else {
      this.sleepFrameCounter = 0
    }
  }

  relaxConstraints(iterations = this.constraintIterations) {
    const count = Math.max(0, Math.round(iterations))
    if (count === 0) return

    for (let i = 0; i < count; i++) {
      for (const constraint of this.constraints) {
        this._satisfyConstraint(constraint)
      }
    }

    for (const particle of this.particles) {
      particle.previous.copy(particle.position)
    }

    this._syncGeometry()
  }

  isOffscreen(boundaryY) {
    return this.particles.every((particle) => particle.position.y < boundaryY)
  }

  getParticleCount() {
    return this.particles.length
  }

  getConstraintStats() {
    if (this.constraints.length === 0) {
      return { averageError: 0, maxError: 0 }
    }
    let totalError = 0
    let maxError = 0

    for (const constraint of this.constraints) {
      const p1 = this.particles[constraint.p1]
      const p2 = this.particles[constraint.p2]
      if (!p1 || !p2) continue
      const distance = p1.position.distanceTo(p2.position)
      const error = Math.abs(distance - constraint.restLength)
      totalError += error
      if (error > maxError) {
        maxError = error
      }
    }

    return {
      averageError: totalError / this.constraints.length,
      maxError,
    }
  }

  _initializeParticles() {
    const positions = this.mesh.geometry.attributes.position

    for (let i = 0; i < positions.count; i++) {
      const vector = new THREE.Vector3().fromBufferAttribute(positions, i)
      this.particles.push({
        position: vector.clone(),
        previous: vector.clone(),
        mass: 1,
        pinned: false,
      })
    }
  }

  _initializeConstraints() {
    for (let y = 0; y < this.heightSegments; y++) {
      for (let x = 0; x < this.widthSegments; x++) {
        const index = this._index(x, y)

        if (x < this.widthSegments - 1) {
          this._addConstraint(index, this._index(x + 1, y))
        }

        if (y < this.heightSegments - 1) {
          this._addConstraint(index, this._index(x, y + 1))
        }

        if (x < this.widthSegments - 1 && y < this.heightSegments - 1) {
          this._addConstraint(index, this._index(x + 1, y + 1))
          this._addConstraint(this._index(x + 1, y), this._index(x, y + 1))
        }
      }
    }
  }

  _addConstraint(p1, p2) {
    const particle1 = this.particles[p1]
    const particle2 = this.particles[p2]

    this.constraints.push({
      p1,
      p2,
      restLength: particle1.position.distanceTo(particle2.position),
    })
  }

  _satisfyConstraint(constraint) {
    const particle1 = this.particles[constraint.p1]
    const particle2 = this.particles[constraint.p2]

    const diff = this.tmpVector
      .copy(particle2.position)
      .sub(particle1.position)

    const currentLength = diff.length()
    if (currentLength === 0) return

    const difference = (currentLength - constraint.restLength) / currentLength
    const offset = diff.multiplyScalar(0.5 * difference)

    if (!particle1.pinned) {
      particle1.position.add(offset)
    }

    if (!particle2.pinned) {
      particle2.position.sub(offset)
    }
  }

  _syncGeometry() {
    const positions = this.mesh.geometry.attributes.position

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i]
      positions.setXYZ(i, particle.position.x, particle.position.y, particle.position.z)
    }

    positions.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
    this.mesh.geometry.computeBoundingSphere()
  }

  _index(x, y) {
    return y * this.widthSegments + x
  }
}
