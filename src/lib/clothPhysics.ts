import * as THREE from 'three'

export type ClothOptions = {
  damping?: number
  constraintIterations?: number
  gravity?: THREE.Vector3
}

type Particle = {
  position: THREE.Vector3
  previous: THREE.Vector3
  mass: number
  pinned: boolean
}

type Constraint = {
  p1: number
  p2: number
  restLength: number
}

export class ClothPhysics {
  public mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>

  private particles: Particle[] = []
  private constraints: Constraint[] = []
  private tmpVector = new THREE.Vector3()
  private accelVector = new THREE.Vector3()
  private tmpVector2 = new THREE.Vector2()
  private gravity = new THREE.Vector3(0, -9.81, 0)
  private damping = 0.98
  private constraintIterations = 3
  private widthSegments: number
  private heightSegments: number
  private sleeping = false
  private sleepFrameCounter = 0
  private sleepVelocityThresholdSq = 1e-6
  private sleepFrameThreshold = 60

  constructor(mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>, options?: ClothOptions) {
    this.mesh = mesh

    const geom = mesh.geometry
    this.widthSegments = (geom.parameters.widthSegments ?? 1) + 1
    this.heightSegments = (geom.parameters.heightSegments ?? 1) + 1

    if (options?.gravity) this.gravity.copy(options.gravity)
    if (options?.damping) this.damping = options.damping
    if (options?.constraintIterations) this.constraintIterations = options.constraintIterations

    this.initializeParticles()
    this.initializeConstraints()
  }

  setGravity(value: THREE.Vector3) {
    this.gravity.copy(value)
  }

  setConstraintIterations(iterations: number) {
    if (!Number.isFinite(iterations)) return
    this.constraintIterations = Math.max(1, Math.round(iterations))
  }

  setSubsteps(substeps: number) {
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

  wakeIfPointInside(point: THREE.Vector2) {
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

  applyPointForce(
    center: THREE.Vector2,
    velocity: THREE.Vector2,
    radius = 0.25,
    strength = 1
  ) {
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

  applyImpulse(point: THREE.Vector2, force: THREE.Vector2, radius = 0.25) {
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

  constrainWithinAABB(min: THREE.Vector2, max: THREE.Vector2, damping = 0.6) {
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
      this.syncGeometry()
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
      const index = this.index(x, 0)
      this.particles[index].pinned = true
    }
  }

  pinCorners() {
    const topRow = this.heightSegments - 1
    const rightCol = this.widthSegments - 1

    const topLeft = this.index(0, topRow)
    const topRight = this.index(rightCol, topRow)
    const bottomLeft = this.index(0, 0)
    const bottomRight = this.index(rightCol, 0)

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
    this.syncGeometry()
  }

  update(deltaSeconds: number) {
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
        this.satisfyConstraint(constraint)
      }
    }

    this.syncGeometry()

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
        this.satisfyConstraint(constraint)
      }
    }

    this.syncGeometry()
  }

  isOffscreen(boundaryY: number) {
    return this.particles.every((particle) => particle.position.y < boundaryY)
  }

  private initializeParticles() {
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

  private initializeConstraints() {
    for (let y = 0; y < this.heightSegments; y++) {
      for (let x = 0; x < this.widthSegments; x++) {
        const index = this.index(x, y)

        if (x < this.widthSegments - 1) {
          this.addConstraint(index, this.index(x + 1, y))
        }

        if (y < this.heightSegments - 1) {
          this.addConstraint(index, this.index(x, y + 1))
        }

        if (x < this.widthSegments - 1 && y < this.heightSegments - 1) {
          this.addConstraint(index, this.index(x + 1, y + 1))
          this.addConstraint(this.index(x + 1, y), this.index(x, y + 1))
        }
      }
    }
  }

  private addConstraint(p1: number, p2: number) {
    const particle1 = this.particles[p1]
    const particle2 = this.particles[p2]

    this.constraints.push({
      p1,
      p2,
      restLength: particle1.position.distanceTo(particle2.position),
    })
  }

  private satisfyConstraint(constraint: Constraint) {
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

  private syncGeometry() {
    const positions = this.mesh.geometry.attributes.position

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i]
      positions.setXYZ(i, particle.position.x, particle.position.y, particle.position.z)
    }

    positions.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
    this.mesh.geometry.computeBoundingSphere()
  }

  private index(x: number, y: number) {
    return y * this.widthSegments + x
  }
}
