import { describe, expect, it, vi } from 'vitest'

import { EngineWorld } from '../world'
import { SimulationRunner } from '../simulationRunner'
import type { EngineSystem } from '../types'

const createSystem = () => {
  const system: EngineSystem = {
    id: 'test',
    fixedUpdate: vi.fn(),
  }
  return system
}

describe('SimulationRunner', () => {
  it('ticks the engine world while in real-time mode', () => {
    const world = new EngineWorld()
    const system = createSystem()
    world.addSystem(system, { id: 'test' })

    const runner = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })
    runner.update(1 / 30)

    expect(system.fixedUpdate).toHaveBeenCalled()
  })

  it('respects substep configuration for manual stepping', () => {
    const world = new EngineWorld()
    const system = createSystem()
    world.addSystem(system, { id: 'test' })

    const runner = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })
    runner.setSubsteps(3)

    runner.stepOnce()

    expect(system.fixedUpdate).toHaveBeenCalledTimes(3)
    const durations = system.fixedUpdate?.mock.calls.map(([dt]) => dt)
    durations.forEach((dt) => expect(dt).toBeCloseTo(1 / 180))
  })

  it('pauses updates when real-time mode is disabled', () => {
    const world = new EngineWorld()
    const system = createSystem()
    world.addSystem(system, { id: 'test' })

    const runner = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })
    runner.setRealTime(false)
    runner.update(1 / 30)

    expect(system.fixedUpdate).not.toHaveBeenCalled()
    expect(world.isPaused()).toBe(true)
  })

  it('does not advance immediately when resuming real-time', () => {
    const world = new EngineWorld()
    const system = createSystem()
    world.addSystem(system, { id: 'test' })

    const runner = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })

    runner.update(1 / 60)
    system.fixedUpdate.mockClear()

    runner.setRealTime(false)
    runner.update(1 / 60)
    expect(system.fixedUpdate).not.toHaveBeenCalled()

    runner.setRealTime(true)
    expect(system.fixedUpdate).not.toHaveBeenCalled()

    runner.update(1 / 60)
    expect(system.fixedUpdate).toHaveBeenCalledTimes(1)
    expect(world.isPaused()).toBe(false)
  })

  it('allows manual stepping while paused', () => {
    const world = new EngineWorld()
    const system = createSystem()
    world.addSystem(system, { id: 'test' })

    const runner = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })
    runner.setRealTime(false)

    runner.stepOnce()

    expect(system.fixedUpdate).toHaveBeenCalled()
  })
})
