import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { CameraSpring, CAMERA_SPRING_MAX_DELTA, type MutableCameraSnapshot } from '../CameraSpring'
import { CameraSystem } from '../CameraSystem'
import type { EngineWorld } from '../../world'

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

  it('clamps dt spikes to maintain stability', () => {
    const target = new THREE.Vector3(10, -4, 0)

    const baseline = new CameraSpring({ position: new THREE.Vector3(0, 0, 0) })
    baseline.setTarget(target.clone())
    baseline.setTargetZoom(2)

    const steps = Math.ceil(1 / CAMERA_SPRING_MAX_DELTA)
    for (let i = 0; i < steps; i++) {
      const dt = Math.min(CAMERA_SPRING_MAX_DELTA, 1 - i * CAMERA_SPRING_MAX_DELTA)
      if (dt <= 0) break
      baseline.update(dt)
    }

    const spiky = new CameraSpring({ position: new THREE.Vector3(0, 0, 0) })
    spiky.setTarget(target.clone())
    spiky.setTargetZoom(2)
    spiky.update(1)

    const baselineSnapshot = baseline.getSnapshot()
    const spikySnapshot = spiky.getSnapshot()
    expect(spikySnapshot.position.x).toBeCloseTo(baselineSnapshot.position.x, 1)
    expect(spikySnapshot.position.y).toBeCloseTo(baselineSnapshot.position.y, 1)
    expect(spikySnapshot.zoom).toBeCloseTo(baselineSnapshot.zoom, 1)
    expect(Number.isFinite(spikySnapshot.position.length())).toBe(true)
  })

  it('remains static when stiffness values are zero', () => {
    const spring = new CameraSpring({
      position: new THREE.Vector3(1, 2, 3),
      zoom: 1.5,
      stiffness: 0,
      damping: 0,
      zoomStiffness: 0,
      zoomDamping: 0,
    })

    spring.setTarget(new THREE.Vector3(10, 10, 10))
    spring.setTargetZoom(4)
    spring.update(1 / 60)

    const snapshot = spring.getSnapshot()
    expect(snapshot.position.x).toBeCloseTo(1, 6)
    expect(snapshot.position.y).toBeCloseTo(2, 6)
    expect(snapshot.position.z).toBeCloseTo(3, 6)
    expect(snapshot.zoom).toBeCloseTo(1.5, 6)
    expect(snapshot.velocity.length()).toBe(0)
    expect(snapshot.zoomVelocity).toBe(0)
  })

  it('fills a provided snapshot object to avoid allocations', () => {
    const spring = new CameraSpring()
    const reusable: MutableCameraSnapshot = {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      target: new THREE.Vector3(),
      zoom: 0,
      zoomVelocity: 0,
      targetZoom: 0,
    }

    const result = spring.getSnapshot(reusable)

    expect(result).toBe(reusable)
    expect(result.position).toBe(reusable.position)
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

  it('reuses snapshot references to minimize allocations', () => {
    const system = new CameraSystem({ position: new THREE.Vector3(0, 0, 0) })
    const first = system.getSnapshot()
    system.fixedUpdate?.(1 / 60)
    const second = system.getSnapshot()

    expect(second).toBe(first)
    expect(second.position).toBe(first.position)
  })
})
