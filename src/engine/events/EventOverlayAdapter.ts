import type { EngineSystem } from '../types'
import type { EventBus } from './bus'
import { EventIds } from './ids'
import type { DebugOverlayState } from '../render/DebugOverlayState'

type LogSink = (batch: Array<{ ch: string; id: number; payload: any; ts: number }>) => void

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
  private buffer: Array<{ ch: string; id: number; payload: any; ts: number }> = []
  private logSink?: LogSink
  private lastFlush = 0

  constructor(opts: { bus: EventBus; overlay: DebugOverlayState; logSink?: LogSink }) {
    this.bus = opts.bus
    this.overlay = opts.overlay
    this.logSink = opts.logSink
    this.id = 'event-overlay-adapter'
    this.priority = 9
    this.cursor = this.bus.subscribe('overlay', [
      { channel: 'frameBegin', ids: [EventIds.PointerMove] },
      { channel: 'frameEnd', ids: [EventIds.PerfRow, EventIds.CollisionV2, EventIds.Sleep, EventIds.Wake, EventIds.CcdHit, EventIds.RegistryAdd, EventIds.RegistryUpdate, EventIds.RegistryRemove] },
      { channel: 'immediate', ids: [EventIds.EventLogFlush] },
    ])
  }

  frameUpdate(): void {
    const now = performance.now()
    this.cursor.read('frameBegin', (_h, r) => {
      // f32[0]=x, f32[1]=y
      const x = r.f32[0]
      const y = r.f32[1]
      this.overlay.pointer.set(x, y)
      this.maybeBuffer('frameBegin', EventIds.PointerMove, { x, y }, now)
    })

    this.cursor.read('frameEnd', (h, r) => {
      // capture small payloads where possible
      let payload: any = null
      if (h.id === EventIds.PerfRow) {
        payload = { ms: r.f32[0] }
      } else if (h.id === EventIds.CollisionV2) {
        payload = { a: r.i32[0], b: r.i32[1] }
      } else if (h.id === EventIds.CcdHit) {
        payload = { t: r.f32[0], nx: r.f32[1], ny: r.f32[2] }
      } else if (h.id === EventIds.RegistryAdd || h.id === EventIds.RegistryUpdate || h.id === EventIds.RegistryRemove) {
        payload = { entity: r.i32[0] }
      }
      this.maybeBuffer('frameEnd', h.id, payload, now)
    })

    // Flush on explicit request
    this.cursor.read('immediate', (h, _r) => {
      if (h.id === EventIds.EventLogFlush) this.flush()
    })

    // Periodic flush (1s) to avoid unbounded growth
    if (this.buffer.length > 0 && now - this.lastFlush > 1000) {
      this.flush()
    }
  }

  private maybeBuffer(ch: string, id: number, payload: any, ts: number) {
    this.buffer.push({ ch, id, payload, ts })
  }

  flush() {
    if (this.buffer.length === 0) return
    const snapshot = this.captureSnapshot()
    if (snapshot) {
      this.buffer.push({ ch: 'snapshot', id: EventIds.SimSnapshotReady, payload: snapshot, ts: performance.now() })
    }
    if (this.logSink) {
      try { this.logSink(this.buffer.slice()) } catch {}
    }
    this.buffer.length = 0
    this.lastFlush = performance.now()
  }

  private captureSnapshot() {
    try {
      const vv = (typeof window !== 'undefined' && (window as any).visualViewport) || null
      const vvSnap = vv
        ? { w: vv.width ?? 0, h: vv.height ?? 0, x: vv.offsetLeft ?? 0, y: vv.offsetTop ?? 0 }
        : null
      return {
        aabbs: this.overlay.aabbs ?? [],
        domRects: this.overlay.domRects ?? [],
        sim: this.overlay.simSnapshot ?? null,
        rigid: this.overlay.rigidBodies ?? [],
        pointer: this.overlay.pointer ? { x: this.overlay.pointer.x, y: this.overlay.pointer.y } : null,
        inner: { w: typeof window !== 'undefined' ? window.innerWidth : 0, h: typeof window !== 'undefined' ? window.innerHeight : 0 },
        vv: vvSnap,
      }
    } catch {
      return null
    }
  }
}
