import { describe, it, expect } from 'vitest'
import * as THREE from 'three'

import { ClothPhysics } from '../../lib/clothPhysics'
import { createClothScenario } from '../scenarios/physicsScenarios'

/**
 * Acceptance: CR1 cloth drapes onto a rigid floor box without tunnelling and converges to sleep.
 */
describe('Cloth↔Rigid acceptance (CR1: cloth drapes onto floor box)', () => {
  it('keeps cloth above the floor and converges to sleep', () => {
    const { cloth, step } = createClothScenario('cloth-cr1-over-box', {
      three: THREE,
      makeClothPatch: (w = 7, h = 7) => {
        const geom = new THREE.PlaneGeometry(1, 1, w - 1, h - 1)
        const mat = new THREE.MeshBasicMaterial()
        const mesh = new THREE.Mesh(geom, mat)
        return new ClothPhysics(mesh)
      },
    } as any)

    const floorMinY = -0.1
    const dt = 1 / 60

    for (let i = 0; i < 320; i++) {
      step(dt)
      const sphere = cloth.getBoundingSphere()
      expect(sphere.center.y - sphere.radius).toBeGreaterThanOrEqual(floorMinY - 1e-3)
    }

    // Verify motion has effectively stopped (jitter window near zero).
    const tailWindow = 40
    const positions: number[] = []
    for (let i = 0; i < tailWindow; i++) {
      step(dt)
      positions.push(cloth.getBoundingSphere().center.y)
    }
    const minY = Math.min(...positions)
    const maxY = Math.max(...positions)
    expect(maxY - minY).toBeLessThan(1e-3)
  })
})
