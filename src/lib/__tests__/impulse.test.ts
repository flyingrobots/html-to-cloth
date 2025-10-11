import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ClothPhysics } from '../clothPhysics'

const buildCloth = () => {
  const geometry = new THREE.PlaneGeometry(1, 1, 2, 2)
  const material = new THREE.MeshBasicMaterial()
  const mesh = new THREE.Mesh(geometry, material)
  const cloth = new ClothPhysics(mesh)
  cloth.setGravity(new THREE.Vector3(0, 0, 0))
  return cloth
}

describe('ClothPhysics applyImpulse', () => {
  it('wakes a sleeping cloth and produces displacement', () => {
    const cloth = buildCloth()

    for (let i = 0; i < 120; i++) {
      cloth.update(0.016)
    }

    expect(cloth.isSleeping()).toBe(true)

    const before = cloth.getVertexPositions()[0].clone()

    cloth.applyImpulse(new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0))

    expect(cloth.isSleeping()).toBe(false)

    cloth.update(0.016)
    const after = cloth.getVertexPositions()[0]

    expect(after.x).toBeGreaterThan(before.x)
  })

  it('applies falloff with distance from impulse point', () => {
    const cloth = buildCloth()
    const positions = cloth.getVertexPositions()
    const centerIndex = positions.reduce((closest, pos, idx) => {
      const current = positions[closest]
      return pos.lengthSq() < current.lengthSq() ? idx : closest
    }, 0)
    const edgeIndex = positions.reduce((farthest, pos, idx) => {
      const current = positions[farthest]
      return pos.lengthSq() > current.lengthSq() ? idx : farthest
    }, 0)
    const centerBefore = positions[centerIndex].clone()
    const edgeBefore = positions[edgeIndex].clone()

    cloth.applyImpulse(new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), 0.3)

    const centerAfter = cloth.getVertexPositions()[centerIndex]
    const edgeAfter = cloth.getVertexPositions()[edgeIndex]

    expect(centerAfter.x - centerBefore.x).toBeGreaterThan(edgeAfter.x - edgeBefore.x)
  })

  it('ignores zero-length impulses without waking', () => {
    const cloth = buildCloth()
    for (let i = 0; i < 120; i++) {
      cloth.update(0.016)
    }
    expect(cloth.isSleeping()).toBe(true)

    cloth.applyImpulse(new THREE.Vector2(0, 0), new THREE.Vector2(0, 0))

    expect(cloth.isSleeping()).toBe(true)
  })
})
