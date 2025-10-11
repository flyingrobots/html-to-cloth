import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { SimulationScheduler } from '../simulationScheduler'

class MockBody {
  id: string
  updates: number
  sleeping: boolean
  wakeCalls: number
  wakeIfPointInsideCalls: Array<THREE.Vector2>

  constructor(id: string, sleeping = false) {
    this.id = id
    this.updates = 0
    this.sleeping = sleeping
    this.wakeCalls = 0
    this.wakeIfPointInsideCalls = []
  }

  update() {
    this.updates += 1
  }

  isSleeping() {
    return this.sleeping
  }

  wake() {
    this.sleeping = false
    this.wakeCalls += 1
  }

  wakeIfPointInside(point: THREE.Vector2) {
    this.wakeIfPointInsideCalls.push(point)
  }
}

describe('SimulationScheduler', () => {
  it('ticks only bodies that are awake', () => {
    const scheduler = new SimulationScheduler()
    const awake = new MockBody('awake', false)
    const asleep = new MockBody('asleep', true)

    scheduler.addBody(awake)
    scheduler.addBody(asleep)

    scheduler.step(0.016)

    expect(awake.updates).toBe(1)
    expect(asleep.updates).toBe(0)
  })

  it('wakes a body explicitly and resumes ticking', () => {
    const scheduler = new SimulationScheduler()
    const body = new MockBody('sleepy', true)

    scheduler.addBody(body)
    scheduler.step(0.016)
    expect(body.updates).toBe(0)

    scheduler.wakeBody('sleepy')
    expect(body.isSleeping()).toBe(false)

    scheduler.step(0.016)
    expect(body.updates).toBe(1)
  })

  it('delegates pointer interactions to sleeping bodies and ticks once woken', () => {
    const scheduler = new SimulationScheduler()
    const body = new MockBody('cloth', true)

    scheduler.addBody(body)
    scheduler.notifyPointer(new THREE.Vector2(0.1, 0.2))

    expect(body.wakeIfPointInsideCalls).toHaveLength(1)

    // simulate body deciding to wake inside wakeIfPointInside
    body.wake()

    scheduler.step(0.016)
    expect(body.updates).toBe(1)
  })

  it('removes bodies and stops ticking them', () => {
    const scheduler = new SimulationScheduler()
    const body = new MockBody('temp')

    scheduler.addBody(body)
    scheduler.step(0.016)
    expect(body.updates).toBe(1)

    scheduler.removeBody('temp')
    scheduler.step(0.016)
    expect(body.updates).toBe(1)
  })
})
