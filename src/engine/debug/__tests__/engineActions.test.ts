import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'

import { EngineWorld } from '../../world'
import { SimulationRunner } from '../../simulationRunner'
import { CameraSystem } from '../../camera/CameraSystem'
import { EngineActions } from '../engineActions'
import type { SimulationSystem } from '../../systems/simulationSystem'
import type { EngineSystem } from '../../types'

describe('EngineActions', () => {
  it('routes real-time toggles into the SimulationRunner and pauses the engine', () => {
    const world = new EngineWorld()
    const runner = new SimulationRunner({ engine: world })
    const actions = new EngineActions({ runner, world })

    actions.setRealTime(false)
    expect(world.isPaused()).toBe(true)

    actions.setRealTime(true)
    expect(world.isPaused()).toBe(false)
  })

  it('performs a single fixed step via stepOnce()', () => {
    const world = new EngineWorld()
    const runner = new SimulationRunner({ engine: world })
    const actions = new EngineActions({ runner, world })

    let ticks = 0
    const counter: EngineSystem = { fixedUpdate: () => void (ticks++) }
    world.addSystem(counter, { priority: 100 })

    expect(ticks).toBe(0)
    actions.stepOnce()
    expect(ticks).toBe(1)
  })

  it('clamps and forwards substep configuration to the runner', () => {
    const world = new EngineWorld()
    const runner = new SimulationRunner({ engine: world })
    const actions = new EngineActions({ runner, world })

    const spy = vi.spyOn(runner, 'setSubsteps')
    actions.setSubsteps(8)
    expect(spy).toHaveBeenCalledWith(8)
  })

  it('configures the camera system and affects snapshots', () => {
    const world = new EngineWorld()
    const camera = new CameraSystem({ position: new THREE.Vector3(0, 0, 0), zoom: 1 })
    world.addSystem(camera, { priority: 50, allowWhilePaused: true })

    const runner = new SimulationRunner({ engine: world })
    const actions = new EngineActions({ runner, world, camera })

    // Aim camera towards a target and zoom in
    actions.setCameraTarget(new THREE.Vector3(10, -5, 0))
    actions.setCameraTargetZoom(2)

    // Advance a few fixed frames so the spring converges a bit
    world.step(1 / 60)
    world.step(1 / 60)

    const snap = camera.getSnapshot()
    expect(snap.position.x).toBeGreaterThan(0)
    expect(snap.position.y).toBeLessThan(0)
    expect(snap.zoom).toBeGreaterThan(1)

    // Jump should set position/zoom immediately with zero velocity
    actions.jumpCamera(new THREE.Vector3(0, 0, 0), 1)
    const after = camera.getSnapshot()
    expect(after.position.length()).toBeCloseTo(0)
    expect(after.zoom).toBeCloseTo(1)
    expect(after.velocity.length()).toBe(0)
  })

  it('broadcasts gravity and constraint iterations via SimulationSystem', () => {
    const world = new EngineWorld()
    const runner = new SimulationRunner({ engine: world })
    const simulation = {
      broadcastGravity: vi.fn(),
      broadcastConstraintIterations: vi.fn(),
      broadcastWarmStart: vi.fn(),
    } as unknown as SimulationSystem

    const actions = new EngineActions({ runner, world, simulation })

    actions.setGravityScalar(12)
    expect(simulation.broadcastGravity).toHaveBeenCalled()

    actions.setConstraintIterations(6)
    expect(simulation.broadcastConstraintIterations).toHaveBeenCalledWith(6)

    actions.warmStartNow(2, 4)
    expect(simulation.broadcastWarmStart).toHaveBeenCalledWith({ passes: 2, constraintIterations: 4 })
  })

  it('rounds/clamps warmStart and iterations before broadcasting', () => {
    const world = new EngineWorld()
    const runner = new SimulationRunner({ engine: world })
    const simulation = { broadcastWarmStart: vi.fn(), broadcastConstraintIterations: vi.fn() } as unknown as SimulationSystem
    const actions = new EngineActions({ runner, world, simulation })

    actions.warmStartNow(-1.7, 0.2)
    expect(simulation.broadcastWarmStart).toHaveBeenCalledWith({ passes: 0, constraintIterations: 1 })

    actions.setConstraintIterations(6.8)
    expect(simulation.broadcastConstraintIterations).toHaveBeenCalledWith(6.8)
  })

  it('camera methods are safe no-ops when camera is absent', () => {
    const world = new EngineWorld()
    const runner = new SimulationRunner({ engine: world })
    const actions = new EngineActions({ runner, world, camera: null, simulation: null as any })
    expect(() => actions.setCameraTarget(new THREE.Vector3(1, 2, 3))).not.toThrow()
    expect(() => actions.setCameraTargetZoom(2)).not.toThrow()
    expect(() => actions.jumpCamera(new THREE.Vector3(0, 0, 0), 1)).not.toThrow()
  })

  it('simulation methods are safe no-ops when simulation is absent', () => {
    const world = new EngineWorld()
    const runner = new SimulationRunner({ engine: world })
    const actions = new EngineActions({ runner, world, camera: null, simulation: null as any })
    expect(() => actions.setGravityScalar(9.81)).not.toThrow()
    expect(() => actions.setConstraintIterations(4)).not.toThrow()
    expect(() => actions.warmStartNow(2, 4)).not.toThrow()
  })
})
