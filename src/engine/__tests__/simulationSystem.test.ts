import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

import { SimulationSystem } from '../systems/simulationSystem'
import { EngineWorld } from '../world'

const createSimWorld = () => ({
  addBody: vi.fn(),
  removeBody: vi.fn(),
  step: vi.fn(),
  notifyPointer: vi.fn(),
  clear: vi.fn(),
  getSnapshot: vi.fn().mockReturnValue({ bodies: [] }),
})

const createBody = () => {
  const warmStart = vi.fn()
  const configureSleep = vi.fn()

  return {
    id: 'cloth-1',
    warmStart,
    configureSleep,
    update: vi.fn(),
    isSleeping: vi.fn().mockReturnValue(false),
    wake: vi.fn(),
    getBoundingSphere: vi.fn(() => ({ center: new THREE.Vector2(), radius: 1 })),
  }
}

const warmConfig = () => ({
  passes: 2,
  constraintIterations: 4,
})

const sleepConfig = () => ({ velocityThreshold: 0.001, frameThreshold: 45 })

describe('SimulationSystem', () => {
  it('applies pending warm start and sleep configuration before stepping', () => {
    const simWorld = createSimWorld()
    const body = createBody()
    const system = new SimulationSystem({ simWorld })

    system.addBody(body as any, { warmStart: warmConfig(), sleep: sleepConfig() })

    system.fixedUpdate?.(0.016)
    system.fixedUpdate?.(0.016)

    expect(simWorld.addBody).toHaveBeenCalledWith(body)
    expect(simWorld.step).toHaveBeenCalledTimes(2)
    expect(body.warmStart).toHaveBeenCalledTimes(1)
    expect(body.warmStart).toHaveBeenCalledWith(expect.objectContaining({ passes: 2 }))
    expect(body.configureSleep).toHaveBeenCalledTimes(1)
    expect(body.configureSleep).toHaveBeenCalledWith(expect.objectContaining({ frameThreshold: 45 }))
  })

  it('queues additional warm start requests', () => {
    const simWorld = createSimWorld()
    const body = createBody()
    const system = new SimulationSystem({ simWorld })

    system.addBody(body as any, { warmStart: warmConfig() })
    system.fixedUpdate?.(0.016)

    const nextWarm = { passes: 1, constraintIterations: 8 }
    system.queueWarmStart(body.id, nextWarm)
    system.fixedUpdate?.(0.016)

    expect(body.warmStart).toHaveBeenCalledTimes(2)
    expect(body.warmStart).toHaveBeenNthCalledWith(2, nextWarm)
  })

  it('applies queued sleep configuration on next tick', () => {
    const simWorld = createSimWorld()
    const body = createBody()
    const system = new SimulationSystem({ simWorld })

    system.addBody(body as any, { sleep: sleepConfig() })
    system.fixedUpdate?.(0.016)

    const updatedConfig = { velocityThreshold: 0.002, frameThreshold: 90 }
    system.queueSleepConfiguration(body.id, updatedConfig)
    system.fixedUpdate?.(0.016)

    expect(body.configureSleep).toHaveBeenCalledTimes(2)
    expect(body.configureSleep).toHaveBeenNthCalledWith(2, updatedConfig)
  })

  it('returns the latest snapshot after stepping', () => {
    const simWorld = createSimWorld()
    const snapshotA = { bodies: [{ id: 'a', center: new THREE.Vector2(1, 1), radius: 0.5, sleeping: false }] }
    const snapshotB = { bodies: [{ id: 'a', center: new THREE.Vector2(2, 1), radius: 0.5, sleeping: false }] }

    simWorld.getSnapshot
      .mockReturnValueOnce(snapshotA)
      .mockReturnValueOnce(snapshotB)

    const system = new SimulationSystem({ simWorld })
    system.fixedUpdate?.(0.016)
    const first = system.getSnapshot()
    expect(first).toEqual(snapshotA)

    system.fixedUpdate?.(0.016)
    const second = system.getSnapshot()
    expect(second).toEqual(snapshotB)
    expect(second).not.toBe(first)
  })

  it('routes pointer notifications and clears bodies', () => {
    const simWorld = createSimWorld()
    const system = new SimulationSystem({ simWorld })

    const point = new THREE.Vector2(1, 2)
    system.notifyPointer(point)
    expect(simWorld.notifyPointer).toHaveBeenCalledWith(point)

    system.clear()
    expect(simWorld.clear).toHaveBeenCalled()
  })

  it('removes registered bodies on request', () => {
    const simWorld = createSimWorld()
    const body = createBody()
    const system = new SimulationSystem({ simWorld })

    system.addBody(body as any, { warmStart: warmConfig() })
    system.removeBody(body.id)

    expect(simWorld.removeBody).toHaveBeenCalledWith(body.id)
  })

  it('stores the engine world reference on attach', () => {
    const simWorld = createSimWorld()
    const system = new SimulationSystem({ simWorld })
    const world = new EngineWorld()

    system.onAttach?.(world)

    expect((system as any).world).toBe(world)
  })

  it('is not allowed while paused by default', () => {
    const system = new SimulationSystem({ simWorld: createSimWorld() })

    expect(system.allowWhilePaused).toBe(false)
  })
})
