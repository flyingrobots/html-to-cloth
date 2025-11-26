import * as THREE from 'three'

import { GravityController } from './gravityController'
import type { SimWarmStartConfig } from './simWorld'

export type ClothOptions = {
  damping?: number
  constraintIterations?: number
  gravity?: THREE.Vector3
  gravityController?: GravityController
}

export type ClothObstacle =
  | {
      kind: 'aabb'
      min: { x: number; y: number }
      max: { x: number; y: number }
      velocity?: { x: number; y: number }
    }
  | {
      kind: 'obb'
      center: { x: number; y: number }
      half: { x: number; y: number }
      angle: number
      velocity?: { x: number; y: number }
    }
  | {
      kind: 'sphere'
      center: { x: number; y: number }
      radius: number
      velocity?: { x: number; y: number }
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

/**
 * Verlet-based cloth simulation tuned for the DOM capture demo. Handles constraint relaxation,
 * damping, pinning, impulses, and exposes helpers for warm-starting via {@link GravityController}.
 */
export class ClothPhysics {
  public mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>

  private particles: Particle[] = []
  private constraints: Constraint[] = []
  private tmpVector = new THREE.Vector3()
  private accelVector = new THREE.Vector3()
  private tmpVector2 = new THREE.Vector2()
  private damping = 0.98
  private constraintIterations = 3
  private widthSegments: number
  private heightSegments: number
  private sleeping = false
  private sleepFrameCounter = 0
  private sleepVelocityThresholdSq = 1e-6
  private sleepFrameThreshold = 60
  private storedSubsteps = 1
  private gravityController: GravityController
  private gravityBuffer = new THREE.Vector3()
  private particleRadius = 0.02

  constructor(mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>, options?: ClothOptions) {
    this.mesh = mesh

    const geom = mesh.geometry
    this.widthSegments = (geom.parameters.widthSegments ?? 1) + 1
    this.heightSegments = (geom.parameters.heightSegments ?? 1) + 1

    this.gravityController = options?.gravityController ?? new GravityController(options?.gravity)

    if (options?.damping) this.damping = options.damping
    if (options?.constraintIterations) this.constraintIterations = options.constraintIterations

    this.initializeParticles()
    this.initializeConstraints()
  }

  setGravity(value: THREE.Vector3) {
    this.gravityController.setBase(value)
  }

  setConstraintIterations(iterations: number) {
    if (!Number.isFinite(iterations)) return
    this.constraintIterations = Math.max(1, Math.round(iterations))
  }

  setSubsteps(substeps: number) {
    if (!Number.isFinite(substeps)) return
    this.storedSubsteps = Math.max(1, Math.round(substeps))
  }

  /** Configures the velocity/frames thresholds used to transition into the sleeping state. */
  setSleepThresholds(velocity: number, frames: number) {
    if (Number.isFinite(velocity) && velocity > 0) {
      this.sleepVelocityThresholdSq = velocity * velocity
    }
    if (Number.isFinite(frames) && frames > 0) {
      this.sleepFrameThreshold = Math.round(frames)
    }
  }

  releaseAllPins() {
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

  getBoundingSphere(): { center: THREE.Vector2; radius: number } {
    if (!this.mesh.geometry.boundingSphere) {
      this.mesh.geometry.computeBoundingSphere()
    }
    const sphere = this.mesh.geometry.boundingSphere!
    return {
      center: new THREE.Vector2(sphere.center.x, sphere.center.y),
      radius: sphere.radius,
    }
  }

  /** Returns the approximate collision radius used for particle↔rigid tests. */
  getParticleRadius() {
    return this.particleRadius
  }

  /** Overrides particle collision radius used for obstacle tests. */
  setParticleRadius(radius: number) {
    if (!Number.isFinite(radius) || radius <= 0) return
    this.particleRadius = radius
  }

  /** Adjusts per-step velocity damping applied during integration. */
  setDamping(value: number) {
    if (!Number.isFinite(value)) return
    this.damping = Math.min(0.999, Math.max(0, value))
  }

  /** Clamps all particles to stay above a world-space floor (Y axis up). */
  clampToFloor(minY: number, padding = 1e-3) {
    const limit = minY + padding
    for (const p of this.particles) {
      if (p.position.y < limit) {
        p.position.y = limit
        if (p.previous.y < limit) p.previous.y = limit
      }
    }
    this.syncGeometry()
  }

  /** Translates all particles vertically (useful for post-collision corrections). */
  translateY(dy: number) {
    if (!Number.isFinite(dy) || dy === 0) return
    for (const p of this.particles) {
      p.position.y += dy
      p.previous.y += dy
    }
    this.syncGeometry()
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

  /**
   * Resolves penetrations between cloth particles and rigid obstacles (AABB/OBB/sphere).
   * Meant to be called after integration each step when cloth↔rigid coupling is enabled.
   */
  collideWithObstacles(obstacles: ClothObstacle[], damping = 0.6) {
    if (!obstacles.length) return
    const r = this.particleRadius
    let any = false
    let maxCorrectionSq = 0

    for (const particle of this.particles) {
      if (particle.pinned) continue

      for (const obs of obstacles) {
        if (obs.kind === 'sphere') {
          const dx = particle.position.x - obs.center.x
          const dy = particle.position.y - obs.center.y
          const distSq = dx * dx + dy * dy
          const limit = r + obs.radius
          if (distSq < limit * limit) {
            const dist = Math.sqrt(Math.max(distSq, 1e-12))
            const inv = dist > 0 ? 1 / dist : 0
            const nx = dist > 0 ? dx * inv : 0
            const ny = dist > 0 ? dy * inv : 1
            const penetration = limit - dist
            particle.position.x += nx * penetration
            particle.position.y += ny * penetration
            maxCorrectionSq = Math.max(maxCorrectionSq, penetration * penetration)
            particle.previous.lerp(particle.position, damping)
            any = true
          }
          continue
        }

        // Treat OBBs as AABBs in their local frame; fallback to bounding sphere when angle present.
        if (obs.kind === 'obb' && Math.abs(obs.angle) > 1e-3) {
          const radius = Math.max(obs.half.x, obs.half.y)
          const dx = particle.position.x - obs.center.x
          const dy = particle.position.y - obs.center.y
          const limit = r + radius
          const distSq = dx * dx + dy * dy
          if (distSq < limit * limit) {
            const dist = Math.sqrt(Math.max(distSq, 1e-12))
            const nx = dist > 0 ? dx / dist : 0
            const ny = dist > 0 ? dy / dist : 1
            const penetration = limit - dist
            particle.position.x += nx * penetration
            particle.position.y += ny * penetration
            maxCorrectionSq = Math.max(maxCorrectionSq, penetration * penetration)
            particle.previous.lerp(particle.position, damping)
            any = true
          }
          continue
        }

        const minX = obs.kind === 'aabb' ? obs.min.x : obs.center.x - obs.half.x
        const maxX = obs.kind === 'aabb' ? obs.max.x : obs.center.x + obs.half.x
        const minY = obs.kind === 'aabb' ? obs.min.y : obs.center.y - obs.half.y
        const maxY = obs.kind === 'aabb' ? obs.max.y : obs.center.y + obs.half.y

        const closestX = Math.max(minX, Math.min(maxX, particle.position.x))
        const closestY = Math.max(minY, Math.min(maxY, particle.position.y))
        const dx = particle.position.x - closestX
        const dy = particle.position.y - closestY
        const distSq = dx * dx + dy * dy

        if (distSq < r * r) {
          const dist = Math.sqrt(Math.max(distSq, 1e-12))
          const nx = dist > 0 ? dx / dist : 0
          const ny = dist > 0 ? dy / dist : 1
          const penetration = r - dist
          particle.position.x += nx * penetration
          particle.position.y += ny * penetration
          maxCorrectionSq = Math.max(maxCorrectionSq, penetration * penetration)
          particle.previous.lerp(particle.position, damping)
          any = true
        }
      }
    }

    if (any) {
      this.syncGeometry()
      if (maxCorrectionSq < this.sleepVelocityThresholdSq) {
        this.sleepFrameCounter++
        if (this.sleepFrameCounter >= this.sleepFrameThreshold) {
          this.sleeping = true
        }
      } else {
        this.sleeping = false
        this.sleepFrameCounter = 0
      }
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

    const steps = Math.max(1, this.storedSubsteps)
    const stepSize = deltaSeconds / steps
    const gravity = this.gravityController.getCurrent(this.gravityBuffer)

    let maxDeltaSq = 0

    for (let step = 0; step < steps; step++) {
      const acceleration = this.accelVector.copy(gravity).multiplyScalar(stepSize * stepSize)

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

  warmStart(config: SimWarmStartConfig) {
    const iterations = Math.max(0, Math.round(config.constraintIterations * config.passes))
    if (iterations === 0) return
    this.wake()
    const zeroGravity = this.tmpVector.set(0, 0, 0)
    this.gravityController.runWithOverride(zeroGravity, () => {
      this.relaxConstraints(iterations)
    })
  }

  getGravity() {
    return this.gravityController.getBase(new THREE.Vector3())
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
    let minRest = Infinity
    for (let y = 0; y < this.heightSegments; y++) {
      for (let x = 0; x < this.widthSegments; x++) {
        const index = this.index(x, y)

        if (x < this.widthSegments - 1) {
          minRest = Math.min(minRest, this.addConstraint(index, this.index(x + 1, y)))
        }

        if (y < this.heightSegments - 1) {
          minRest = Math.min(minRest, this.addConstraint(index, this.index(x, y + 1)))
        }

        if (x < this.widthSegments - 1 && y < this.heightSegments - 1) {
          minRest = Math.min(minRest, this.addConstraint(index, this.index(x + 1, y + 1)))
          minRest = Math.min(minRest, this.addConstraint(this.index(x + 1, y), this.index(x, y + 1)))
        }
      }
    }

    if (Number.isFinite(minRest) && minRest < Infinity) {
      // Use a fraction of the rest length as a per-particle collision radius.
      this.particleRadius = Math.max(1e-4, minRest * 0.6)
    }
  }

  private addConstraint(p1: number, p2: number) {
    const particle1 = this.particles[p1]
    const particle2 = this.particles[p2]

    const restLength = particle1.position.distanceTo(particle2.position)
    this.constraints.push({
      p1,
      p2,
      restLength,
    })
    return restLength
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

  /** Returns an array of pinned vertex positions (local/model space). */
  getPinnedVertexPositions() {
    const out: THREE.Vector3[] = []
    for (const p of this.particles) {
      if (p.pinned) out.push(p.position.clone())
    }
    return out
  }
}
