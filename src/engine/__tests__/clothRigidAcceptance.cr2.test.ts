import { describe, it, expect } from 'vitest'
import * as THREE from 'three'

import { ClothPhysics } from '../../lib/clothPhysics'
import { createClothScenario } from '../scenarios/physicsScenarios'

/**
 * CR2 acceptance: rigid projectile strikes a hanging cloth without tunnelling; cloth re-sleeps.
 */
describe('Cloth↔Rigid acceptance (CR2: projectile into hanging cloth)', () => {
  it('deflects cloth without penetration and re-sleeps within 3s sim time', () => {
    const { cloth, step, projectile } = createClothScenario('cloth-cr2-rigid-hit', {
      three: THREE,
      makeClothPatch: (w = 7, h = 7) => {
        const geom = new THREE.PlaneGeometry(1, 1, w - 1, h - 1)
        const mat = new THREE.MeshBasicMaterial()
        const mesh = new THREE.Mesh(geom, mat)
        return new ClothPhysics(mesh)
      },
    } as any)

    const dt = 1 / 60
    let maxPenetration = 0
    let wokeAfterHit = false

    for (let i = 0; i < 180; i++) {
      step(dt)
      const sphere = cloth.getBoundingSphere()
      if (projectile) {
        const dx = sphere.center.x - projectile.center.x
        const dy = sphere.center.y - projectile.center.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const penetration = Math.max(0, projectile.radius + sphere.radius - dist)
        if (penetration > maxPenetration) maxPenetration = penetration
      }
      if (!cloth.isSleeping()) wokeAfterHit = true
    }

    expect(maxPenetration).toBeLessThanOrEqual(0.05)
    expect(wokeAfterHit).toBe(true)

    for (let i = 0; i < 240; i++) {
      step(dt)
    }
    expect(cloth.isSleeping()).toBe(true)
  })
})
