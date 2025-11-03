import { describe, it, expect } from 'vitest'
import { validateEngineEvent, type EngineEvent } from '../types'
import { EventBus } from '../eventBus'

describe('Engine events validation + bus', () => {
  it('validates collision events', () => {
    const e: EngineEvent = {
      type: 'collision',
      time: Date.now(),
      a: { id: 'A' },
      b: { id: 'B' },
      normal: { x: 1, y: 0 },
      mtv: { x: 0.2, y: 0 },
      impulse: 3.4,
      restitution: 0.2,
      friction: 0.3,
    }
    expect(validateEngineEvent(e)).toBe(true)
  })

  it('rejects malformed events', () => {
    // Ensure validator is wired
    expect(typeof validateEngineEvent).toBe('function')
    // @ts-expect-error testing validator on intentionally malformed payload
    const bad = { type: 'collision', time: Date.now(), a: { id: 'A' } }
    expect(validateEngineEvent(bad)).toBe(false)
  })

  it('event bus emits to subscribers', () => {
    const bus = new EventBus()
    const seen: EngineEvent[] = []
    // First listener throws, second should still receive
    bus.on(() => { throw new Error('boom') })
    bus.on((e) => seen.push(e))
    const e: EngineEvent = { type: 'wake', id: 'A', time: 123 }
    expect(() => bus.emit(e)).not.toThrow()
    expect(seen[0]).toBe(e)
    // Bus remains functional
    const e2: EngineEvent = { type: 'sleep', id: 'B', time: 124 }
    bus.emit(e2)
    expect(seen[1]).toBe(e2)
  })
})
