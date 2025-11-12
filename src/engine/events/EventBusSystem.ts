import type { EngineSystem } from '../types'
import type { EngineWorld } from '../world'
import { EventBus, type Channel } from './bus'

export class EventBusSystem implements EngineSystem<EngineWorld> {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly bus: EventBus
  private frameIndex = 0

  constructor(opts?: { capacity?: number; mailboxCapacity?: number }) {
    this.bus = new EventBus({ capacity: opts?.capacity, mailboxCapacity: opts?.mailboxCapacity })
    this.id = 'event-bus'
    this.priority = 1000
  }

  getBus() {
    return this.bus
  }

  fixedUpdate(_dt: number) {
    // Phase 0: no-op. Tick/seq set by publish; frameIndex advanced on frameUpdate.
  }

  frameUpdate(_dt: number) {
    this.frameIndex++
  }
}

