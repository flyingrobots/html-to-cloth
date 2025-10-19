import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { ElementPool } from '../elementPool'

/**
 * @typedef {import('../domToWebGL.js').DOMMeshRecord} DOMMeshRecord
 */

const createMockDomBridge = () => {
  const texture = new THREE.Texture()
  const bridge = {
    captureElement: vi.fn(async () => texture),
    createMesh: vi.fn((element, tex, segments) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial())
      /** @type {DOMMeshRecord} */
      const record = {
        mesh,
        baseWidthMeters: 1,
        baseHeightMeters: 1,
        widthMeters: 1,
        heightMeters: 1,
        texture: tex,
        initialPositions: Float32Array.from(mesh.geometry.attributes.position.array),
        segments,
      }
      return record
    }),
    addMesh: vi.fn(),
    removeMesh: vi.fn(),
    disposeMesh: vi.fn(),
    updateMeshTransform: vi.fn(),
    getViewportPixels: vi.fn(() => ({ width: 1280, height: 720 })),
  }

  return { bridge }
}

describe('ElementPool', () => {
  it('captures a DOM element once and reuses its mesh across mounts', async () => {
    const { bridge } = createMockDomBridge()
    const pool = new ElementPool(bridge)

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
    const pool = new ElementPool(bridge)

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
    const pool = new ElementPool(bridge)

    const unknown = document.createElement('section')

    pool.mount(unknown)

    expect(bridge.captureElement).not.toHaveBeenCalled()
    expect(bridge.createMesh).not.toHaveBeenCalled()
  })

  it('restores geometry, scale, and cached dimensions on reset', async () => {
    const { bridge } = createMockDomBridge()
    const pool = new ElementPool(bridge)

    const element = document.createElement('div')

    await pool.prepare(element)
    const stored = pool.getRecord(element)
    expect(stored?.segments).toBeGreaterThan(0)

    const positions = stored?.mesh.geometry.attributes.position
    const array = positions.array

    // disturb positions and dimensions
    for (let i = 0; i < array.length; i++) {
      array[i] += 0.5
    }
    stored.mesh.scale.set(2, 3, 1)
    stored.widthMeters = 5
    stored.heightMeters = 7

    pool.resetGeometry(element)

    expect(Array.from(positions.array)).toEqual(
      Array.from(stored.initialPositions)
    )
    expect(stored.mesh.scale.x).toBeCloseTo(1)
    expect(stored.mesh.scale.y).toBeCloseTo(1)
    expect(stored.widthMeters).toBeCloseTo(stored.baseWidthMeters)
    expect(stored.heightMeters).toBeCloseTo(stored.baseHeightMeters)
  })

  it('scales tessellation with element screen coverage', async () => {
    const { bridge } = createMockDomBridge()
    const pool = new ElementPool(bridge)

    const large = document.createElement('div')
    large.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON() {},
    })

    const small = document.createElement('div')
    small.getBoundingClientRect = () => ({
      width: 80,
      height: 80,
      top: 0,
      left: 0,
      right: 80,
      bottom: 80,
      x: 0,
      y: 0,
      toJSON() {},
    })

    await pool.prepare(large, 24)
    await pool.prepare(small, 24)

    const largeRecord = pool.getRecord(large)
    const smallRecord = pool.getRecord(small)

    expect(largeRecord?.segments).toBeGreaterThan(smallRecord?.segments ?? 0)
    expect(smallRecord?.segments).toBeGreaterThanOrEqual(6)
  })
})
