import { describe, expect, it, vi, beforeEach } from 'vitest'
import { EngineWorld } from '../world'
import { GameLoop } from '../gameLoop'

describe('EngineWorld', () => {
  it('updates systems in priority order', () => {
    const world = new EngineWorld()
    const calls = []
    const makeSystem = (name) => ({
      update: (dt) => calls.push(`${name}:${dt}`),
    })

    world.addSystem(makeSystem('low'), { priority: 1 })
    world.addSystem(makeSystem('high'), { priority: 5 })
    world.addSystem(makeSystem('mid'), { priority: 3 })

    world.tick(0.016)

    expect(calls).toEqual(['high:0.016', 'mid:0.016', 'low:0.016'])
  })

  it('skips pauseable systems when paused and runs unpauseable ones', () => {
    const world = new EngineWorld()
    const pauseable = { update: vi.fn() }
    const unpauseable = { update: vi.fn() }
    world.addSystem(pauseable, { pauseable: true })
    world.addSystem(unpauseable, { pauseable: false })

    world.tick(0.02, { paused: true })

    expect(pauseable.update).not.toHaveBeenCalled()
    expect(unpauseable.update).toHaveBeenCalledWith(0.02, { paused: true })
  })
})

describe('GameLoop', () => {
  let time
  let handle
  let scheduled

  beforeEach(() => {
    time = 0
    handle = 1
    scheduled = null
  })

  const advance = (loop, ms) => {
    time += ms
    if (scheduled) {
      const cb = scheduled
      scheduled = null
      cb(time)
    }
  }

  it('steps the world at a fixed delta', () => {
    const world = new EngineWorld()
    const system = { update: vi.fn() }
    world.addSystem(system)

    const loop = new GameLoop(world, {
      fixedDelta: 0.01,
      maxSubSteps: 3,
      timeProvider: () => time,
      requestFrame: (cb) => {
        scheduled = cb
        return handle
      },
      cancelFrame: () => {},
    })

    loop.start()
    advance(loop, 5) // schedule first frame
    advance(loop, 5) // run frame

    expect(system.update).toHaveBeenCalled()
    expect(system.update.mock.calls[0][0]).toBeCloseTo(0.01, 5)

    loop.stop()
  })
})
