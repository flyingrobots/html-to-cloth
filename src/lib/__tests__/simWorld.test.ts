import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { SimulationScheduler } from '../simulationScheduler'
import { SimWorld, type SimBody } from '../simWorld'

class MockBody implements SimBody {
  id: string
  private position: THREE.Vector2
  private radius: number
  private sleeping: boolean
  updates = 0
  wakes = 0
  wakeIfPointInsideCalls: THREE.Vector2[] = []

  constructor(id: string, position: THREE.Vector2, radius: number, sleeping = false) {
    this.id = id
    this.position = position
    this.radius = radius
    this.sleeping = sleeping
  }

  setPosition(x: number, y: number) {
    this.position.set(x, y)
  }

  getBoundingSphere() {
    return { center: this.position.clone(), radius: this.radius }
  }

  update(_dt: number) {
    this.updates += 1
  }

  isSleeping() {
    return this.sleeping
  }

  wake() {
    this.sleeping = false
    this.wakes += 1
  }

  wakeIfPointInside(point: THREE.Vector2) {
    this.wakeIfPointInsideCalls.push(point)
    const { center, radius } = this.getBoundingSphere()
    if (point.distanceTo(center) <= radius) {
      this.wake()
    }
  }

  sleep() {
    this.sleeping = true
  }
}

describe('SimWorld', () => {
  it('ticks only awake bodies each step', () => {
    const scheduler = new SimulationScheduler()
    const world = new SimWorld(scheduler)

    const awake = new MockBody('awake', new THREE.Vector2(0, 0), 0.5, false)
    const asleep = new MockBody('asleep', new THREE.Vector2(2, 0), 0.5, true)

    world.addBody(awake)
    world.addBody(asleep)

    world.step(0.016)

    expect(awake.updates).toBe(1)
    expect(asleep.updates).toBe(0)
  })

  it('wakes sleeping bodies when pointer enters their bounds', () => {
    const world = new SimWorld(new SimulationScheduler())
    const sleeper = new MockBody('sleep', new THREE.Vector2(1, 1), 0.5, true)

    world.addBody(sleeper)

    world.notifyPointer(new THREE.Vector2(10, 10))
    expect(sleeper.wakes).toBe(0)

    world.notifyPointer(new THREE.Vector2(1.1, 1.1))
    expect(sleeper.wakes).toBeGreaterThan(0)
    expect(sleeper.isSleeping()).toBe(false)
  })

  it('wakes a sleeping body when another body sweeps into it during the step', () => {
    const scheduler = new SimulationScheduler()
    const world = new SimWorld(scheduler)

    const mover = new MockBody('mover', new THREE.Vector2(-2, 0), 0.5, false)
    const sleeper = new MockBody('sleeper', new THREE.Vector2(2, 0), 0.75, true)

    world.addBody(mover)
    world.addBody(sleeper)

    mover.update = () => {
      mover.setPosition(2, 0)
      mover.updates += 1
    }

    world.step(0.016)

    expect(mover.updates).toBe(1)
    expect(sleeper.isSleeping()).toBe(false)
    expect(sleeper.wakes).toBeGreaterThan(0)
  })

  it('removes bodies cleanly and ignores further notifications', () => {
    const world = new SimWorld(new SimulationScheduler())
    const body = new MockBody('temp', new THREE.Vector2(0, 0), 1)

    world.addBody(body)
    world.removeBody('temp')

    world.step(0.016)
    world.notifyPointer(new THREE.Vector2(0, 0))

    expect(body.updates).toBe(0)
    expect(body.wakeIfPointInsideCalls).toHaveLength(0)
  })

  it('exposes a fresh snapshot of body positions and sleep state', () => {
    const world = new SimWorld(new SimulationScheduler())
    const body = new MockBody('snap', new THREE.Vector2(0, 0), 0.5)

    world.addBody(body)

    const initial = world.getSnapshot()
    expect(initial.bodies).toHaveLength(1)
    expect(initial.bodies[0]).toMatchObject({ id: 'snap', sleeping: false })

    body.setPosition(1, 2)
    world.step(0.016)

    const updated = world.getSnapshot()
    const { center } = updated.bodies[0]
    expect(center.x).toBeCloseTo(1)
    expect(center.y).toBeCloseTo(2)

    // Mutating the snapshot should not affect internal state.
    updated.bodies[0].center.x = 42
    const fresh = world.getSnapshot()
    expect(fresh.bodies[0].center.x).toBeCloseTo(1)
    // Different objects, not just values.
    expect(fresh.bodies[0]).not.toBe(updated.bodies[0])
    expect(fresh.bodies[0].center).not.toBe(updated.bodies[0].center)
  })

  it('prevents duplicate ids and throws meaningful errors', () => {
    const world = new SimWorld(new SimulationScheduler())
    const first = new MockBody('dup', new THREE.Vector2(0, 0), 1)
    const duplicate = new MockBody('dup', new THREE.Vector2(1, 0), 1)

    world.addBody(first)
    expect(() => world.addBody(duplicate)).toThrowError(/duplicate/i)
  })
})
