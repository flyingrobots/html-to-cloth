import type { EngineSystem } from '../types'
import type { EventBus } from '../events/bus'
import { publishCollisionV2 } from '../events/typed'
import { obbVsAabb, type OBB } from '../../lib/collision/satObbAabb'

export type AABB = { min: { x: number; y: number }; max: { x: number; y: number } }

export type RigidBody = {
  id: number
  center: { x: number; y: number }
  half: { x: number; y: number }
  angle: number
  velocity: { x: number; y: number }
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

  constructor(opts: { getAabbs: () => AABB[]; bus: EventBus; gravity?: number }) {
    this.getAabbs = opts.getAabbs
    this.bus = opts.bus
    if (typeof opts.gravity === 'number') this.gravity = opts.gravity
    this.id = 'rigid-static'
    this.priority = 96
  }

  addBody(b: RigidBody) { this.bodies.push({ ...b }) }
  removeBody(id: number) {
    const i = this.bodies.findIndex((b) => b.id === id)
    if (i !== -1) this.bodies.splice(i, 1)
  }

  fixedUpdate(dt: number) {
    const aabbs = this.getAabbs()
    for (const b of this.bodies) {
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
        // Approximate contact point along normal at box boundary
        const contact = { x: b.center.x - res.normal.x * b.half.x, y: b.center.y - res.normal.y * b.half.y }
        publishCollisionV2(this.bus, 'fixedEnd', {
          entityAId: b.id >>> 0,
          entityBId: 0,
          normal: res.normal,
          contact,
          depth: Math.hypot(res.mtv.x, res.mtv.y),
        })
      }
    }
  }
}

