import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'

import * as physicsScenarios from '../../engine/scenarios/physicsScenarios'
import { loadSandboxScene } from '../sandboxScenes'
import { SimWorld } from '../../lib/simWorld'
import { SimulationSystem } from '../../engine/systems/simulationSystem'
import { PhysicsSystem } from '../../engine/systems/physicsSystem'
import { DebugOverlayState } from '../../engine/render/DebugOverlayState'

describe('Sandbox scene loader', () => {
  it('delegates cloth-c1-settling to the Scenario DSL with a valid context', () => {
    const spy = vi.spyOn(physicsScenarios, 'createClothScenario')

    loadSandboxScene('cloth-c1-settling', { controller: null, actions: null })

    expect(spy).toHaveBeenCalledTimes(1)
    const [id, ctx] = spy.mock.calls[0]
    expect(id).toBe('cloth-c1-settling')
    expect(typeof ctx).toBe('object')
    expect(typeof (ctx as any).makeClothPatch).toBe('function')
  })

  it('loads cloth-c1-settling into SimulationSystem and simulates to sleep', () => {
    const simWorld = new SimWorld()
    const simSystem = new SimulationSystem({ simWorld })
    const overlay = new DebugOverlayState()

    const controller = {
      getSimulationSystem: () => simSystem,
      getOverlayState: () => overlay,
      addSceneObject: (_obj: THREE.Object3D) => {},
      removeSceneObject: (_obj: THREE.Object3D) => {},
      clearSandboxObjects: () => {},
    }

    loadSandboxScene('cloth-c1-settling', { controller, actions: null })

    expect(simSystem.getSnapshot().bodies).toHaveLength(1)

    for (let i = 0; i < 240; i++) {
      simSystem.fixedUpdate(0.016)
    }

    const snap = simSystem.getSnapshot()
    expect(snap.bodies[0]?.sleeping).toBe(true)
    expect(overlay.simSnapshot?.bodies?.length).toBe(1)
  })

  it('loads cloth-c2-sleep-wake into SimulationSystem and wakes on pointer', () => {
    const simWorld = new SimWorld()
    const simSystem = new SimulationSystem({ simWorld })

    const controller = {
      getSimulationSystem: () => simSystem,
      addSceneObject: (_obj: THREE.Object3D) => {},
      removeSceneObject: (_obj: THREE.Object3D) => {},
      clearSandboxObjects: () => {},
    }

    loadSandboxScene('cloth-c2-sleep-wake', { controller, actions: null })

    for (let i = 0; i < 200; i++) {
      simSystem.fixedUpdate(0.016)
    }

    const asleepSnap = simSystem.getSnapshot()
    expect(asleepSnap.bodies[0]?.sleeping).toBe(true)

    const center = asleepSnap.bodies[0]?.center ?? { x: 0, y: 0 }
    simSystem.notifyPointer(new THREE.Vector2(center.x, center.y))
    simSystem.fixedUpdate(0.016)

    expect(simSystem.getSnapshot().bodies[0]?.sleeping).toBe(false)
  })

  it('adds rigid-stack-rest bodies to PhysicsSystem', () => {
    const bus = { publish: () => {} } as any
    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [],
      enableDynamicPairs: true,
    })
    const overlay = new DebugOverlayState()

    const controller = {
      getPhysicsSystem: () => physics,
      getOverlayState: () => overlay,
      clearSandboxObjects: () => {},
    }

    loadSandboxScene('rigid-stack-rest', { controller, actions: null })

    expect(physics.debugGetRigidBodies().length).toBe(2)
    expect(overlay.rigidBodies.length).toBe(2)
  })

  it('adds rigid-drop-onto-static body to PhysicsSystem', () => {
    const bus = { publish: () => {} } as any
    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [],
      enableDynamicPairs: true,
    })
    const overlay = new DebugOverlayState()

    const controller = {
      getPhysicsSystem: () => physics,
      getOverlayState: () => overlay,
      clearSandboxObjects: () => {},
    }

    loadSandboxScene('rigid-drop-onto-static', { controller, actions: null })

    expect(physics.debugGetRigidBodies().length).toBe(1)
    expect(overlay.rigidBodies.length).toBe(1)
  })
})
