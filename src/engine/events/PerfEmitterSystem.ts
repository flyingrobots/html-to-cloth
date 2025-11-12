import type { EngineSystem } from '../types'
import type { EventBus } from './bus'
import { EventIds } from './ids'

/** Publishes a simple perf row event each frame (ms from frame dt). */
export class PerfEmitterSystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = true
  private readonly bus: EventBus
  private readonly labelId = 0 // placeholder: string table not implemented in Phase 0

  constructor(opts: { bus: EventBus }) {
    this.id = 'perf-emitter'
    this.priority = 999
    this.bus = opts.bus
  }

  frameUpdate(dt: number): void {
    const ms = dt * 1000
    this.bus.publish('frameEnd', EventIds.PerfRow, (w) => {
      w.f32[0] = ms
      w.u32[0] = this.labelId
    })
  }
}

