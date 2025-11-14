import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../bus'
import { EventIds } from '../ids'
import { WakeMarkerSystem } from '../WakeMarkerSystem'
import { DebugOverlayState } from '../../render/DebugOverlayState'

describe('WakeMarkerSystem', () => {
  it('adds wake markers when Wake events are published and fades them over time', () => {
    const bus = new EventBus({ capacity: 32, mailboxCapacity: 32 })
    const overlay = new DebugOverlayState()

    const getPosition = vi.fn((id: number) => {
      if (id === 42) return { x: 1, y: 2 }
      return null
    })

    const system = new WakeMarkerSystem({
      bus,
      overlay,
      getPosition,
      lifetimeFrames: 3,
    })

    expect(overlay.wakeMarkers).toEqual([])

    // Publish a Wake event for entity 42.
    bus.publish('fixedEnd', EventIds.Wake, (w) => {
      w.u32[0] = 42
    })

    // First frameUpdate should consume the event and create a marker.
    system.frameUpdate(0.016 as any)
    expect(getPosition).toHaveBeenCalledWith(42)
    expect(overlay.wakeMarkers).toHaveLength(1)
    expect(overlay.wakeMarkers[0]).toMatchObject({ x: 1, y: 2 })

    // After lifetimeFrames calls, marker should be gone.
    system.frameUpdate(0.016 as any)
    system.frameUpdate(0.016 as any)
    system.frameUpdate(0.016 as any)
    expect(overlay.wakeMarkers).toEqual([])
  })

  it('ignores Wake events when position resolver returns null', () => {
    const bus = new EventBus({ capacity: 16, mailboxCapacity: 16 })
    const overlay = new DebugOverlayState()

    const getPosition = vi.fn(() => null)

    const system = new WakeMarkerSystem({
      bus,
      overlay,
      getPosition,
      lifetimeFrames: 2,
    })

    bus.publish('fixedEnd', EventIds.Wake, (w) => {
      w.u32[0] = 7
    })

    system.frameUpdate(0.016 as any)
    expect(getPosition).toHaveBeenCalledWith(7)
    expect(overlay.wakeMarkers).toEqual([])
  })
})

