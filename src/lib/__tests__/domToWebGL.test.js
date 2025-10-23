import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('three', () => {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }
    copy(vector) {
      this.x = vector.x
      this.y = vector.y
      this.z = vector.z
      return this
    }
    set(x, y, z) {
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
    constructor() {
      this.children = []
      this.scale = new Vector3(1, 1, 1)
    }
    add(child) {
      this.children.push(child)
    }
    remove(child) {
      this.children = this.children.filter((c) => c !== child)
    }
  }

  class Scene extends Group {}

  class PlaneGeometry {
    constructor(width, height, widthSegments, heightSegments) {
      this.width = width
      this.height = height
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
    constructor(config) {
      this.config = config
    }
    dispose() {}
  }

  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry
      this.material = material
      this.position = new Vector3()
      this.scale = new Vector3(1, 1, 1)
      this.frustumCulled = true
    }
    updateMatrix() {}
    updateMatrixWorld() {}
  }

  class OrthographicCamera {
    constructor() {
      this.left = 0
      this.right = 0
      this.top = 0
      this.bottom = 0
      this.near = 0
      this.far = 0
      this.position = new Vector3()
      this.up = new Vector3(0, 1, 0)
      this.quaternion = new Quaternion()
    }
    updateProjectionMatrix() {}
    lookAt() {}
    updateMatrixWorld() {}
  }

  class CanvasTexture {
    constructor(canvas) {
      this.canvas = canvas
      this.needsUpdate = false
      this.minFilter = 0
      this.magFilter = 0
    }
    dispose() {}
  }

  class WebGLRenderer {
    constructor() {
      this.domElement = document.createElement('canvas')
      this.lastSize = null
    }
    setPixelRatio() {}
    setSize(width, height) {
      this.lastSize = { width, height }
    }
    render() {}
    dispose() {}
  }

  class Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x
      this.y = y
      this.z = z
      this.w = w
    }
    clone() {
      return new Quaternion(this.x, this.y, this.z, this.w)
    }
    copy(q) {
      this.x = q.x
      this.y = q.y
      this.z = q.z
      this.w = q.w
      return this
    }
  }

  class Matrix3 {
    constructor() {
      this.elements = Array(9).fill(0)
    }
    identity() {
      this.elements = [1, 0, 0, 0, 1, 0, 0, 0, 1]
      return this
    }
    clone() {
      const matrix = new Matrix3()
      matrix.elements = this.elements.slice()
      return matrix
    }
  }

  class Matrix4 {
    constructor() {
      this.elements = Array(16).fill(0)
    }
    compose(position, quaternion, scale) {
      // minimal compose imitation to avoid NaNs in tests
      this.elements[12] = position.x
      this.elements[13] = position.y
      this.elements[14] = position.z
      this.elements[0] = scale.x
      this.elements[5] = scale.y
      this.elements[10] = scale.z
      this.elements[15] = 1
      return this
    }
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
    Quaternion,
    Matrix3,
    Matrix4,
    LinearFilter: 0,
    DoubleSide: 2,
  }
})

import { DOMToWebGL } from '../domToWebGL'
import {
  CANONICAL_HEIGHT_METERS,
  CANONICAL_WIDTH_METERS,
  toCanonicalHeightMeters,
  toCanonicalWidthMeters,
  toCanonicalX,
  toCanonicalY,
} from '../units'

