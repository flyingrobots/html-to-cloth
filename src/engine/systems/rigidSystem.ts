import type { EngineSystem } from '../types'
import { obbVsAabb, type OBB } from '../../lib/collision/satObbAabb'
import { applyRestitutionFriction } from '../../lib/collision/satObbAabb'
import { globalEventBus } from '../events/eventBus'

export type Vec2 = { x: number; y: number }
export type AABB = { min: Vec2; max: Vec2 }

export type DynamicBody = {
  id: string
  tag?: string | null
  center: Vec2
  half: Vec2
  rotation: number
  velocity: Vec2
  mass: number
  restitution: number
  friction: number
}

export class RigidSystem implements EngineSystem {
  id = 'rigid-system'
  priority = 95
  allowWhilePaused = false

  private readonly getAabbs: () => AABB[]
  private gravity = 9.81
  private readonly bodies: DynamicBody[] = []

  constructor(opts: { getAabbs: () => AABB[]; gravity?: number }) {
    this.getAabbs = opts.getAabbs
    if (typeof opts.gravity === 'number') this.gravity = opts.gravity
  }

  setGravity(g: number) { this.gravity = g }

  addBody(b: DynamicBody) {
    this.bodies.push(b)
  }

  removeBody(id: string) {
    const i = this.bodies.findIndex((b) => b.id === id)
    if (i !== -1) this.bodies.splice(i, 1)
  }

  fixedUpdate(dt: number) {
    const aabbs = this.getAabbs()
    for (const b of this.bodies) {
      // Integrate velocity (gravity in -Y canonical)
      b.velocity.y -= this.gravity * dt
      // Integrate position
      b.center.x += b.velocity.x * dt
      b.center.y += b.velocity.y * dt

      // Collide against static AABBs via SAT (OBB vs AABB)
      const obb: OBB = { center: b.center, half: b.half, rotation: b.rotation }
      for (const box of aabbs) {
        const res = obbVsAabb(obb, box)
        if (!res.collided) continue
        // Separate along MTV
        b.center.x += res.mtv.x
        b.center.y += res.mtv.y
        // Update velocity using restitution/friction
        const vAfter = applyRestitutionFriction(b.velocity, res.normal, b.restitution, b.friction)
        // Approx impulse magnitude (mass * deltaV along normal)
        const vn = b.velocity.x * res.normal.x + b.velocity.y * res.normal.y
        const vn2 = vAfter.x * res.normal.x + vAfter.y * res.normal.y
        const impulse = Math.abs((vn2 - vn) * b.mass)
        b.velocity = vAfter
        // Emit event
        globalEventBus.emit({
          type: 'collision',
          time: Date.now(),
          a: { id: b.id, tag: b.tag ?? undefined },
          b: { id: 'static', tag: null },
          normal: res.normal,
          mtv: res.mtv,
          impulse,
          restitution: b.restitution,
          friction: b.friction,
        })
      }
    }
  }
}

