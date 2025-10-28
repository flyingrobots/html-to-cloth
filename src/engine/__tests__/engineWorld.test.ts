import { describe, expect, it, vi } from 'vitest'

import { EngineWorld } from '../world'
import type { EngineSystem } from '../types'

const createSystem = (
  name: string,
  overrides: Partial<EngineSystem & { fixedUpdate: (dt: number) => void }> = {}
) => {
  const { fixedUpdate, ...rest } = overrides
  const mock = fixedUpdate
    ? vi.fn((dt: number) => {
        fixedUpdate(dt)
      })
    : vi.fn()

  return {
    id: name,
    fixedUpdate: mock,
    ...rest,
  } as EngineSystem
}

describe('EngineWorld', () => {
  it('ticks systems in priority order during each step', () => {
    const world = new EngineWorld()
    const low = createSystem('low')
    const high = createSystem('high')

    world.addSystem(low, { priority: -5 })
    world.addSystem(high, { priority: 10 })

    world.step(0.02)

    expect(high.fixedUpdate).toHaveBeenCalledWith(0.02)
    expect(low.fixedUpdate).toHaveBeenCalledWith(0.02)
    expect(high.fixedUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      low.fixedUpdate.mock.invocationCallOrder[0]
    )
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

  it('returns assigned id and supports removal by instance', () => {
    const world = new EngineWorld()
    const onAttach = vi.fn()
    const onDetach = vi.fn()
    const system = createSystem('instance-remove', { onAttach, onDetach })

    const id = world.addSystem(system, { priority: 1 })
    expect(typeof id).toBe('string')
    expect(onAttach).toHaveBeenCalledWith(world)

    world.removeSystemInstance(system)
    expect(onDetach).toHaveBeenCalledTimes(1)
  })
})