const defaultRect = (left, top, width, height) => ({
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
})

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
    const texture = { dispose: vi.fn() }

    const record = dom.createMesh(element, texture, 1)

    const expectedX = toCanonicalX(rect.left + rect.width / 2, window.innerWidth)
    const expectedY = toCanonicalY(rect.top + rect.height / 2, window.innerHeight)
    expect(record.mesh.position.x).toBeCloseTo(expectedX)
    expect(record.mesh.position.y).toBeCloseTo(expectedY)
    expect(record.widthMeters).toBeCloseTo(toCanonicalWidthMeters(rect.width, window.innerWidth))
    expect(record.heightMeters).toBeCloseTo(toCanonicalHeightMeters(rect.height, window.innerHeight))

    dom.detach()
  })

  it('updates mesh transform from DOM rect when layout metadata is absent', () => {
    const dom = new DOMToWebGL(document.body)
    const element = document.createElement('div')
    let rect = defaultRect(50, 50, 80, 40)
    element.getBoundingClientRect = () => rect
    const record = dom.createMesh(element, { dispose() {} }, 1)

    delete record.layout
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

  it('tracks transforms through WorldBody instances', () => {
    const dom = new DOMToWebGL(document.body)
    const element = document.createElement('div')
    let rect = defaultRect(40, 60, 120, 48)
    element.getBoundingClientRect = () => rect
    const record = dom.createMesh(element, { dispose() {} }, 1)

    expect(record.worldBody).toBeDefined()
    const expectedInitialX = toCanonicalX(rect.left + rect.width / 2, window.innerWidth)
    const expectedInitialY = toCanonicalY(rect.top + rect.height / 2, window.innerHeight)
    expect(record.worldBody.position.x).toBeCloseTo(expectedInitialX)
    expect(record.worldBody.position.y).toBeCloseTo(expectedInitialY)
    expect(record.mesh.position.x).toBeCloseTo(expectedInitialX)
    expect(record.mesh.position.y).toBeCloseTo(expectedInitialY)

    delete record.layout
    rect = defaultRect(80, 90, 200, 120)
    dom.updateMeshTransform(element, record)
    const expectedUpdatedX = toCanonicalX(rect.left + rect.width / 2, window.innerWidth)
    const expectedUpdatedY = toCanonicalY(rect.top + rect.height / 2, window.innerHeight)
    expect(record.worldBody.position.x).toBeCloseTo(expectedUpdatedX)
    expect(record.worldBody.position.y).toBeCloseTo(expectedUpdatedY)
    expect(record.mesh.position.x).toBeCloseTo(expectedUpdatedX)
    expect(record.mesh.position.y).toBeCloseTo(expectedUpdatedY)
    expect(record.mesh.scale.x).toBeGreaterThan(1)
    expect(record.mesh.scale.y).toBeGreaterThan(1)

    record.worldBody.resetTransform({ includePosition: false })
    expect(record.mesh.scale.x).toBeCloseTo(1)
    expect(record.mesh.scale.y).toBeCloseTo(1)
    expect(record.mesh.position.x).toBeCloseTo(expectedUpdatedX)
    expect(record.mesh.position.y).toBeCloseTo(expectedUpdatedY)

    dom.detach()
  })

  it('updates root group scale when resizing the viewport', () => {
    const dom = new DOMToWebGL(document.body)
    const rootGroup = dom.rootGroup
    expect(rootGroup.scale.x).toBe(1)
    expect(rootGroup.scale.y).toBe(1)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
    dom.resize()

    expect(rootGroup.scale.x).toBe(1)
    expect(rootGroup.scale.y).toBe(1)

    dom.detach()
  })

  it('maps pointer positions into canonical space', () => {
    const dom = new DOMToWebGL(document.body)
    const canonical = dom.pointerToCanonical(600, 450)
    expect(canonical.x).toBeCloseTo(0)
    expect(canonical.y).toBeCloseTo(0)
    dom.detach()
  })

  it('exposes a world camera aligned with canonical space', () => {
    const dom = new DOMToWebGL(document.body)
    const worldCamera = dom.getWorldCamera()
    expect(worldCamera).toBeDefined()
    expect(worldCamera.orthoWidth).toBeCloseTo(CANONICAL_WIDTH_METERS)
    expect(worldCamera.orthoHeight).toBeCloseTo(CANONICAL_HEIGHT_METERS)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    dom.resize()
    expect(worldCamera.aspect).toBeCloseTo(1600 / window.innerHeight)

    dom.detach()
  })

  it('captures layout metadata from dataset overrides', () => {
    const dom = new DOMToWebGL(document.body)
    const element = document.createElement('div')
    element.dataset.clothAnchor = 'top-right'
    element.dataset.clothScale = 'width height'
    element.dataset.clothPadding = 'right:120,top:40'
    const rect = defaultRect(900, 100, 200, 120)
    element.getBoundingClientRect = () => rect
    const record = dom.createMesh(element, { dispose() {} }, 4)

    expect(record.layout.anchorX).toBe('right')
    expect(record.layout.anchorY).toBe('top')
    expect(record.layout.scaleX).toBe(true)
    expect(record.layout.scaleY).toBe(true)
    expect(record.layout.paddingRightPx).toBeCloseTo(120)
    expect(record.layout.paddingTopPx).toBeCloseTo(40)
    expect(record.layout.referenceWidthPx).toBe(1200)
    expect(record.layout.referenceHeightPx).toBe(900)
    expect(record.layout.centerRatioX).toBeCloseTo((rect.left + rect.width / 2) / 1200)
    expect(record.layout.centerRatioY).toBeCloseTo((rect.top + rect.height / 2) / 900)

    dom.detach()
  })

  it('applies layout metadata when resizing the viewport', () => {
    const dom = new DOMToWebGL(document.body)
    const element = document.createElement('div')
    element.dataset.clothAnchor = 'top-right'
    element.dataset.clothScale = 'width height'
    const baseRect = defaultRect(900, 100, 200, 120)
    element.getBoundingClientRect = () => baseRect
    const record = dom.createMesh(element, { dispose() {} }, 1)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
    dom.resize()

    dom.updateMeshTransform(element, record)

    const scaleX = 1600 / 1200
    const scaleY = 1000 / 900
    const expectedWidth = record.baseWidthMeters * scaleX
    const expectedHeight = record.baseHeightMeters * scaleY
    const padRightPx = (1200 - (baseRect.left + baseRect.width)) * scaleX
    const padTopPx = baseRect.top * scaleY
    const padRightMeters = toCanonicalWidthMeters(padRightPx, 1600)
    const padTopMeters = toCanonicalHeightMeters(padTopPx, 1000)

    const expectedX = CANONICAL_WIDTH_METERS / 2 - padRightMeters - expectedWidth / 2
    const expectedY = CANONICAL_HEIGHT_METERS / 2 - padTopMeters - expectedHeight / 2

    expect(record.mesh.position.x).toBeCloseTo(expectedX)
    expect(record.mesh.position.y).toBeCloseTo(expectedY)
    expect(record.mesh.scale.x).toBeCloseTo(expectedWidth / record.baseWidthMeters)
    expect(record.mesh.scale.y).toBeCloseTo(expectedHeight / record.baseHeightMeters)

    dom.detach()
  })
})
