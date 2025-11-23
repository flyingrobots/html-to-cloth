import type { EngineSystem } from '../types'
import type { EventBus } from '../events/bus'
import { publishCollisionV2, publishImpulse, publishWake, publishSleep, publishPick } from '../events/typed'
import { advanceWithCCD } from '../ccd/engineStepper'
import type { OBB as CcdObb, AABB as CcdAabb } from '../ccd/sweep'
import { obbVsAabb, type OBB as SatObb } from '../../lib/collision/satObbAabb'

export type AABB = { min: { x: number; y: number }; max: { x: number; y: number } }

export type RigidBody = {
  id: number
  center: { x: number; y: number }
  half: { x: number; y: number }
  angle: number
  velocity: { x: number; y: number }
  mass?: number
  angularVelocity?: number
  restitution: number
  friction: number
  /** Optional override: force CCD on (true) or off (false) regardless of speed threshold. */
  ccd?: boolean
}

export class RigidStaticSystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = false

  private readonly getAabbs: () => AABB[]
  private readonly bus: EventBus
  private readonly bodies: RigidBody[] = []
  private gravity = 9.81
  private readonly enableDynamicPairs: boolean
  private readonly sleepVelocityThresholdSq: number
  private readonly sleepFramesThreshold: number
  private readonly sleepState = new WeakMap<RigidBody, { framesBelow: number; sleeping: boolean }>()
  private ccdEnabled = false
  private ccdSpeedThreshold = Infinity
  private ccdEpsilon = 1e-4

  constructor(opts: {
    getAabbs: () => AABB[]
    bus: EventBus
    gravity?: number
    enableDynamicPairs?: boolean
    sleepVelocityThreshold?: number
    sleepFramesThreshold?: number
  }) {
    this.getAabbs = opts.getAabbs
    this.bus = opts.bus
    if (typeof opts.gravity === 'number') this.gravity = opts.gravity
    this.enableDynamicPairs = Boolean(opts.enableDynamicPairs)
    const v = typeof opts.sleepVelocityThreshold === 'number' ? Math.max(0, opts.sleepVelocityThreshold) : 0.01
    this.sleepVelocityThresholdSq = v * v
    this.sleepFramesThreshold = Math.max(1, Math.round(opts.sleepFramesThreshold ?? 60))
    this.id = 'rigid-static'
    this.priority = 96
  }

  addBody(b: RigidBody) { this.bodies.push(b) }
  removeBody(id: number) {
    const i = this.bodies.findIndex((b) => b.id === id)
    if (i !== -1) this.bodies.splice(i, 1)
  }

  getBodyCenter(id: number) {
    const body = this.bodies.find((b) => b.id === id)
    if (!body) return null
    return { x: body.center.x, y: body.center.y }
  }

  configureCcd(opts: { speedThreshold?: number; epsilon?: number; enabled?: boolean }) {
    if (typeof opts.speedThreshold === 'number') {
      this.ccdSpeedThreshold = Math.max(0, opts.speedThreshold)
    }
    if (typeof opts.epsilon === 'number') {
      this.ccdEpsilon = Math.max(1e-6, opts.epsilon)
    }
    if (typeof opts.enabled === 'boolean') {
      this.ccdEnabled = opts.enabled
    } else {
      this.ccdEnabled = true
    }
  }

  /** Debug helper: returns a snapshot of all rigid bodies (id, center, half). */
  debugGetBodies() {
    return this.bodies.map((b) => ({
      id: b.id,
      center: { x: b.center.x, y: b.center.y },
      half: { x: b.half.x, y: b.half.y },
    }))
  }

  fixedUpdate(dt: number) {
    const aabbs = this.getAabbs()
    const ccdObstacles: CcdAabb[] | null = this.ccdEnabled
      ? aabbs.map((box) => ({
          kind: 'aabb' as const,
          min: { x: box.min.x, y: box.min.y },
          max: { x: box.max.x, y: box.max.y },
        }))
      : null

    for (const b of this.bodies) {
      let state = this.sleepState.get(b)
      if (!state) {
        state = { framesBelow: 0, sleeping: false }
        this.sleepState.set(b, state)
      }

      // If body is already asleep, skip integration and collisions.
      if (state.sleeping) {
        continue
      }

      // Simple velocity-based sleep heuristic.
      const speedSq = b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y
      if (speedSq < this.sleepVelocityThresholdSq) {
        state.framesBelow += 1
        if (state.framesBelow >= this.sleepFramesThreshold) {
          state.sleeping = true
          b.velocity.x = 0
          b.velocity.y = 0
          publishSleep(this.bus, 'fixedEnd', { entityId: b.id >>> 0 })
          continue
        }
      } else {
        state.framesBelow = 0
      }

      // Integrate velocity (gravity in -Y canonical) and position
      b.velocity.y -= this.gravity * dt
      const speedSqAfter = b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y

      let ccdHit: { normal: { x: number; y: number }; point?: { x: number; y: number } } | null = null
      if (this.shouldUseCcd(b, speedSqAfter) && ccdObstacles && ccdObstacles.length > 0) {
        const sweep = this.advanceBodyWithCcd(b, dt, ccdObstacles)
        if (sweep?.collided) {
          ccdHit = { normal: sweep.normal, point: sweep.point }
        }
      } else {
        b.center.x += b.velocity.x * dt
        b.center.y += b.velocity.y * dt
      }

      const obb: SatObb = { center: b.center, half: b.half, rotation: b.angle }
      let hadCollision = false
      for (const box of aabbs) {
        const res = obbVsAabb(obb, box)
        if (!res.collided) continue
        hadCollision = true
        // Separate along MTV to resolve overlap (simple positional correction)
        b.center.x += res.mtv.x
        b.center.y += res.mtv.y
        // Compute linear impulse along normal (static surface)
        let n = res.normal
        const mass = b.mass && b.mass > 0 ? b.mass : 1
        const invMass = 1 / mass
        // Relative velocity at contact (ignore angular term in static-first lane)
        let vn = b.velocity.x * n.x + b.velocity.y * n.y
        // Ensure normal opposes incoming velocity for impulse calculation
        if (vn > 0) { n = { x: -n.x, y: -n.y }; vn = -vn }
        if (vn < 0) {
          const e = Math.max(0, Math.min(1, b.restitution))
          const jn = (-(1 + e) * vn) / (invMass > 0 ? 1 / invMass : 1)
          // Apply normal impulse
          b.velocity.x += (jn * n.x) * invMass
          b.velocity.y += (jn * n.y) * invMass
          // Tangential friction impulse
          const t = { x: -n.y, y: n.x }
          const vt = b.velocity.x * t.x + b.velocity.y * t.y
          const mu = Math.max(0, Math.min(1, b.friction))
          const jt = -vt / (invMass > 0 ? 1 / invMass : 1)
          const jtClamped = Math.max(-mu * jn, Math.min(mu * jn, jt))
          b.velocity.x += (jtClamped * t.x) * invMass
          b.velocity.y += (jtClamped * t.y) * invMass
        }
        // Approximate contact point along normal at box boundary (for event payload)
        const contact = { x: b.center.x - n.x * b.half.x, y: b.center.y - n.y * b.half.y }
        publishCollisionV2(this.bus, 'fixedEnd', {
          entityAId: b.id >>> 0,
          entityBId: 0,
          normal: n,
          contact,
          depth: Math.hypot(res.mtv.x, res.mtv.y),
        })
      }

      if (ccdHit && !hadCollision) {
        this.applyCcdVelocityResponse(b, ccdHit.normal)
        const contact = ccdHit.point ?? {
          x: b.center.x - ccdHit.normal.x * b.half.x,
          y: b.center.y - ccdHit.normal.y * b.half.y,
        }
        publishCollisionV2(this.bus, 'fixedEnd', {
          entityAId: b.id >>> 0,
          entityBId: 0,
          normal: ccdHit.normal,
          contact,
          depth: this.ccdEpsilon,
        })
      }
    }

    if (this.enableDynamicPairs && this.bodies.length > 1) {
      this.resolveDynamicPairs()
    }
  }

  private resolveDynamicPairs() {
    const bodies = this.bodies
    const n = bodies.length
    for (let i = 0; i < n; i++) {
      const a = bodies[i]
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j]
        this.handleDynamicPair(a, b)
      }
    }
  }

  private markAwake(body: RigidBody) {
    const state = this.sleepState.get(body)
    if (state) {
      state.sleeping = false
      state.framesBelow = 0
    }
  }

  private handleDynamicPair(a: RigidBody, b: RigidBody) {
    // Treat dynamic bodies as OBBs and use the same SAT helper as static collisions.
    const obbA: SatObb = { center: { x: a.center.x, y: a.center.y }, half: a.half, rotation: a.angle }
    const obbB: SatObb = { center: { x: b.center.x, y: b.center.y }, half: b.half, rotation: b.angle }
    const resAB = obbVsAabb(obbA, {
      min: { x: obbB.center.x - obbB.half.x, y: obbB.center.y - obbB.half.y },
      max: { x: obbB.center.x + obbB.half.x, y: obbB.center.y + obbB.half.y },
    })
    const resBA = obbVsAabb(obbB, {
      min: { x: obbA.center.x - obbA.half.x, y: obbA.center.y - obbA.half.y },
      max: { x: obbA.center.x + obbA.half.x, y: obbA.center.y + obbA.half.y },
    })
    if (!resAB.collided && !resBA.collided) return

    // Choose the shallower penetration as the contact frame to reduce jitter.
    const useAB = resAB.collided && (!resBA.collided || resAB.depth <= resBA.depth)
    const depth = useAB ? resAB.depth : resBA.depth
    let normal = useAB ? resAB.normal : { x: -resBA.normal.x, y: -resBA.normal.y }

    const halfDepth = depth * 0.5
    a.center.x -= normal.x * halfDepth
    a.center.y -= normal.y * halfDepth
    b.center.x += normal.x * halfDepth
    b.center.y += normal.y * halfDepth

    const massA = a.mass && a.mass > 0 ? a.mass : 1
    const massB = b.mass && b.mass > 0 ? b.mass : 1
    const invMassA = 1 / massA
    const invMassB = 1 / massB

    const relVelX = a.velocity.x - b.velocity.x
    const relVelY = a.velocity.y - b.velocity.y
    let vn = relVelX * normal.x + relVelY * normal.y
    if (vn > 0) {
      normal = { x: -normal.x, y: -normal.y }
      vn = -vn
    }
    if (vn < 0) {
      const restitution = Math.max(
        0,
        Math.min(1, ((a.restitution ?? 0) + (b.restitution ?? 0)) * 0.5)
      )
      const jn = (-(1 + restitution) * vn) / (invMassA + invMassB)
      const jx = jn * normal.x
      const jy = jn * normal.y

      a.velocity.x += jx * invMassA
      a.velocity.y += jy * invMassA
      b.velocity.x -= jx * invMassB
      b.velocity.y -= jy * invMassB

      const tx = -normal.y
      const ty = normal.x
      const vt = relVelX * tx + relVelY * ty
      const friction = Math.max(
        0,
        Math.min(1, ((a.friction ?? 0) + (b.friction ?? 0)) * 0.5)
      )
      const jt = -vt / (invMassA + invMassB)
      const jtClamped = Math.max(-friction * jn, Math.min(friction * jn, jt))
      const fx = jtClamped * tx
      const fy = jtClamped * ty

      a.velocity.x += fx * invMassA
      a.velocity.y += fy * invMassA
      b.velocity.x -= fx * invMassB
      b.velocity.y -= fy * invMassB

      // Approximate contact at midpoint between centers.
      const contact = {
        x: (a.center.x + b.center.x) * 0.5,
        y: (a.center.y + b.center.y) * 0.5,
      }

      publishCollisionV2(this.bus, 'fixedEnd', {
        entityAId: a.id >>> 0,
        entityBId: b.id >>> 0,
        normal,
        contact,
        depth,
      })

      publishImpulse(this.bus, 'fixedEnd', {
        entityId: a.id >>> 0,
        impulse: { x: jx + fx, y: jy + fy },
      })
      publishImpulse(this.bus, 'fixedEnd', {
        entityId: b.id >>> 0,
        impulse: { x: -jx - fx, y: -jy - fy },
      })

      // Wake both bodies if they were sleeping.
      this.markAwake(a)
      this.markAwake(b)
      publishWake(this.bus, 'fixedEnd', { entityId: a.id >>> 0 })
      publishWake(this.bus, 'fixedEnd', { entityId: b.id >>> 0 })
    }
  }

  pickAt(point: { x: number; y: number }) {
    const { pickBodyAtPoint } = require('../physics/picking') as typeof import('../physics/picking')
    const candidates = this.bodies.map((b) => ({
      id: b.id,
      center: { x: b.center.x, y: b.center.y },
      half: { x: b.half.x, y: b.half.y },
    }))
    const hit = pickBodyAtPoint(point, candidates)
    if (!hit) return
    publishPick(this.bus, 'frameEnd', {
      entityId: hit.id >>> 0,
      point: hit.point,
    })
  }

  private shouldUseCcd(body: RigidBody, speedSq: number) {
    if (!this.ccdEnabled) return false
    if (body.ccd === true) return true
    if (body.ccd === false) return false
    return Math.sqrt(speedSq) >= this.ccdSpeedThreshold
  }

  private advanceBodyWithCcd(body: RigidBody, dt: number, obstacles: CcdAabb[]) {
    if (obstacles.length === 0) {
      body.center.x += body.velocity.x * dt
      body.center.y += body.velocity.y * dt
      return null
    }
    const shape: CcdObb = {
      kind: 'obb',
      center: { x: body.center.x, y: body.center.y },
      half: { x: body.half.x, y: body.half.y },
      angle: body.angle,
    }
    const sweep = advanceWithCCD(shape, { x: body.velocity.x, y: body.velocity.y }, dt, obstacles, {
      epsilon: this.ccdEpsilon,
    })
    body.center.x = sweep.center.x
    body.center.y = sweep.center.y
    return sweep
  }

  private applyCcdVelocityResponse(body: RigidBody, normal: { x: number; y: number }) {
    const mass = body.mass && body.mass > 0 ? body.mass : 1
    const invMass = 1 / mass
    let n = normal
    let vn = body.velocity.x * n.x + body.velocity.y * n.y
    if (vn > 0) {
      n = { x: -n.x, y: -n.y }
      vn = -vn
    }
    if (vn < 0) {
      const e = Math.max(0, Math.min(1, body.restitution))
      const jn = (-(1 + e) * vn) / (invMass > 0 ? 1 / invMass : 1)
      body.velocity.x += (jn * n.x) * invMass
      body.velocity.y += (jn * n.y) * invMass
    }
  }
}
