import type { EngineSystem } from '../types'
import type { EventBus } from './bus'
import { EventIds } from './ids'

export type PerfLaneId = 0 | 1 | 2

/**
 * Publishes perf rows for one or more lanes. Each lane reports its wall-clock
 * time in milliseconds with a small numeric label id consumers can decode.
 */
export class PerfEmitterSystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = false
  private readonly bus: EventBus
  private readonly labelId: PerfLaneId

  constructor(opts: { bus: EventBus; laneId?: PerfLaneId }) {
    this.id = 'perf-emitter'
    this.priority = 999
    this.bus = opts.bus
    this.labelId = opts.laneId ?? 0
  }

  frameUpdate(dt: number): void {
    const ms = dt * 1000
    this.bus.publish('frameEnd', EventIds.PerfRow, (w) => {
      w.f32[0] = ms
      w.u32[0] = this.labelId
    })
  }
}
