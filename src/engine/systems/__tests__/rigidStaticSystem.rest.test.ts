import { describe, it, expect } from 'vitest'
import { RigidStaticSystem } from '../rigidStaticSystem'
import { EventBus } from '../../events/bus'

describe('RigidStaticSystem rest scenarios', () => {
  it('two stacked boxes over ground settle to rest without excessive jitter', () => {
    const bus = new EventBus({ capacity: 256, mailboxCapacity: 256 })
    const groundY = 0
    const sys = new RigidStaticSystem({
      bus,
      getAabbs: () => [
        { min: { x: -1, y: groundY - 0.1 }, max: { x: 1, y: groundY } },
      ],
      gravity: 9.81,
      enableDynamicPairs: true,
      sleepVelocityThreshold: 0.01,
      sleepFramesThreshold: 30,
    })

    // Bottom box starts just above the ground; top box above the bottom.
    const bottom = {
      id: 1,
      center: { x: 0, y: 0.25 },
      half: { x: 0.1, y: 0.1 },
      angle: 0,
      velocity: { x: 0, y: 0 },
      mass: 1,
      restitution: 0.1,
      friction: 0.8,
    }
    const top = {
      id: 2,
      center: { x: 0, y: 0.55 },
      half: { x: 0.1, y: 0.1 },
      angle: 0,
      velocity: { x: 0, y: 0 },
      mass: 1,
      restitution: 0.1,
      friction: 0.8,
    }

    sys.addBody(bottom as any)
    sys.addBody(top as any)

    const dt = 1 / 60
    const totalSteps = 360 // 6 seconds of simulation
    const tailWindow = 60
    const topYHistory: number[] = []

    for (let i = 0; i < totalSteps; i++) {
      sys.fixedUpdate(dt)
      topYHistory.push(top.center.y)
    }

    const tail = topYHistory.slice(-tailWindow)
    const minY = Math.min(...tail)
    const maxY = Math.max(...tail)
    // Require the top box to be effectively at rest vertically (small residual jitter allowed).
    expect(maxY - minY).toBeLessThan(0.08)
  })
})
