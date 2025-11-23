import { describe, it, expect } from 'vitest'
import * as THREE from 'three'

import { ClothPhysics } from '../../lib/clothPhysics'

/**
 * CR2 acceptance (failing): a rigid projectile striking a hanging cloth should transfer impulse without tunnelling,
 * and the cloth should re-settle to sleep within a bounded jitter window.
 * The cloth↔rigid coupling is not implemented yet, so this spec should fail until N2.2 lands.
 */
// TODO(N2.2): enable once cloth↔rigid coupling is implemented.
describe.skip('Cloth↔Rigid acceptance (CR2: projectile into hanging cloth)', () => {
  it('deflects cloth without penetration and re-sleeps within 3s sim time', () => {
    const geom = new THREE.PlaneGeometry(1, 1, 6, 6)
    const mat = new THREE.MeshBasicMaterial()
    const mesh = new THREE.Mesh(geom, mat)
    const cloth = new ClothPhysics(mesh)
    cloth.setGravity(new THREE.Vector3(0, -9.81, 0))

    const projectile = {
      center: new THREE.Vector2(-0.6, 0.0),
      velocity: new THREE.Vector2(3, -0.2),
      radius: 0.05,
    }

    let maxPenetration = 0
    let wokeAfterHit = false

    for (let i = 0; i < 180; i++) {
      // TODO: replace with real cloth↔rigid collision step once implemented.
      // For now, just advance cloth and accumulate a fake penetration metric to encode the acceptance criterion.
      cloth.update(1 / 60)
      const sphere = cloth.getBoundingSphere()
      const dx = sphere.center.x - projectile.center.x
      const dy = sphere.center.y - projectile.center.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const penetration = Math.max(0, projectile.radius - dist)
      if (penetration > maxPenetration) maxPenetration = penetration
      if (!cloth.isSleeping()) wokeAfterHit = true
      projectile.center.addScaledVector(projectile.velocity, 1 / 60)
    }

    expect(maxPenetration).toBeLessThanOrEqual(0.01)
    expect(wokeAfterHit).toBe(true)

    // After the hit, allow the cloth to settle again.
    for (let i = 0; i < 180; i++) {
      cloth.update(1 / 60)
    }
    expect(cloth.isSleeping()).toBe(true)
  })
})
