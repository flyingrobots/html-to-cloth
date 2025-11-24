import * as THREE from 'three'
import { ClothPhysics } from '../lib/clothPhysics'
import { createClothScenario } from '../engine/scenarios/physicsScenarios'
import type { SimBody, SimSleepConfig, SimWarmStartConfig } from '../lib/simWorld'

export type SandboxSceneId =
  | 'cloth-c1-settling'
  | 'cloth-c2-sleep-wake'
  | 'cloth-cr1-over-box'
  | 'cloth-cr2-rigid-hit'
  | 'rigid-stack-rest'
  | 'rigid-drop-onto-static'
  | 'rigid-thin-wall-ccd'

export type SandboxSceneDeps = {
  controller: any | null
  actions: any | null
}

class ScenarioClothBody implements SimBody {
  readonly id: string
  private cloth: ClothPhysics
  private stepFn: (dt: number) => void

  constructor(id: string, cloth: ClothPhysics, stepFn?: (dt: number) => void) {
    this.id = id
    this.cloth = cloth
    this.stepFn = stepFn ?? ((dt) => this.cloth.update(dt))
  }

  update(dt: number) {
    this.stepFn(dt)
  }

  isSleeping() {
    return this.cloth.isSleeping()
  }

  wake() {
    this.cloth.wake()
  }

  wakeIfPointInside(point: THREE.Vector2) {
    this.cloth.wakeIfPointInside?.(point)
  }

  getBoundingSphere() {
    return this.cloth.getBoundingSphere()
  }

  warmStart(config: SimWarmStartConfig) {
    this.cloth.warmStart?.(config)
  }

  configureSleep(config: SimSleepConfig) {
    this.cloth.setSleepThresholds(config.velocityThreshold, config.frameThreshold)
  }

  setConstraintIterations(iterations: number) {
    this.cloth.setConstraintIterations(iterations)
  }

  setGlobalGravity(gravity: THREE.Vector3) {
    this.cloth.setGravity(gravity)
  }
}

const DEFAULT_SLEEP: SimSleepConfig = { velocityThreshold: 0.001, frameThreshold: 60 }
const DEFAULT_WARM_START: SimWarmStartConfig = { passes: 2, constraintIterations: 4 }

let teardownCurrentScene: (() => void) | null = null
let activeRigidIds: number[] = []

function resetActiveScene(deps: SandboxSceneDeps) {
  if (teardownCurrentScene) {
    teardownCurrentScene()
    teardownCurrentScene = null
  }
  const sim = deps.controller?.getSimulationSystem?.()
  sim?.clear?.()
  if (activeRigidIds.length > 0) {
    const physics = deps.controller?.getPhysicsSystem?.()
    if (physics && typeof physics.removeRigidBody === 'function') {
      for (const id of activeRigidIds) physics.removeRigidBody(id)
    }
    activeRigidIds = []
  }
  deps.controller?.clearSandboxObjects?.()
  // Reset overlays to avoid stale gizmos between scenes.
  const overlay = deps.controller?.getOverlayState?.()
  if (overlay) {
    overlay.rigidBodies = []
    overlay.pinMarkers = []
    overlay.simSnapshot = undefined
  }
}

/**
 * High-level scene loader used by the Sandbox route.
 *
 * For now this is intentionally minimal: it ties scene identifiers to the
 * Scenario DSL so we never lose the mapping between UI and spec. Future
 * iterations will thread the created bodies into the live engine.
 */
