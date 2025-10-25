import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { CameraSpring } from '../CameraSpring'
import { CameraSystem } from '../CameraSystem'
import type { EngineWorld } from '../../types'

describe('CameraSpring', () => {
  it('converges towards the target position', () => {
    const spring = new CameraSpring({ position: new THREE.Vector3(0, 0, 0) })
    spring.setTarget(new THREE.Vector3(10, 0, 0))

    for (let i = 0; i < 120; i++) {
      spring.update(1 / 60)
    }

    const snapshot = spring.getSnapshot()
    expect(snapshot.position.x).toBeCloseTo(10, 1)
    expect(snapshot.velocity.length()).toBeLessThan(0.1)
  })

  it('converges towards the target zoom', () => {
    const spring = new CameraSpring({ zoom: 1 })
    spring.setTargetZoom(2)

    for (let i = 0; i < 120; i++) {
      spring.update(1 / 60)
    }

    const snapshot = spring.getSnapshot()
    expect(snapshot.zoom).toBeCloseTo(2, 1)
    expect(Math.abs(snapshot.zoomVelocity)).toBeLessThan(0.1)
  })
})

describe('CameraSystem', () => {
  it('ticks the spring and updates the snapshot during fixed updates', () => {
    const system = new CameraSystem({ position: new THREE.Vector3(0, 0, 0) })
    system.setTarget(new THREE.Vector3(5, 0, 0))

    system.fixedUpdate?.(1 / 60)
    system.fixedUpdate?.(1 / 60)

    expect(system.getSnapshot().position.x).toBeGreaterThan(0)
  })

  it('stores the attached engine world', () => {
    const system = new CameraSystem()
    const world = { id: 'world' } as EngineWorld

    system.onAttach?.(world)

    expect(system.getWorld()).toBe(world)
  })

  it('supports jump to target without oscillation', () => {
    const system = new CameraSystem({ position: new THREE.Vector3(0, 0, 0) })
    system.jumpTo(new THREE.Vector3(100, 50, 0), 3)

    const snapshot = system.getSnapshot()
    expect(snapshot.position.x).toBeCloseTo(100)
    expect(snapshot.position.y).toBeCloseTo(50)
    expect(snapshot.zoom).toBeCloseTo(3)
    expect(snapshot.velocity.length()).toBe(0)
  })
})
