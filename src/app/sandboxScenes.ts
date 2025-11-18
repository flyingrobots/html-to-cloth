import * as THREE from 'three'
import { ClothPhysics } from '../lib/clothPhysics'
import { createClothScenario } from '../engine/scenarios/physicsScenarios'

export type SandboxSceneId =
  | 'cloth-c1-settling'
  | 'cloth-c2-sleep-wake'
  | 'rigid-stack-rest'
  | 'rigid-drop-onto-static'

export type SandboxSceneDeps = {
  controller: any | null
  actions: any | null
}

/**
 * High-level scene loader used by the Sandbox route.
 *
 * For now this is intentionally minimal: it ties scene identifiers to the
 * Scenario DSL so we never lose the mapping between UI and spec. Future
 * iterations will thread the created bodies into the live engine.
 */
export function loadSandboxScene(id: SandboxSceneId, deps: SandboxSceneDeps) {
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
      // This call ensures the Sandbox scene is anchored to the same Scenario
      // definition used by engine tests. The returned cloth is not yet wired
      // into the live engine; that integration will be layered on later.
      createClothScenario('cloth-c1-settling', ctx)
      return
    }
    default:
      // Other scenes will be implemented incrementally.
      return
  }
}