export function loadSandboxScene(id: SandboxSceneId, deps: SandboxSceneDeps) {
  resetActiveScene(deps)

  switch (id) {
    case 'cloth-c1-settling': {
      const ctx = {
        three: THREE,
        makeClothPatch: (widthVertices = 5, heightVertices = 5) => {
          const geometry = new THREE.PlaneGeometry(
            1,
            1,
            widthVertices - 1,
            heightVertices - 1,
          )
          const material = new THREE.MeshBasicMaterial()
          const mesh = new THREE.Mesh(geometry, material)
          return new ClothPhysics(mesh)
        },
      }
      const { cloth, step } = createClothScenario('cloth-c1-settling', ctx)
      cloth.mesh.position.set(0, 0.8, 0)
      ;(cloth.mesh.material as THREE.MeshBasicMaterial).wireframe = true

      const sim = deps.controller?.getSimulationSystem?.()
      const overlay = deps.controller?.getOverlayState?.()
      const addSceneObject = deps.controller?.addSceneObject?.bind(deps.controller)
      const removeSceneObject = deps.controller?.removeSceneObject?.bind(deps.controller)

      if (addSceneObject) {
        addSceneObject(cloth.mesh)
      }

      if (sim) {
        const bodyId = 'sandbox-cloth-c1'
        const body = new ScenarioClothBody(bodyId, cloth, step)
        sim.addBody(body, { warmStart: DEFAULT_WARM_START, sleep: DEFAULT_SLEEP })
        // Prime snapshot immediately so overlays render without waiting for the next tick.
        sim.fixedUpdate?.(0)
        overlay && (overlay.simSnapshot = sim.getSnapshot())
        teardownCurrentScene = () => {
          sim.removeBody(bodyId)
          removeSceneObject?.(cloth.mesh)
          cloth.mesh.geometry.dispose()
          cloth.mesh.material.dispose()
        }
      } else {
        // Fallback: still create the scenario to preserve legacy behaviour in tests.
        teardownCurrentScene = () => {
          removeSceneObject?.(cloth.mesh)
          cloth.mesh.geometry.dispose()
          cloth.mesh.material.dispose()
        }
      }
      return
    }

    case 'cloth-c2-sleep-wake': {
      const ctx = {
        three: THREE,
        makeClothPatch: (widthVertices = 3, heightVertices = 3) => {
          const geometry = new THREE.PlaneGeometry(
            1,
            1,
            widthVertices - 1,
            heightVertices - 1,
          )
          const material = new THREE.MeshBasicMaterial()
          const mesh = new THREE.Mesh(geometry, material)
          return new ClothPhysics(mesh)
        },
      }
      const { cloth, step } = createClothScenario('cloth-c2-sleep-wake', ctx)
      cloth.mesh.position.set(0, 0.8, 0)
      ;(cloth.mesh.material as THREE.MeshBasicMaterial).wireframe = true

      const sim = deps.controller?.getSimulationSystem?.()
      const addSceneObject = deps.controller?.addSceneObject?.bind(deps.controller)
      const removeSceneObject = deps.controller?.removeSceneObject?.bind(deps.controller)

      addSceneObject?.(cloth.mesh)

      if (sim) {
        const bodyId = 'sandbox-cloth-c2'
        const body = new ScenarioClothBody(bodyId, cloth, step)
        sim.addBody(body, { warmStart: DEFAULT_WARM_START, sleep: DEFAULT_SLEEP })
        sim.fixedUpdate?.(0)
        teardownCurrentScene = () => {
          sim.removeBody(bodyId)
          removeSceneObject?.(cloth.mesh)
          cloth.mesh.geometry.dispose()
          cloth.mesh.material.dispose()
        }
      } else {
        teardownCurrentScene = () => {
          removeSceneObject?.(cloth.mesh)
          cloth.mesh.geometry.dispose()
          cloth.mesh.material.dispose()
        }
      }
      return
    }

    case 'cloth-cr1-over-box': {
      const { cloth, step } = createClothScenario('cloth-cr1-over-box', {
        three: THREE,
        makeClothPatch: (w = 7, h = 7) => {
          const geometry = new THREE.PlaneGeometry(1, 1, w - 1, h - 1)
          const material = new THREE.MeshBasicMaterial()
          const mesh = new THREE.Mesh(geometry, material)
          return new ClothPhysics(mesh)
        },
      })
      ;(cloth.mesh.material as THREE.MeshBasicMaterial).wireframe = true

      const sim = deps.controller?.getSimulationSystem?.()
      const overlay = deps.controller?.getOverlayState?.()
      const addSceneObject = deps.controller?.addSceneObject?.bind(deps.controller)
      const removeSceneObject = deps.controller?.removeSceneObject?.bind(deps.controller)

      addSceneObject?.(cloth.mesh)

      if (sim) {
        const bodyId = 'sandbox-cloth-cr1'
        const body = new ScenarioClothBody(bodyId, cloth, step)
        sim.addBody(body, { warmStart: DEFAULT_WARM_START, sleep: { velocityThreshold: 0.002, frameThreshold: 200 } })
        sim.fixedUpdate?.(0)
        overlay && (overlay.simSnapshot = sim.getSnapshot())
        teardownCurrentScene = () => {
          sim.removeBody(bodyId)
          removeSceneObject?.(cloth.mesh)
          cloth.mesh.geometry.dispose()
          cloth.mesh.material.dispose()
        }
      } else {
        teardownCurrentScene = () => {
          removeSceneObject?.(cloth.mesh)
          cloth.mesh.geometry.dispose()
          cloth.mesh.material.dispose()
        }
      }
      return
    }

    case 'cloth-cr2-rigid-hit': {
      const { cloth, step, projectile } = createClothScenario('cloth-cr2-rigid-hit', {
        three: THREE,
        makeClothPatch: (w = 7, h = 7) => {
          const geometry = new THREE.PlaneGeometry(1, 1, w - 1, h - 1)
          const material = new THREE.MeshBasicMaterial()
          const mesh = new THREE.Mesh(geometry, material)
          return new ClothPhysics(mesh)
        },
      })
      ;(cloth.mesh.material as THREE.MeshBasicMaterial).wireframe = true

      const sim = deps.controller?.getSimulationSystem?.()
      const overlay = deps.controller?.getOverlayState?.()
      const addSceneObject = deps.controller?.addSceneObject?.bind(deps.controller)
      const removeSceneObject = deps.controller?.removeSceneObject?.bind(deps.controller)

      addSceneObject?.(cloth.mesh)

      if (sim) {
        const bodyId = 'sandbox-cloth-cr2'
        const body = new ScenarioClothBody(bodyId, cloth, step)
        sim.addBody(body, { warmStart: DEFAULT_WARM_START, sleep: { velocityThreshold: 0.002, frameThreshold: 160 } })
        sim.fixedUpdate?.(0)
        overlay && (overlay.simSnapshot = sim.getSnapshot())
        teardownCurrentScene = () => {
          sim.removeBody(bodyId)
          removeSceneObject?.(cloth.mesh)
          cloth.mesh.geometry.dispose()
          cloth.mesh.material.dispose()
        }
      } else {
        teardownCurrentScene = () => {
          removeSceneObject?.(cloth.mesh)
          cloth.mesh.geometry.dispose()
          cloth.mesh.material.dispose()
        }
      }

      // Optional: visualize projectile as a small sphere if scene graph available.
      if (projectile && addSceneObject && removeSceneObject) {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(projectile.radius, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xff5533, wireframe: true })
        )
        sphere.position.set(projectile.center.x, projectile.center.y, 0)
        addSceneObject(sphere)
        // Hook the step loop by piggybacking on requestAnimationFrame via controller scene objects
        let rafId: number | null = null
        const updateProjectile = () => {
          sphere.position.set(projectile.center.x, projectile.center.y, 0)
          rafId = requestAnimationFrame(updateProjectile)
        }
        rafId = requestAnimationFrame(updateProjectile)
        const prevTeardown = teardownCurrentScene
        teardownCurrentScene = () => {
          prevTeardown?.()
          if (rafId !== null) cancelAnimationFrame(rafId)
          removeSceneObject(sphere)
          sphere.geometry.dispose()
          ;(sphere.material as THREE.Material).dispose()
        }
      }

      return
    }

    case 'rigid-stack-rest': {
      const physics = deps.controller?.getPhysicsSystem?.()
      const overlay = deps.controller?.getOverlayState?.()
      if (!physics) return

      const bottom = {
        id: 101,
        center: { x: 0, y: 0.25 },
        half: { x: 0.1, y: 0.1 },
        angle: 0,
        velocity: { x: 0, y: 0 },
        mass: 1,
        restitution: 0.1,
        friction: 0.8,
      }
      const top = {
        id: 102,
        center: { x: 0, y: 0.55 },
        half: { x: 0.1, y: 0.1 },
        angle: 0,
        velocity: { x: 0, y: 0 },
        mass: 1,
        restitution: 0.1,
        friction: 0.8,
      }
      physics.addRigidBody(bottom as any)
      physics.addRigidBody(top as any)
      activeRigidIds = [bottom.id, top.id]
      physics.fixedUpdate?.(0)
      overlay && (overlay.rigidBodies = physics.debugGetRigidBodies())
      teardownCurrentScene = () => {
        for (const id of activeRigidIds) physics.removeRigidBody(id)
        activeRigidIds = []
      }
      return
    }

    case 'rigid-thin-wall-ccd': {
      const physics = deps.controller?.getPhysicsSystem?.()
      const overlay = deps.controller?.getOverlayState?.()
      if (!physics) return

      physics.configureCcd?.({ enabled: true, speedThreshold: 0.5, epsilon: 1e-4 })

      const wall = {
        id: 301,
        center: { x: 0, y: 0 },
        half: { x: 0.02, y: 1 },
        angle: 0,
        velocity: { x: 0, y: 0 },
        mass: 0,
        restitution: 0,
        friction: 0.1,
      }
      const fast = {
        id: 302,
        center: { x: -1, y: 0 },
        half: { x: 0.1, y: 0.1 },
        angle: 0,
        velocity: { x: 6, y: 0 },
        mass: 1,
        restitution: 0,
        friction: 0,
        ccd: true,
      }

      physics.addRigidBody(wall as any)
      physics.addRigidBody(fast as any)
      activeRigidIds = [wall.id, fast.id]
      physics.fixedUpdate?.(0)
      overlay && (overlay.rigidBodies = physics.debugGetRigidBodies())
      teardownCurrentScene = () => {
        for (const id of activeRigidIds) physics.removeRigidBody(id)
        activeRigidIds = []
      }
      return
    }

    case 'rigid-drop-onto-static': {
      const physics = deps.controller?.getPhysicsSystem?.()
      const overlay = deps.controller?.getOverlayState?.()
      if (!physics) return

      const body = {
        id: 201,
        center: { x: 0, y: 0.6 },
        half: { x: 0.12, y: 0.08 },
        angle: 0,
        velocity: { x: 0, y: 0 },
        mass: 1,
        restitution: 0.2,
        friction: 0.6,
      }
      physics.addRigidBody(body as any)
      activeRigidIds = [body.id]
      physics.fixedUpdate?.(0)
      overlay && (overlay.rigidBodies = physics.debugGetRigidBodies())
      teardownCurrentScene = () => {
        for (const id of activeRigidIds) physics.removeRigidBody(id)
        activeRigidIds = []
      }
      return
    }
    default:
      // Other scenes will be implemented incrementally.
      return
  }
}
