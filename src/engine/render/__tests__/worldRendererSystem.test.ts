import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'

import { EngineWorld } from '../../world'
import { CameraSystem } from '../../camera/CameraSystem'
import { WorldRendererSystem } from '../worldRendererSystem'

type FakeView = {
  camera: THREE.OrthographicCamera
  render: () => void
}

describe('WorldRendererSystem', () => {
  it('applies camera snapshot to the view camera on frameUpdate and renders', () => {
    const world = new EngineWorld()

    const cameraSystem = new CameraSystem({ position: new THREE.Vector3(0, 0, 0), zoom: 1 })
    const view: FakeView = {
      camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10),
      render: vi.fn(),
    }

    const renderer = new WorldRendererSystem({ view, camera: cameraSystem })

    world.addSystem(cameraSystem, { priority: 100, allowWhilePaused: true })
    world.addSystem(renderer, { priority: 10, allowWhilePaused: true })

    // Advance the camera once in a fixed step so it has non-zero state
    world.step(1 / 60)

    // Render pass should copy camera snapshot and call view.render()
    world.frame(1 / 60)

    const snap = cameraSystem.getSnapshot()
    expect(view.camera.position.x).toBeCloseTo(snap.position.x)
    expect(view.camera.position.y).toBeCloseTo(snap.position.y)
    expect(view.camera.zoom).toBeCloseTo(snap.zoom)
    expect((view.render as any).mock.calls.length).toBe(1)
  })

  it('runs while world is paused (frameUpdate executes, fixed updates skipped)', () => {
    const world = new EngineWorld()

    const cameraSystem = new CameraSystem({ position: new THREE.Vector3(0, 0, 0), zoom: 1 })
    const view: FakeView = {
      camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10),
      render: vi.fn(),
    }
    const renderer = new WorldRendererSystem({ view, camera: cameraSystem })

    world.addSystem(cameraSystem, { priority: 100, allowWhilePaused: true })
    world.addSystem(renderer, { priority: 10, allowWhilePaused: true })

    // Set some baseline snapshot
    world.step(1 / 60)
    const before = cameraSystem.getSnapshot()
    const beforeX = before.position.x

    // Pause the world and render a frame without stepping
    world.setPaused(true)
    world.frame(1 / 60)

    // Snapshot should be unchanged (no fixed updates) but render still called
    const after = cameraSystem.getSnapshot()
    expect(after.position.x).toBeCloseTo(beforeX)
    expect((view.render as any).mock.calls.length).toBe(1)
  })

  it('never mutates the camera snapshot object (treats as read-only)', () => {
    const world = new EngineWorld()
    const cameraSystem = new CameraSystem({ position: new THREE.Vector3(1, 2, 3), zoom: 1.5 })
    const view: FakeView = {
      camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10),
      render: vi.fn(),
    }
    const renderer = new WorldRendererSystem({ view, camera: cameraSystem })

    world.addSystem(cameraSystem, { priority: 100, allowWhilePaused: true })
    world.addSystem(renderer, { priority: 10, allowWhilePaused: true })

    world.step(1 / 60)
    const snap = cameraSystem.getSnapshot()
    const prevZoom = snap.zoom
    const prevPosX = snap.position.x
    const prevPosY = snap.position.y

    world.frame(1 / 60)

    const after = cameraSystem.getSnapshot()
    expect(after.zoom).toBeCloseTo(prevZoom)
    expect(after.position.x).toBeCloseTo(prevPosX)
    expect(after.position.y).toBeCloseTo(prevPosY)
  })
})

