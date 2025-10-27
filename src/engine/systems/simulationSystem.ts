import type { Vector2, Vector3 } from 'three'

import type {
  SimWorld,
  SimBody,
  SimWorldSnapshot,
  SimWarmStartConfig,
  SimSleepConfig,
} from '../../lib/simWorld'
import type { EngineWorld } from '../world'
import type { EngineLogger, EngineSystem } from '../types'

export type SimulationSystemOptions = {
  simWorld: SimWorld
}

type BodyRecord = {
  body: SimBody
  warmStart?: SimWarmStartConfig
  pendingWarmStart: boolean
  sleep?: SimSleepConfig
  pendingSleep: boolean
}

export type RegisterBodyOptions = {
  warmStart?: SimWarmStartConfig
  sleep?: SimSleepConfig
}

const DEFAULT_LOGGER: EngineLogger = {
  error: (...args: unknown[]) => console.error(...args),
}

function freezeSnapshot(snapshot: SimWorldSnapshot): Readonly<SimWorldSnapshot> {
  for (const body of snapshot.bodies) {
    Object.freeze(body.center)
    Object.freeze(body)
  }
  Object.freeze(snapshot.bodies)
  return Object.freeze(snapshot)
}

let systemCounter = 0

/**
 * Engine system responsible for orchestrating cloth simulation bodies. Acts as the bridge
 * between the fixed-step engine loop and the `SimWorld`, managing warm-start/sleep queues
 * and exposing immutable snapshots for read-only consumers.
 */
export class SimulationSystem implements EngineSystem<EngineWorld> {
  id: string
  allowWhilePaused = false

  private readonly simWorld: SimWorld
  private readonly bodies = new Map<string, BodyRecord>()
  private snapshot: Readonly<SimWorldSnapshot> = freezeSnapshot({ bodies: [] })
  private logger: EngineLogger = DEFAULT_LOGGER

  constructor(options: SimulationSystemOptions) {
    if (!options?.simWorld) {
      throw new Error('SimulationSystem requires a valid simWorld instance')
    }
    this.simWorld = options.simWorld
    this.id = `simulation-${systemCounter++}`
  }

  onAttach(world: EngineWorld) {
    this.logger = world.getLogger()
  }

  onDetach() {
    this.bodies.clear()
    this.snapshot = freezeSnapshot({ bodies: [] })
  }

  fixedUpdate(dt: number) {
    this.flushPendingConfiguration()
    this.simWorld.step(dt)
    this.snapshot = freezeSnapshot(this.simWorld.getSnapshot())
  }

  notifyPointer(point: Vector2) {
    this.simWorld.notifyPointer(point)
  }

  /** Registers a new simulated body with optional warm-start and sleep configuration. */
  addBody(body: SimBody, options: RegisterBodyOptions = {}) {
    if (this.bodies.has(body.id) || this.simWorld.hasBody(body.id)) {
      throw new Error(`Simulation body with id '${body.id}' already registered`)
    }
    this.simWorld.addBody(body)
    const record: BodyRecord = {
      body,
      warmStart: options.warmStart,
      pendingWarmStart: Boolean(options.warmStart),
      sleep: options.sleep,
      pendingSleep: Boolean(options.sleep),
    }

    this.bodies.set(body.id, record)
  }

  removeBody(id: string) {
    if (!this.bodies.has(id)) return
    this.bodies.delete(id)
    this.simWorld.removeBody(id)
  }

  clear() {
    this.simWorld.clear()
    this.bodies.clear()
    this.snapshot = freezeSnapshot({ bodies: [] })
  }

  /** Queues a warm-start configuration to be applied on the next fixed update. */
  queueWarmStart(id: string, config: SimWarmStartConfig) {
    const record = this.bodies.get(id)
    if (!record) return
    record.warmStart = config
    record.pendingWarmStart = true
  }

  /** Queues updated sleep thresholds to be applied on the next fixed update. */
  queueSleepConfiguration(id: string, config: SimSleepConfig) {
    const record = this.bodies.get(id)
    if (!record) return
    record.sleep = config
    record.pendingSleep = true
  }

  /** Returns the most recent snapshot captured after the last fixed update. */
  getSnapshot(): Readonly<SimWorldSnapshot> {
    return this.snapshot
  }

  /** Broadcasts constraint iteration changes to any bodies exposing the optional hook. */
  broadcastConstraintIterations(iterations: number) {
    const count = Math.max(1, Math.round(iterations))
    ;(this.simWorld as any).forEachBody?.((body: SimBody) => body.setConstraintIterations?.(count))
  }

  /** Broadcasts gravity changes to any bodies exposing the optional hook. */
  broadcastGravity(gravity: Vector3) {
    ;(this.simWorld as any).forEachBody?.((body: SimBody) => body.setGlobalGravity?.(gravity))
  }

  private flushPendingConfiguration() {
    for (const record of this.bodies.values()) {
      if (record.pendingSleep && record.sleep) {
        try {
          record.body.configureSleep?.(record.sleep)
          record.pendingSleep = false
        } catch (error) {
          this.logger.error(`Failed to apply sleep configuration for body ${record.body.id}`, error)
        }
      }

      if (record.pendingWarmStart && record.warmStart) {
        try {
          record.body.warmStart?.(record.warmStart)
          record.pendingWarmStart = false
        } catch (error) {
          this.logger.error(`Failed to apply warm start for body ${record.body.id}`, error)
        }
      }
    }
  }
}
