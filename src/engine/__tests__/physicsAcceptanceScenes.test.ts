import { describe, it, expect } from 'vitest'
import * as THREE from 'three'

import { ClothPhysics } from '../../lib/clothPhysics'

function makeCloth(widthVertices = 3, heightVertices = 3) {
  const geometry = new THREE.PlaneGeometry(1, 1, widthVertices - 1, heightVertices - 1)
  const material = new THREE.MeshBasicMaterial()
  const mesh = new THREE.Mesh(geometry, material)
  const cloth = new ClothPhysics(mesh)
  return { cloth }
}

describe('Physics Acceptance Scenes', () => {
  it('Cloth patch with initial turbulence settles without jitter once asleep', () => {
    const { cloth } = makeCloth(5, 5)

    cloth.setGravity(new THREE.Vector3(0, 0, 0))
    cloth.addTurbulence(0.01)

    const dt = 0.016
    const steps = 240
    const centerYHistory: number[] = []

    for (let i = 0; i < steps; i++) {
      cloth.update(dt)
      const sphere = cloth.getBoundingSphere()
      centerYHistory.push(sphere.center.y)
    }

    expect(cloth.isSleeping()).toBe(true)

    const tailWindow = 60
    const tail = centerYHistory.slice(-tailWindow)
    const minY = Math.min(...tail)
    const maxY = Math.max(...tail)
    expect(maxY - minY).toBeLessThan(1e-4)
  })

  it('Cloth patch falls asleep and reliably wakes when a point enters its bounds', () => {
    const { cloth } = makeCloth(3, 3)

    cloth.setGravity(new THREE.Vector3(0, 0, 0))

    for (let i = 0; i < 160; i++) {
      cloth.update(0.016)
    }

    expect(cloth.isSleeping()).toBe(true)

    const sphere = cloth.getBoundingSphere()
    const insidePoint = new THREE.Vector2(sphere.center.x, sphere.center.y)

    cloth.wakeIfPointInside(insidePoint)

    expect(cloth.isSleeping()).toBe(false)

    const before = cloth.getVertexPositions()[0].clone()
    cloth.applyPointForce(insidePoint, new THREE.Vector2(0.5, 0), 1, 1)
    cloth.update(0.016)
    const after = cloth.getVertexPositions()[0]
    expect(after.x).not.toBeCloseTo(before.x)
  })
})
