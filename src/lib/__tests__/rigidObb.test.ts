import * as THREE from 'three'
import { RigidBody2D } from '../rigidBody2d'

describe('RigidBody2D OBB collisions', () => {
  test('resolves penetration against static AABB and reflects velocity', () => {
    const body = new RigidBody2D({
      width: 0.2,
      height: 0.1,
      position: new THREE.Vector2(0, 0.05),
      restitution: 0.5,
      mass: 1,
    })
    body.setShape?.('obb')
    // Move downwards into a static AABB centered at y=0 with half size 0.05
    body.velocity.set(0, -1)
    const staticBox = { min: new THREE.Vector2(-0.2, -0.05), max: new THREE.Vector2(0.2, 0.05) }
    body.update(0.016, [staticBox])
    // After collision, position should be above or on top of the box and vy should be upward or zero
    expect(body.position.y).toBeGreaterThanOrEqual(0.05 - 1e-3)
    expect(body.velocity.y).toBeGreaterThanOrEqual(0)
  })
})

