import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('three', () => {
  class Vector3 {
    constructor(public x = 0, public y = 0, public z = 0) {}
    set(x: number, y: number, z: number) {
      this.x = x
      this.y = y
      this.z = z
      return this
    }
    clone() {
      return new Vector3(this.x, this.y, this.z)
    }
  }

  class Group {
    public children: any[] = []
    public scale = new Vector3(1, 1, 1)
    add(child: any) {
      this.children.push(child)
    }
    remove(child: any) {
      this.children = this.children.filter((c) => c !== child)
    }
  }

  class Scene extends Group {}

  class PlaneGeometry {
    public parameters: any
    public attributes: any
    constructor(public width: number, public height: number, widthSegments: number, heightSegments: number) {
      this.parameters = { widthSegments, heightSegments }
      const vertexCount = (widthSegments + 1) * (heightSegments + 1)
      this.attributes = {
        position: {
          array: new Float32Array(vertexCount * 3),
        },
      }
    }
  }

  class MeshBasicMaterial {
    constructor(public config: any) {}
    dispose() {}
  }

  class Mesh {
    public position = new Vector3()
    public scale = new Vector3(1, 1, 1)
    public frustumCulled = true
    constructor(public geometry: any, public material: any) {}
  }

  class OrthographicCamera {
    public left = 0
    public right = 0
    public top = 0
    public bottom = 0
    public near = 0
    public far = 0
    public position = new Vector3()
    updateProjectionMatrix() {}
    lookAt() {}
  }

  class CanvasTexture {
    constructor(public canvas: HTMLCanvasElement) {}
    needsUpdate = false
    minFilter = 0
    magFilter = 0
    dispose() {}
  }

  class WebGLRenderer {
    public domElement: HTMLCanvasElement
    public lastSize: { width: number; height: number } | null = null
    constructor(_options: any) {
      this.domElement = document.createElement('canvas')
    }
    setPixelRatio() {}
    setSize(width: number, height: number) {
      this.lastSize = { width, height }
    }
    render() {}
    dispose() {}
  }

  return {
    Scene,
    OrthographicCamera,
    WebGLRenderer,
    PlaneGeometry,
    MeshBasicMaterial,
    Mesh,
    CanvasTexture,
    Group,
    Vector3,
    LinearFilter: 0,
    DoubleSide: 2,
  }
})

import { DOMToWebGL } from '../domToWebGL'
import {
  CANONICAL_HEIGHT_METERS,
  CANONICAL_WIDTH_METERS,
  computeViewportScale,
  toCanonicalHeightMeters,
  toCanonicalWidthMeters,
  toCanonicalX,
  toCanonicalY,
} from '../units'

const defaultRect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON() {
    return {}
  },
}) as DOMRect

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
  document.body.innerHTML = ''
})

describe('DOMToWebGL canonical mapping', () => {
  it('positions meshes using canonical coordinates derived from DOM rects', () => {
    const dom = new DOMToWebGL(document.body)
    const element = document.createElement('div')
    let rect = defaultRect(100, 200, 120, 60)
    element.getBoundingClientRect = () => rect
    const texture = { dispose: vi.fn() } as any

    const record = dom.createMesh(element, texture, 1)

    const expectedX = toCanonicalX(rect.left + rect.width / 2, window.innerWidth)
    const expectedY = toCanonicalY(rect.top + rect.height / 2, window.innerHeight)
    expect(record.mesh.position.x).toBeCloseTo(expectedX)
    expect(record.mesh.position.y).toBeCloseTo(expectedY)
    expect(record.widthMeters).toBeCloseTo(toCanonicalWidthMeters(rect.width, window.innerWidth))
    expect(record.heightMeters).toBeCloseTo(toCanonicalHeightMeters(rect.height, window.innerHeight))

    dom.detach()
  })

  it('updates mesh transform when DOM rect changes', () => {
    const dom = new DOMToWebGL(document.body)
    const element = document.createElement('div')
    let rect = defaultRect(50, 50, 80, 40)
    element.getBoundingClientRect = () => rect
    const record = dom.createMesh(element, {} as any, 1)

    rect = defaultRect(150, 120, 160, 80)
    dom.updateMeshTransform(element, record)

    const expectedX = toCanonicalX(rect.left + rect.width / 2, window.innerWidth)
    const expectedY = toCanonicalY(rect.top + rect.height / 2, window.innerHeight)
    expect(record.mesh.position.x).toBeCloseTo(expectedX)
    expect(record.mesh.position.y).toBeCloseTo(expectedY)

    const expectedScaleX = toCanonicalWidthMeters(rect.width, window.innerWidth) / record.baseWidthMeters
    const expectedScaleY = toCanonicalHeightMeters(rect.height, window.innerHeight) / record.baseHeightMeters
    expect(record.mesh.scale.x).toBeCloseTo(expectedScaleX)
    expect(record.mesh.scale.y).toBeCloseTo(expectedScaleY)

    dom.detach()
  })

  it('updates root group scale when resizing the viewport', () => {
    const dom = new DOMToWebGL(document.body)
    const rootGroup = (dom as any).rootGroup as { scale: { x: number; y: number } }
    const initialScale = computeViewportScale(window.innerWidth, window.innerHeight)
    expect(rootGroup.scale.x).toBeCloseTo(initialScale.scaleX)
    expect(rootGroup.scale.y).toBeCloseTo(initialScale.scaleY)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
    dom.resize()

    const updatedScale = computeViewportScale(window.innerWidth, window.innerHeight)
    expect(rootGroup.scale.x).toBeCloseTo(updatedScale.scaleX)
    expect(rootGroup.scale.y).toBeCloseTo(updatedScale.scaleY)

    dom.detach()
  })

  it('maps pointer positions into canonical space', () => {
    const dom = new DOMToWebGL(document.body)
    const canonical = dom.pointerToCanonical(600, 450)
    expect(canonical.x).toBeCloseTo(0)
    expect(canonical.y).toBeCloseTo(0)
    dom.detach()
  })
})
