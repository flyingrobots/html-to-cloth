import type { EngineSystem } from '../types'
import type { EventBus } from '../events/bus'
import { RigidStaticSystem, type RigidBody, type AABB } from './rigidStaticSystem'

export type PhysicsSystemOptions = {
  bus: EventBus
  getAabbs: () => AABB[]
  gravity?: number
  enableDynamicPairs?: boolean
}

/**
 * Minimal orchestrator that runs rigid (static-first) before other lanes.
 * Cloth continues to be driven by the existing SimulationSystem separately.
 */
export class PhysicsSystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = false

  private readonly rigid: RigidStaticSystem

  constructor(opts: PhysicsSystemOptions) {
    this.rigid = new RigidStaticSystem({
      getAabbs: opts.getAabbs,
      bus: opts.bus,
      gravity: opts.gravity,
      enableDynamicPairs: opts.enableDynamicPairs,
    })
    this.id = 'physics-core'
    this.priority = 101 // run before SimulationSystem (100)
  }

  fixedUpdate(dt: number): void {
    this.rigid.fixedUpdate(dt)
  }

  addRigidBody(b: RigidBody) { this.rigid.addBody(b) }
  removeRigidBody(id: number) { this.rigid.removeBody(id) }

  pickAt(point: { x: number; y: number }) {
    // Delegate to rigid system if it exposes a picking helper in the future.
    if (typeof (this.rigid as any).pickAt === 'function') {
      ;(this.rigid as any).pickAt(point)
    }
  }
}
