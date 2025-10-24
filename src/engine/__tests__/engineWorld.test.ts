import { describe, expect, it, vi } from 'vitest'

import { EngineWorld } from '../world'
import type { EngineSystem } from '../types'

const createSystem = (
  name: string,
  overrides: Partial<EngineSystem & { fixedUpdate: (dt: number) => void }> = {}
) => {
  const fixedUpdate = overrides.fixedUpdate
    ? vi.fn(overrides.fixedUpdate.bind(overrides))
    : vi.fn()

  const system: EngineSystem & { calls: Array<{ name: string; dt: number }> } = {
    id: name,
    fixedUpdate,
    calls: [],
    ...overrides,
  }

  if (!overrides.fixedUpdate) {
    system.fixedUpdate = vi.fn((dt: number) => {
      system.calls.push({ name, dt })
    })
  } else {
    system.fixedUpdate = vi.fn((dt: number) => {
      system.calls.push({ name, dt })
      fixedUpdate(dt)
    })
  }

  return system
}

describe('EngineWorld', () => {
  it('ticks systems in priority order during each step', () => {
    const world = new EngineWorld()
    const calls: string[] = []

    const low = createSystem('low', {
      fixedUpdate: (dt) => {
        calls.push(`low:${dt.toFixed(3)}`)
      },
    })
    const high = createSystem('high', {
      fixedUpdate: (dt) => {
        calls.push(`high:${dt.toFixed(3)}`)
      },
    })

    world.addSystem(low, { priority: -5 })
    world.addSystem(high, { priority: 10 })

    world.step(0.02)

    expect(calls).toEqual(['high:0.020', 'low:0.020'])
  })

  it('skips non-unpauseable systems while paused', () => {
    const world = new EngineWorld()
    const paused = createSystem('paused')
    const always = createSystem('always', { allowWhilePaused: true })

    world.addSystem(paused)
    world.addSystem(always, { allowWhilePaused: true })

    world.setPaused(true)
    world.step(0.016)

    expect(always.fixedUpdate).toHaveBeenCalledTimes(1)
    expect(paused.fixedUpdate).not.toHaveBeenCalled()
  })

  it('invokes lifecycle hooks exactly once', () => {
    const world = new EngineWorld()
    const onAttach = vi.fn()
    const onDetach = vi.fn()

    const system = createSystem('lifecycle', {
      onAttach,
      onDetach,
    })

    world.addSystem(system)
    expect(onAttach).toHaveBeenCalledTimes(1)
    expect(onAttach).toHaveBeenCalledWith(world)

    world.removeSystem(system.id ?? 'lifecycle')
    expect(onDetach).toHaveBeenCalledTimes(1)
  })
})
