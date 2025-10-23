import * as THREE from 'three'

const getTimestamp = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/**
 * @typedef {Object} ClothOptions
 * @property {number} [damping]
 * @property {number} [constraintIterations]
 * @property {THREE.Vector3} [gravity]
 * @property {import('./worldBody.js').WorldBody} [worldBody]
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
    this.tmpVector3 = new THREE.Vector3()
    this.tmpVector3B = new THREE.Vector3()
    this.gravity = new THREE.Vector3(0, -2, 0)
    this.damping = 0.98
    this.constraintIterations = 3
    this.sleeping = false
    this.sleepFrameCounter = 0
    this.sleepVelocityThresholdSq = 1e-6
    this.sleepFrameThreshold = 60
    this.sleepWorldVelocityThresholdSq = options.sleepWorldVelocityThresholdSq ?? 1e-6
    this.debugLabel = options.debugLabel ?? null
    this.debugLogging = options.debugLogging ?? false

    const geom = mesh.geometry
    this.widthSegments = (geom.parameters.widthSegments ?? 1) + 1
    this.heightSegments = (geom.parameters.heightSegments ?? 1) + 1

    if (options.gravity) this.gravity.copy(options.gravity)
    if (options.damping) this.damping = options.damping
    if (options.constraintIterations) this.constraintIterations = options.constraintIterations
    if (options.sleepVelocityThresholdSq) this.sleepVelocityThresholdSq = options.sleepVelocityThresholdSq
    if (options.sleepFrameThreshold) this.sleepFrameThreshold = options.sleepFrameThreshold

    this.worldBody = options.worldBody ?? null
    this._localCenter = new THREE.Vector3()
    this._localCenterPre = new THREE.Vector3()
    this._worldCenter = new THREE.Vector3()
    this._worldCenterPre = new THREE.Vector3()
    this._previousWorldCenter = new THREE.Vector3()
    this._worldVelocity = new THREE.Vector3()
    this._previousWorldVelocity = new THREE.Vector3()
    this._worldAcceleration = new THREE.Vector3()
    this._lastWorldSpeedSq = 0
    this._worldCenterInitialized = false

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

  getWorldBody() {
    return this.worldBody ?? null
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
    const { maxY } = this._computeExtents()
    const epsilon = 1e-4
    for (const particle of this.particles) {
      if (particle.position.y >= maxY - epsilon) {
        particle.pinned = true
      }
    }
  }

  pinBottomEdge() {
    const { minY } = this._computeExtents()
    const epsilon = 1e-4
    for (const particle of this.particles) {
      if (particle.position.y <= minY + epsilon) {
        particle.pinned = true
      }
    }
  }

  pinCorners() {
    const { maxY, minY, maxX, minX } = this._computeExtents()
    const epsilon = 1e-4
    for (const particle of this.particles) {
      const nearTop = Math.abs(particle.position.y - maxY) <= epsilon
      const nearBottom = Math.abs(particle.position.y - minY) <= epsilon
      const nearLeft = Math.abs(particle.position.x - minX) <= epsilon
      const nearRight = Math.abs(particle.position.x - maxX) <= epsilon

      if (
        (nearTop && nearLeft) ||
        (nearTop && nearRight) ||
        (nearBottom && nearLeft) ||
        (nearBottom && nearRight)
      ) {
        particle.pinned = true
      }
    }
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

    let preWorldCenter = null
    if (this.worldBody) {
      this._computeLocalCenter(this._localCenterPre)
      preWorldCenter = this.worldBody.localToWorldPoint(this._localCenterPre, this._worldCenterPre)
    }

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
    this._updateWorldKinematics(deltaSeconds, preWorldCenter)

    const worldSpeedSq = this.worldBody ? this._lastWorldSpeedSq : 0
    const belowWorldThreshold = !this.worldBody || worldSpeedSq < this.sleepWorldVelocityThresholdSq

    if (maxDeltaSq < this.sleepVelocityThresholdSq && belowWorldThreshold) {
      this.sleepFrameCounter++
      if (this.debugLogging) {
        console.log('[cloth-sleep]', 'below-threshold', {
          label: this.debugLabel,
          time: getTimestamp(),
          maxDelta: Math.sqrt(maxDeltaSq),
          threshold: Math.sqrt(this.sleepVelocityThresholdSq),
          frameCounter: this.sleepFrameCounter,
          worldSpeed: Math.sqrt(worldSpeedSq),
          worldThreshold: Math.sqrt(this.sleepWorldVelocityThresholdSq),
        })
      }
      if (this.sleepFrameCounter >= this.sleepFrameThreshold) {
        if (this.debugLogging) {
          console.log('[cloth-sleep]', 'sleep', {
            label: this.debugLabel,
            time: getTimestamp(),
            gravity: this.gravity.clone(),
            damping: this.damping,
            maxDelta: Math.sqrt(maxDeltaSq),
            threshold: Math.sqrt(this.sleepVelocityThresholdSq),
            frameCounter: this.sleepFrameCounter,
            worldSpeed: Math.sqrt(worldSpeedSq),
            worldThreshold: Math.sqrt(this.sleepWorldVelocityThresholdSq),
          })
        }
        this.sleeping = true
      }
    } else {
      if (this.sleepFrameCounter > 0 && this.debugLogging) {
        console.log('[cloth-sleep]', 'reset', {
          label: this.debugLabel,
          time: getTimestamp(),
          maxDelta: Math.sqrt(maxDeltaSq),
          worldSpeed: Math.sqrt(worldSpeedSq),
        })
      }
      this.sleepFrameCounter = 0
      this.sleeping = false
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

  getAABB() {
    const { minX, maxX, minY, maxY, minZ, maxZ } = this._computeExtents()
    return new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(maxX, maxY, maxZ)
    )
  }

  _computeExtents() {
    let maxY = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minX = Number.POSITIVE_INFINITY
    let maxZ = Number.NEGATIVE_INFINITY
    let minZ = Number.POSITIVE_INFINITY

    for (const particle of this.particles) {
      if (particle.position.y > maxY) maxY = particle.position.y
      if (particle.position.y < minY) minY = particle.position.y
      if (particle.position.x > maxX) maxX = particle.position.x
      if (particle.position.x < minX) minX = particle.position.x
      if (particle.position.z > maxZ) maxZ = particle.position.z
      if (particle.position.z < minZ) minZ = particle.position.z
    }

    return { maxY, minY, maxX, minX, maxZ, minZ }
  }

  _computeLocalCenter(target = new THREE.Vector3()) {
    target.set(0, 0, 0)
    if (this.particles.length === 0) return target
    for (const particle of this.particles) {
      target.add(particle.position)
    }
    target.divideScalar(this.particles.length)
    return target
  }

  _updateWorldKinematics(deltaSeconds, preWorldCenter = null) {
    if (!this.worldBody || deltaSeconds <= 0) {
      this._lastWorldSpeedSq = 0
      return
    }

    const localCenter = this._computeLocalCenter(this._localCenter)
    const worldCenter = this.worldBody.localToWorldPoint(localCenter, this._worldCenter)

    let velocityComputed = false

    if (preWorldCenter) {
      this._worldVelocity
        .copy(worldCenter)
        .sub(preWorldCenter)
        .divideScalar(deltaSeconds)
      velocityComputed = true
    } else if (this._worldCenterInitialized) {
      this._worldVelocity
        .copy(worldCenter)
        .sub(this._previousWorldCenter)
        .divideScalar(deltaSeconds)
      velocityComputed = true
    } else {
      this._worldVelocity.set(0, 0, 0)
    }

    this.worldBody.setLinearVelocity(this._worldVelocity)

    if (velocityComputed) {
      this._worldAcceleration
        .copy(this._worldVelocity)
        .sub(this._previousWorldVelocity)
        .divideScalar(deltaSeconds)
    } else {
      this._worldAcceleration.set(0, 0, 0)
    }
    this.worldBody.setLinearAcceleration(this._worldAcceleration)

    this._previousWorldVelocity.copy(this._worldVelocity)
    this._previousWorldCenter.copy(worldCenter)
    this._lastWorldSpeedSq = this._worldVelocity.lengthSq()
    this._worldCenterInitialized = true
  }
}
