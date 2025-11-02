import * as THREE from 'three'

export type RigidOptions = {
  width: number
  height: number
  position: THREE.Vector2
  restitution?: number
  mass?: number
  gravity?: THREE.Vector3
}

export class RigidBody2D {
  position = new THREE.Vector2()
  velocity = new THREE.Vector2()
  angle = 0
  angularVelocity = 0
  readonly width: number
  readonly height: number
  readonly radius: number
  restitution = 0.35
  mass = 1
  sleeping = false
  sleepFrames = 0
  sleepVelocityThresholdSq = 1e-6
  sleepFrameThreshold = 60
  gravity = new THREE.Vector3(0, -9.81, 0)
  private shape: 'circle' | 'obb' = 'circle'
  private hx!: number
  private hy!: number

  constructor(opts: RigidOptions) {
    this.width = Math.max(1e-6, opts.width)
    this.height = Math.max(1e-6, opts.height)
    this.radius = 0.5 * Math.hypot(this.width, this.height)
    this.position.copy(opts.position)
    this.hx = this.width * 0.5
    this.hy = this.height * 0.5
    if (opts.restitution != null) this.restitution = opts.restitution
    if (opts.mass != null && opts.mass > 0) this.mass = opts.mass
    if (opts.gravity) this.gravity.copy(opts.gravity)
  }

  setGravity(g: THREE.Vector3) {
    this.gravity.copy(g)
  }

  setSleepThresholds(velocity: number, frames: number) {
    if (Number.isFinite(velocity) && velocity > 0) this.sleepVelocityThresholdSq = velocity * velocity
    if (Number.isFinite(frames) && frames > 0) this.sleepFrameThreshold = Math.round(frames)
  }

  isSleeping() { return this.sleeping }
  wake() { this.sleeping = false; this.sleepFrames = 0 }

  setShape(shape: 'circle' | 'obb') { this.shape = shape }

  applyImpulse(point: THREE.Vector2, impulse: THREE.Vector2) {
    // Treat as impulse at center for simplicity; add tiny torque from offset
    const invMass = 1 / this.mass
    this.velocity.addScaledVector(impulse, invMass)
    const r = new THREE.Vector2(point.x - this.position.x, point.y - this.position.y)
    const torque = r.x * impulse.y - r.y * impulse.x
    this.angularVelocity += torque * 0.02 // crude inertia approximation
    this.wake()
  }

  getBoundingSphere() {
    return { center: this.position.clone(), radius: this.radius }
  }

  getAABB() {
    if (this.shape === 'circle') {
      const r = this.radius
      const min = new THREE.Vector2(this.position.x - r, this.position.y - r)
      const max = new THREE.Vector2(this.position.x + r, this.position.y + r)
      return { min, max }
    }
    // axis-aligned rectangle when angle≈0 (first pass)
    const min = new THREE.Vector2(this.position.x - this.hx, this.position.y - this.hy)
    const max = new THREE.Vector2(this.position.x + this.hx, this.position.y + this.hy)
    return { min, max }
  }

  update(dt: number, staticAABBs: Array<{ min: THREE.Vector2; max: THREE.Vector2 }>) {
    if (this.sleeping) return
    const ax = 0
    const ay = this.gravity.y

    // Integrate linear
    this.velocity.x += ax * dt
    this.velocity.y += ay * dt
    this.position.x += this.velocity.x * dt
    this.position.y += this.velocity.y * dt
    // Integrate angular (visual only for now)
    this.angle += this.angularVelocity * dt

    for (const box of staticAABBs) {
      if (this.shape === 'circle') {
        const closestX = Math.max(box.min.x, Math.min(this.position.x, box.max.x))
        const closestY = Math.max(box.min.y, Math.min(this.position.y, box.max.y))
        const dx = this.position.x - closestX
        const dy = this.position.y - closestY
        const distSq = dx * dx + dy * dy
        if (distSq <= this.radius * this.radius) {
          const dist = Math.max(1e-6, Math.sqrt(distSq))
          const nx = dx / dist
          const ny = dy / dist
          const penetration = this.radius - dist
          this.position.x += nx * penetration
          this.position.y += ny * penetration
          const vn = this.velocity.x * nx + this.velocity.y * ny
          const rx = this.velocity.x - (1 + this.restitution) * vn * nx
          const ry = this.velocity.y - (1 + this.restitution) * vn * ny
          this.velocity.set(rx, ry)
          this.angularVelocity += (dx * ry - dy * rx) * 0.01
        }
      } else {
        // OBB (axis-aligned for angle≈0): resolve against AABB via minimal penetration on axes
        const left = this.position.x - this.hx
        const right = this.position.x + this.hx
        const bottom = this.position.y - this.hy
        const top = this.position.y + this.hy
        const overlapX = right > box.min.x && left < box.max.x
        const overlapY = top > box.min.y && bottom < box.max.y
        if (overlapX && overlapY) {
          const penLeft = right - box.min.x
          const penRight = box.max.x - left
          const penBottom = top - box.min.y
          const penTop = box.max.y - bottom
          // Choose smallest penetration
          const minPen = Math.min(penLeft, penRight, penBottom, penTop)
          let nx = 0, ny = 0, pen = minPen
          if (minPen === penLeft) { nx = -1; ny = 0 }
          else if (minPen === penRight) { nx = 1; ny = 0 }
          else if (minPen === penBottom) { nx = 0; ny = -1 }
          else { nx = 0; ny = 1 }
          this.position.x += nx * pen
          this.position.y += ny * pen
          const vn = this.velocity.x * nx + this.velocity.y * ny
          const rx = this.velocity.x - (1 + this.restitution) * vn * nx
          const ry = this.velocity.y - (1 + this.restitution) * vn * ny
          this.velocity.set(rx, ry)
        }
      }
    }

    // Sleep check
    const v2 = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
    if (v2 < this.sleepVelocityThresholdSq) {
      this.sleepFrames++
      if (this.sleepFrames >= this.sleepFrameThreshold) this.sleeping = true
    } else {
      this.sleepFrames = 0
    }
  }
}
