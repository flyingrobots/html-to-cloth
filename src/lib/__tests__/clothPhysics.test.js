import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ClothPhysics } from '../clothPhysics'

const makeCloth = (widthVertices = 3, heightVertices = 3) => {
  const geometry = new THREE.PlaneGeometry(1, 1, widthVertices - 1, heightVertices - 1)
  const material = new THREE.MeshBasicMaterial()
  const mesh = new THREE.Mesh(geometry, material)
  const cloth = new ClothPhysics(mesh)
  return { cloth, mesh, geometry }
}

/**
 * @param {number} widthVertices
 * @param {number} heightVertices
 */
const buildNeighborPairs = (widthVertices, heightVertices) => {
  /** @type {Array<[number, number]>} */
  const pairs = []
  for (let y = 0; y < heightVertices; y++) {
    for (let x = 0; x < widthVertices; x++) {
      const idx = y * widthVertices + x
      if (x < widthVertices - 1) {
        pairs.push([idx, idx + 1])
      }
      if (y < heightVertices - 1) {
        pairs.push([idx, idx + widthVertices])
      }
    }
  }
  return pairs
}

/**
 * @param {THREE.Vector3[]} positions
 */
const findTopIndices = (positions) => {
  const maxY = Math.max(...positions.map((p) => p.y))
  return positions
    .map((p, index) => ({ index, y: p.y }))
    .filter(({ y }) => Math.abs(y - maxY) < 1e-5)
    .map(({ index }) => index)
}

describe('ClothPhysics', () => {
  it('drops under gravity while keeping edge lengths stable', () => {
    const { cloth, geometry } = makeCloth(4, 4)
    const widthVertices = (geometry.parameters.widthSegments ?? 1) + 1
    const heightVertices = (geometry.parameters.heightSegments ?? 1) + 1
    const neighborPairs = buildNeighborPairs(widthVertices, heightVertices)

    const initialPositions = cloth.getVertexPositions()
    const initialAverageY = initialPositions.reduce((sum, v) => sum + v.y, 0) / initialPositions.length
    const initialLengths = neighborPairs.map(([a, b]) => initialPositions[a].distanceTo(initialPositions[b]))

    cloth.update(0.1)

    const afterPositions = cloth.getVertexPositions()
    const afterAverageY = afterPositions.reduce((sum, v) => sum + v.y, 0) / afterPositions.length
    expect(afterAverageY).toBeLessThan(initialAverageY)

    neighborPairs.forEach(([a, b], i) => {
      const afterLength = afterPositions[a].distanceTo(afterPositions[b])
      expect(afterLength).toBeCloseTo(initialLengths[i], 3)
    })
  })

  it('keeps pinned top edge locked in place', () => {
    const { cloth } = makeCloth(4, 4)
    const before = cloth.getVertexPositions()
    const topIndices = findTopIndices(before)

    cloth.pinTopEdge()
    cloth.update(0.016)
    cloth.update(0.016)

    const after = cloth.getVertexPositions()
    topIndices.forEach((index) => {
      expect(after[index].y).toBeCloseTo(before[index].y, 2)
    })
  })

  it('responds to pointer impulses', () => {
    const { cloth } = makeCloth(4, 4)
    const before = cloth.getVertexPositions()
    const targetIndex = 0

    cloth.applyPointForce(new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0), 1.2, 1)
    cloth.update(0.016)

    const after = cloth.getVertexPositions()
    expect(after[targetIndex].x).toBeGreaterThan(before[targetIndex].x)
  })

  it('clamps vertices inside an AABB and syncs geometry', () => {
    const { cloth, mesh } = makeCloth(4, 4)

    for (let i = 0; i < 40; i++) {
      cloth.applyPointForce(new THREE.Vector2(0, 0), new THREE.Vector2(0, -2), 1.5, 1)
      cloth.update(0.016)
    }

    cloth.constrainWithinAABB(new THREE.Vector2(-0.3, -0.2), new THREE.Vector2(0.3, 0.2))

    const positions = cloth.getVertexPositions()
    positions.forEach((pos) => {
      expect(pos.x).toBeGreaterThanOrEqual(-0.3 - 1e-4)
      expect(pos.x).toBeLessThanOrEqual(0.3 + 1e-4)
      expect(pos.y).toBeGreaterThanOrEqual(-0.2 - 1e-4)
      expect(pos.y).toBeLessThanOrEqual(0.2 + 1e-4)
    })

    const bufferPositions = mesh.geometry.attributes.position
    positions.forEach((pos, index) => {
      expect(bufferPositions.getX(index)).toBeCloseTo(pos.x, 5)
      expect(bufferPositions.getY(index)).toBeCloseTo(pos.y, 5)
    })
  })

  it('reports offscreen once the cloth falls below a boundary', () => {
    const { cloth } = makeCloth(3, 3)

    for (let i = 0; i < 240; i++) {
      cloth.update(0.016)
      if (cloth.isOffscreen(-1)) break
    }

    expect(cloth.isOffscreen(-1)).toBe(true)
  })

  it('falls asleep when motion stays below the threshold and wakes on impulse', () => {
    const { cloth } = makeCloth(3, 3)
    cloth.setGravity(new THREE.Vector3(0, 0, 0))

    for (let i = 0; i < 120; i++) {
      cloth.update(0.016)
    }

    expect(cloth.isSleeping()).toBe(true)

    const before = cloth.getVertexPositions()[0].clone()
    cloth.applyPointForce(new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0), 1, 1)
    expect(cloth.isSleeping()).toBe(false)

    cloth.update(0.016)
    const after = cloth.getVertexPositions()[0]
    expect(after.x).not.toBeCloseTo(before.x)
  })

  it('wakes when a point enters its bounding sphere', () => {
    const { cloth } = makeCloth(3, 3)
    cloth.setGravity(new THREE.Vector3(0, 0, 0))

    for (let i = 0; i < 120; i++) {
      cloth.update(0.016)
    }

    expect(cloth.isSleeping()).toBe(true)

    const sphere = cloth.getBoundingSphere()
    const insidePoint = new THREE.Vector2(sphere.center.x, sphere.center.y)

    cloth.wakeIfPointInside(insidePoint)

    expect(cloth.isSleeping()).toBe(false)
  })

  it('does not introduce spurious velocity after relaxing constraints', () => {
    const { cloth } = makeCloth(4, 4)
    cloth.setGravity(new THREE.Vector3(0, 0, 0))

    cloth.applyImpulse(new THREE.Vector2(0, 0), new THREE.Vector2(0.6, -0.3), 1)
    const postImpulse = cloth.getVertexPositions().map((p) => p.clone())

    cloth.relaxConstraints(cloth.constraintIterations * 4)
    const settled = cloth.getVertexPositions().map((p) => p.clone())

    // Ensure relax pass actually changed positions (cloth snapped back toward rest)
    const moved = settled.some((pos, index) => !pos.equals(postImpulse[index]))
    expect(moved).toBe(true)

    cloth.update(0.016)
    const after = cloth.getVertexPositions()

    after.forEach((pos, index) => {
      expect(pos.x).toBeCloseTo(settled[index].x, 3)
      expect(pos.y).toBeCloseTo(settled[index].y, 3)
      expect(pos.z).toBeCloseTo(settled[index].z, 3)
    })
  })
})
