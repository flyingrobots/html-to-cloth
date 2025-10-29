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

    expect(system.fixedUpdate!).toHaveBeenCalled()
  })

  it('respects substep configuration for manual stepping', () => {
    const world = new EngineWorld()
    const system = createSystem()
    world.addSystem(system, { id: 'test' })

    const runner = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })
    runner.setSubsteps(3)

    runner.stepOnce()

    expect(system.fixedUpdate!).toHaveBeenCalledTimes(3)
    const durations = (system.fixedUpdate as any).mock.calls.map((args: [number]) => args[0])
    durations.forEach((dt: number) => expect(dt).toBeCloseTo(1 / 180))
  })

  it('pauses updates when real-time mode is disabled', () => {
    const world = new EngineWorld()
    const system = createSystem()
    world.addSystem(system, { id: 'test' })

    const runner = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })
    runner.setRealTime(false)
    runner.update(1 / 30)

    expect(system.fixedUpdate!).not.toHaveBeenCalled()
    expect(world.isPaused()).toBe(true)
  })

  it('does not advance immediately when resuming real-time', () => {
    const world = new EngineWorld()
    const system = createSystem()
    world.addSystem(system, { id: 'test' })

    const runner = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })

    runner.update(1 / 60)
    ;(system.fixedUpdate as any).mockClear()

    runner.setRealTime(false)
    runner.update(1 / 60)
    expect(system.fixedUpdate!).not.toHaveBeenCalled()

    runner.setRealTime(true)
    expect(system.fixedUpdate!).not.toHaveBeenCalled()

    runner.update(1 / 60)
    expect(system.fixedUpdate!).toHaveBeenCalledTimes(1)
    expect(world.isPaused()).toBe(false)
  })

  it('allows manual stepping while paused', () => {
    const world = new EngineWorld()
    const system = createSystem()
    world.addSystem(system, { id: 'test' })

    const runner = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })
    runner.setRealTime(false)

    runner.stepOnce()

    expect(system.fixedUpdate!).toHaveBeenCalled()
  })

  it('clamps substep configuration to valid bounds', () => {
    const world = new EngineWorld()
    const system = createSystem()
    world.addSystem(system, { id: 'test' })

    const runner = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })
    runner.setSubsteps(32)
    runner.stepOnce()

    expect(system.fixedUpdate!).toHaveBeenCalledTimes(16)

    ;(system.fixedUpdate as any).mockClear()
    runner.setSubsteps(Number.NaN)
    runner.stepOnce()
    expect(system.fixedUpdate!).toHaveBeenCalledTimes(16)
  })

  it('decouples substeps from catch-up max steps', () => {
    const world = new EngineWorld()
    const system = createSystem()
    world.addSystem(system, { id: 'test' })

    const runner = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })
    runner.setSubsteps(8)
    runner.setMaxCatchUpSteps(2)

    ;(system.fixedUpdate as any).mockClear()
    // Large delta → loop should try to catch up, but capped at 2 fixed steps.
    runner.update(0.2)

    // Each fixed step runs 8 substeps.
    const cappedCount = (system.fixedUpdate as any).mock.calls.length
    expect(cappedCount).toBe(2 * 8)
    const dts = new Set((system.fixedUpdate as any).mock.calls.map((args: [number]) => args[0]))
    expect(dts.size).toBe(1)
    const dt = Array.from(dts)[0]
    expect(dt).toBeCloseTo((1 / 60) / 8)

    // Uncapped runner should perform more catch-up steps for the same delta.
    ;(system.fixedUpdate as any).mockClear()
    const uncapped = new SimulationRunner({ engine: world, fixedDelta: 1 / 60 })
    uncapped.setSubsteps(8)
    // No call to setMaxCatchUpSteps → default catch-up allows more than 2 steps
    uncapped.update(0.2)
    const uncappedCount = (system.fixedUpdate as any).mock.calls.length
    // Default catch-up is 1 step by default in this runner implementation.
    expect(uncappedCount).toBe(1 * 8)
    // And the capped runner was explicitly set to 2 steps.
    expect(cappedCount).toBeGreaterThan(uncappedCount)
  })
})
