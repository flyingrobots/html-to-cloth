import type { EngineSystem } from '../types'
import type { EventBus } from './bus'
import { EventIds } from './ids'
import type { DebugOverlayState } from '../render/DebugOverlayState'

type WakeMarker = {
  x: number
  y: number
  ttl: number
}

export type WakeMarkerSystemOptions = {
  bus: EventBus
  overlay: DebugOverlayState
  /** Map entity id → world-space center position; return null if unknown. */
  getPosition: (entityId: number) => { x: number; y: number } | null
  /** Number of frameUpdate calls a marker should persist for. */
  lifetimeFrames?: number
}

/**
 * Debug system that listens for Wake events on the bus and populates
 * DebugOverlayState.wakeMarkers with short-lived world-space markers.
 */
export class WakeMarkerSystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly overlay: DebugOverlayState
  private readonly getPosition: (entityId: number) => { x: number; y: number } | null
  private readonly lifetimeFrames: number
  private readonly cursor: import('./bus').EventCursor
  private markers: WakeMarker[] = []

  constructor(options: WakeMarkerSystemOptions) {
    this.overlay = options.overlay
    this.getPosition = options.getPosition
    this.lifetimeFrames = Math.max(1, Math.round(options.lifetimeFrames ?? 12))
    this.id = 'wake-markers'
    this.priority = 8
    this.cursor = options.bus.subscribe('wakeMarkers', [
      { channel: 'fixedEnd', ids: [EventIds.Wake] },
    ])
  }

  frameUpdate(): void {
    // Drain wake events and append markers.
    this.cursor.read('fixedEnd', (_h, r) => {
      const id = r.u32[0] >>> 0
      const pos = this.getPosition(id)
      if (!pos) return
      this.markers.push({ x: pos.x, y: pos.y, ttl: this.lifetimeFrames })
    })

    if (!this.markers.length) {
      this.overlay.wakeMarkers = []
      return
    }

    // Decay and publish a copy into overlay state.
    this.markers = this.markers
      .map((m) => ({ ...m, ttl: m.ttl - 1 }))
      .filter((m) => m.ttl > 0)

    this.overlay.wakeMarkers = this.markers.map(({ x, y }) => ({ x, y }))
  }
}
