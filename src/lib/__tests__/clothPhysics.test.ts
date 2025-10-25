import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { ClothPhysics } from '../clothPhysics'
import { GravityController } from '../gravityController'

const makeCloth = (widthVertices = 3, heightVertices = 3) => {
  const geometry = new THREE.PlaneGeometry(1, 1, widthVertices - 1, heightVertices - 1)
  const material = new THREE.MeshBasicMaterial()
  const mesh = new THREE.Mesh(geometry, material)
  const cloth = new ClothPhysics(mesh)
  return { cloth, mesh, geometry }
}

const buildNeighborPairs = (widthVertices: number, heightVertices: number) => {
  const pairs: Array<[number, number]> = []
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

const findTopIndices = (positions: THREE.Vector3[]) => {
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

  it('returns a 2D bounding sphere compatible with SimWorld', () => {
    const { cloth } = makeCloth(3, 3)

    const sphere = cloth.getBoundingSphere()

    expect(sphere).toEqual(
      expect.objectContaining({
        center: expect.any(THREE.Vector2),
        radius: expect.any(Number),
      })
    )
    expect(sphere.center).toBeInstanceOf(THREE.Vector2)
    expect(Number.isFinite(sphere.radius)).toBe(true)
    expect(sphere.radius).toBeGreaterThan(0)
  })

  it('performs constraint solves for each configured substep', () => {
    const { cloth } = makeCloth(3, 3)
    cloth.setSubsteps(3)
    cloth.setConstraintIterations(1)

    const satisfySpy = vi.spyOn(cloth as any, 'satisfyConstraint')

    cloth.update(0.016)

    const constraintCount = (cloth as any).constraints.length
    expect(satisfySpy).toHaveBeenCalledTimes(constraintCount * 3)

    satisfySpy.mockRestore()
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

  it('warm start temporarily overrides gravity without mutating the base value', () => {
    const { cloth } = makeCloth(3, 3)
    cloth.setGravity(new THREE.Vector3(0, -4, 0))

    const beforeGravity = cloth.getGravity()
    const initialPositions = cloth.getVertexPositions()
    const initialAverageY = initialPositions.reduce((sum, v) => sum + v.y, 0) / initialPositions.length
    cloth.warmStart({ passes: 1, constraintIterations: 4 })
    const afterGravity = cloth.getGravity()

    expect(afterGravity.y).toBeCloseTo(beforeGravity.y)

    cloth.update(0.05)
    const positions = cloth.getVertexPositions()
    const afterAverageY = positions.reduce((sum, v) => sum + v.y, 0) / positions.length
    expect(afterAverageY).toBeLessThan(initialAverageY)
  })

  it('respects an injected gravity controller instance', () => {
    const controller = new GravityController(new THREE.Vector3(0, -2, 0))
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const mesh = new THREE.Mesh(geometry, material)
    const cloth = new ClothPhysics(mesh, { gravityController: controller })

    expect(cloth.getGravity().y).toBeCloseTo(-2)

    controller.setBase(new THREE.Vector3(0, -6, 0))
    expect(cloth.getGravity().y).toBeCloseTo(-6)
  })

  it('returns a 2D bounding sphere compatible with SimWorld', () => {
    const { cloth } = makeCloth(3, 3)

    const sphere = cloth.getBoundingSphere()

    expect(sphere.radius).toBeGreaterThan(0)
    expect(sphere.center).toBeInstanceOf(THREE.Vector2)
    expect('center' in sphere && 'radius' in sphere).toBe(true)
    expect((sphere as any).clone).toBeUndefined()
  })

  it('applies substeps consistently with manual integration', () => {
    const first = makeCloth(3, 3).cloth
    const second = makeCloth(3, 3).cloth

    first.setSubsteps(2)

    first.update(0.1)

    second.update(0.05)
    second.update(0.05)

    const posFirst = first.getVertexPositions()[5]
    const posSecond = second.getVertexPositions()[5]

    expect(posFirst.x).toBeCloseTo(posSecond.x, 5)
    expect(posFirst.y).toBeCloseTo(posSecond.y, 5)
  })
})
