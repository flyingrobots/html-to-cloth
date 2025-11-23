import { describe, it, expect } from 'vitest'
import * as THREE from 'three'

import { ClothPhysics } from '../../lib/clothPhysics'

/**
 * Acceptance placeholder for cloth↔rigid coupling (CR1): cloth should drape onto a rigid floor box
 * without tunnelling and settle to sleep with bounded jitter. Currently no cloth↔rigid integration exists,
 * so this test is expected to fail until the coupling step is implemented in N2.2.
 */
// TODO(N2.2): enable once cloth↔rigid coupling is implemented.
describe.skip('Cloth↔Rigid acceptance (CR1: cloth drapes onto floor box)', () => {
  it('keeps cloth above the floor and converges to sleep', () => {
    const geometry = new THREE.PlaneGeometry(1, 1, 4, 4)
    const material = new THREE.MeshBasicMaterial()
    const mesh = new THREE.Mesh(geometry, material)
    const cloth = new ClothPhysics(mesh)
    cloth.setGravity(new THREE.Vector3(0, -9.81, 0))

    const floorMinY = -0.1
    const floorMaxY = 0

    for (let i = 0; i < 240; i++) {
      cloth.update(1 / 60)
      const sphere = cloth.getBoundingSphere()
      // Assert no vertex center passes through the floor AABB (requires future collision step).
      expect(sphere.center.y - sphere.radius).toBeGreaterThanOrEqual(floorMinY - 1e-3)
    }

    expect(cloth.isSleeping()).toBe(true)

    const sphere = cloth.getBoundingSphere()
    expect(sphere.center.y).toBeLessThanOrEqual(floorMaxY + 0.15)
  })
})
