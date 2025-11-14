import type { EngineSystem } from '../types'
import type { EventBus } from '../events/bus'
import { publishCollisionV2, publishImpulse, publishWake, publishSleep, publishPick } from '../events/typed'
import { obbVsAabb, type OBB } from '../../lib/collision/satObbAabb'

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

  fixedUpdate(dt: number) {
    const aabbs = this.getAabbs()
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
      b.center.x += b.velocity.x * dt
      b.center.y += b.velocity.y * dt
      const obb: OBB = { center: b.center, half: b.half, rotation: b.angle }
      for (const box of aabbs) {
        const res = obbVsAabb(obb, box)
        if (!res.collided) continue
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
    const obbA: OBB = { center: { x: a.center.x, y: a.center.y }, half: a.half, rotation: a.angle }
    const obbB: OBB = { center: { x: b.center.x, y: b.center.y }, half: b.half, rotation: b.angle }
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
}
