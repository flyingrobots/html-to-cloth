import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { DOMMeshRecord } from '../domToWebGL'
import { ElementPool } from '../elementPool'

type MockDOMBridge = {
  captureElement: ReturnType<typeof vi.fn>
  createMesh: ReturnType<typeof vi.fn>
  addMesh: ReturnType<typeof vi.fn>
  removeMesh: ReturnType<typeof vi.fn>
  disposeMesh: ReturnType<typeof vi.fn>
  updateMeshTransform: ReturnType<typeof vi.fn>
}

const createMockDomBridge = () => {
  const texture = new THREE.Texture()
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial())
  const record: DOMMeshRecord = {
    mesh,
    baseWidthMeters: 1,
    baseHeightMeters: 1,
    widthMeters: 1,
    heightMeters: 1,
    texture,
    initialPositions: new Float32Array(mesh.geometry.attributes.position.array as Float32Array),
    segments: 24,
  }

  const bridge: MockDOMBridge = {
    captureElement: vi.fn(async () => texture),
    createMesh: vi.fn(() => record),
    addMesh: vi.fn(),
    removeMesh: vi.fn(),
    disposeMesh: vi.fn(),
    updateMeshTransform: vi.fn(),
  }

  return { bridge, record }
}

describe('ElementPool', () => {
  it('captures a DOM element once and reuses its mesh across mounts', async () => {
    const { bridge } = createMockDomBridge()
    const pool = new ElementPool(bridge as any)

    const element = document.createElement('button')

    await pool.prepare(element)
    expect(bridge.captureElement).toHaveBeenCalledTimes(1)
    expect(bridge.createMesh).toHaveBeenCalledTimes(1)

    pool.mount(element)
    pool.recycle(element)
    pool.mount(element)

    expect(bridge.captureElement).toHaveBeenCalledTimes(1)
    expect(bridge.createMesh).toHaveBeenCalledTimes(1)
    expect(bridge.addMesh).toHaveBeenCalledTimes(2)
    expect(bridge.removeMesh).toHaveBeenCalledTimes(1)
  })

  it('disposes mesh and texture when an element is destroyed', async () => {
    const { bridge } = createMockDomBridge()
    const pool = new ElementPool(bridge as any)

    const element = document.createElement('div')

    await pool.prepare(element)
    pool.mount(element)
    pool.recycle(element)
    pool.destroy(element)

    expect(bridge.removeMesh).toHaveBeenCalled()
    expect(bridge.disposeMesh).toHaveBeenCalled()
  })

  it('fails gracefully when activating an unknown element', async () => {
    const { bridge } = createMockDomBridge()
    const pool = new ElementPool(bridge as any)

    const unknown = document.createElement('section')

    pool.mount(unknown)

    expect(bridge.captureElement).not.toHaveBeenCalled()
    expect(bridge.createMesh).not.toHaveBeenCalled()
  })

  it('restores geometry, scale, and cached dimensions on reset', async () => {
    const { bridge, record } = createMockDomBridge()
    const pool = new ElementPool(bridge as any)

    const element = document.createElement('div')

    await pool.prepare(element)
    const stored = pool.getRecord(element)
    expect(stored).toBe(record)

    const positions = record.mesh.geometry.attributes.position
    const array = positions.array as Float32Array

    // disturb positions and dimensions
    for (let i = 0; i < array.length; i++) {
      array[i] += 0.5
    }
    record.mesh.scale.set(2, 3, 1)
    record.widthMeters = 5
    record.heightMeters = 7

    pool.resetGeometry(element)

    expect(Array.from(positions.array as Float32Array)).toEqual(
      Array.from(record.initialPositions)
    )
    expect(record.mesh.scale.x).toBeCloseTo(1)
    expect(record.mesh.scale.y).toBeCloseTo(1)
    expect(record.widthMeters).toBeCloseTo(record.baseWidthMeters)
    expect(record.heightMeters).toBeCloseTo(record.baseHeightMeters)
  })
})
