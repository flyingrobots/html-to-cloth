import type { EngineSystem } from '../types'
import type { EventBus } from './bus'
import { EventIds } from './ids'
import type { DebugOverlayState } from '../render/DebugOverlayState'

/**
 * Reads pointer move events from the bus and mirrors them into DebugOverlayState.
 * Isolated adapter so DebugOverlaySystem remains render-only.
 */
export class EventOverlayAdapter implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly bus: EventBus
  private readonly overlay: DebugOverlayState
  private cursor: import('./bus').EventCursor

  constructor(opts: { bus: EventBus; overlay: DebugOverlayState }) {
    this.bus = opts.bus
    this.overlay = opts.overlay
    this.id = 'event-overlay-adapter'
    this.priority = 9
    this.cursor = this.bus.subscribe('overlay', [
      { channel: 'frameBegin', ids: [EventIds.PointerMove] },
    ])
  }

  frameUpdate(): void {
    this.cursor.read('frameBegin', (_h, r) => {
      // f32[0]=x, f32[1]=y
      const x = r.f32[0]
      const y = r.f32[1]
      this.overlay.pointer.set(x, y)
    })
  }
}
