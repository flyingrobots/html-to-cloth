import * as THREE from 'three'

import type {
  SimWorld,
  SimBody,
  SimWorldSnapshot,
  SimWarmStartConfig,
  SimSleepConfig,
} from '../../lib/simWorld'
import type { EngineWorld } from '../world'
import type { EngineSystem } from '../types'

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

/**
 * Engine system responsible for orchestrating cloth simulation bodies. Acts as the bridge
 * between the fixed-step engine loop and the `SimWorld`, managing warm-start/sleep queues
 * and exposing immutable snapshots for read-only consumers.
 */
export class SimulationSystem implements EngineSystem {
  id = 'simulation'
  allowWhilePaused = false

  private readonly simWorld: SimWorld
  private world: EngineWorld | null = null
  private readonly bodies = new Map<string, BodyRecord>()
  private snapshot: SimWorldSnapshot = { bodies: [] }

  constructor(options: SimulationSystemOptions) {
    this.simWorld = options.simWorld
  }

  onAttach(world: EngineWorld) {
    this.world = world
  }

  onDetach() {
    this.world = null
    this.clear()
  }

  fixedUpdate(dt: number) {
    this.flushPendingConfiguration()
    this.simWorld.step(dt)
    this.snapshot = this.simWorld.getSnapshot()
  }

  notifyPointer(point: THREE.Vector2) {
    this.simWorld.notifyPointer(point)
  }

  /** Registers a new simulated body with optional warm-start and sleep configuration. */
  addBody(body: SimBody, options: RegisterBodyOptions = {}) {
    const record: BodyRecord = {
      body,
      warmStart: options.warmStart,
      pendingWarmStart: Boolean(options.warmStart),
      sleep: options.sleep,
      pendingSleep: Boolean(options.sleep),
    }

    this.bodies.set(body.id, record)
    this.simWorld.addBody(body)
  }

  removeBody(id: string) {
    this.bodies.delete(id)
    this.simWorld.removeBody(id)
  }

  clear() {
    this.simWorld.clear()
    this.bodies.clear()
    this.snapshot = { bodies: [] }
  }

  /** Queues a warm-start configuration to be applied on the next fixed update. */
  queueWarmStart(id: string, config?: SimWarmStartConfig) {
    const record = this.bodies.get(id)
    if (!record) return
    if (config) {
      record.warmStart = config
    }
    if (record.warmStart) {
      record.pendingWarmStart = true
    }
  }

  /** Queues updated sleep thresholds to be applied on the next fixed update. */
  queueSleepConfiguration(id: string, config: SimSleepConfig) {
    const record = this.bodies.get(id)
    if (!record) return
    record.sleep = config
    record.pendingSleep = true
  }

  /** Returns the most recent snapshot captured after the last fixed update. */
  getSnapshot() {
    return this.snapshot
  }

  private flushPendingConfiguration() {
    for (const record of this.bodies.values()) {
      if (record.pendingSleep && record.sleep && record.body.configureSleep) {
        record.body.configureSleep(record.sleep)
        record.pendingSleep = false
      }

      if (record.pendingWarmStart && record.warmStart && record.body.warmStart) {
        record.body.warmStart(record.warmStart)
        record.pendingWarmStart = false
      }
    }
  }
}
