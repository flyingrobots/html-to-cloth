import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

const domMocks = {
  capture: vi.fn(),
  createMesh: vi.fn(),
  addMesh: vi.fn(),
  removeMesh: vi.fn(),
  disposeMesh: vi.fn(),
  updateMeshTransform: vi.fn(),
  resize: vi.fn(),
  render: vi.fn(),
  pointerToCanonical: vi.fn((x: number, y: number) => ({ x: x / 100, y: y / 100 })),
  detach: vi.fn(),
  rendererDispose: vi.fn(),
  instances: [] as any[],
}

const poolMocks = {
  prepare: vi.fn(),
  mount: vi.fn(),
  getRecord: vi.fn(),
  recycle: vi.fn(),
  resetGeometry: vi.fn(),
  destroy: vi.fn(),
  instances: [] as any[],
}

const collisionMocks = {
  addStaticBody: vi.fn(),
  removeStaticBody: vi.fn(),
  apply: vi.fn(),
  setViewportDimensions: vi.fn(),
  refresh: vi.fn(),
  clear: vi.fn(),
}

const schedulerMocks = {
  addBody: vi.fn(),
  removeBody: vi.fn(),
  notifyPointer: vi.fn(),
  step: vi.fn(),
  clear: vi.fn(),
}

const clothMocks = {
  instances: [] as any[],
}

const recordMap = new Map<HTMLElement, any>()

vi.mock('../domToWebGL', () => {
  class MockDOMToWebGL {
    constructor(public container: HTMLElement) {
      domMocks.instances.push(this)
    }

    captureElement = domMocks.capture
    createMesh = domMocks.createMesh
    addMesh = domMocks.addMesh
    removeMesh = domMocks.removeMesh
    disposeMesh = domMocks.disposeMesh
    updateMeshTransform = domMocks.updateMeshTransform
    resize = domMocks.resize
    render = domMocks.render
    renderer = { dispose: vi.fn(() => domMocks.rendererDispose()) }
    detach = vi.fn(() => domMocks.detach())

    pointerToCanonical(x: number, y: number) {
      return domMocks.pointerToCanonical(x, y)
    }

    getViewportPixels() {
      return { width: 1200, height: 900 }
    }

    getViewportMeters() {
      return { width: 1, height: 1 }
    }
  }

  return { DOMToWebGL: MockDOMToWebGL }
})

vi.mock('../elementPool', () => {
  class MockElementPool {
    constructor() {
      poolMocks.instances.push(this)
    }

    prepare = vi.fn(async (element: HTMLElement) => {
      poolMocks.prepare(element)
      if (!recordMap.has(element)) {
        const geometry = new THREE.PlaneGeometry(1, 1, 1, 1)
        const material = new THREE.MeshBasicMaterial()
        const mesh = new THREE.Mesh(geometry, material)
        const initialPositions = new Float32Array((geometry.attributes.position.array as Float32Array).slice())
        recordMap.set(element, {
          mesh,
          baseWidthMeters: 1,
          baseHeightMeters: 1,
          widthMeters: 1,
          heightMeters: 1,
          texture: {} as THREE.Texture,
          initialPositions,
        })
      }
    })

    mount = vi.fn((element: HTMLElement) => poolMocks.mount(element))
    getRecord = vi.fn((element: HTMLElement) => {
      poolMocks.getRecord(element)
      return recordMap.get(element)
    })
    recycle = vi.fn((element: HTMLElement) => poolMocks.recycle(element))
    resetGeometry = vi.fn((element: HTMLElement) => poolMocks.resetGeometry(element))
    destroy = vi.fn(() => poolMocks.destroy())
  }

  return { ElementPool: MockElementPool }
})

vi.mock('../collisionSystem', () => {
  class MockCollisionSystem {
    addStaticBody = vi.fn((element: HTMLElement) => collisionMocks.addStaticBody(element))
    removeStaticBody = vi.fn((element: HTMLElement) => collisionMocks.removeStaticBody(element))
    apply = vi.fn(() => collisionMocks.apply())
    setViewportDimensions = vi.fn((w: number, h: number) => collisionMocks.setViewportDimensions(w, h))
    refresh = vi.fn(() => collisionMocks.refresh())
    clear = vi.fn(() => collisionMocks.clear())
  }

  return { CollisionSystem: MockCollisionSystem }
})

vi.mock('../simulationScheduler', () => {
  class MockSimulationScheduler {
    addBody = vi.fn((body: any) => schedulerMocks.addBody(body))
    removeBody = vi.fn((id: string) => schedulerMocks.removeBody(id))
    notifyPointer = vi.fn((point: THREE.Vector2) => schedulerMocks.notifyPointer(point))
    step = vi.fn((dt: number) => schedulerMocks.step(dt))
    clear = vi.fn(() => schedulerMocks.clear())
  }

  return { SimulationScheduler: MockSimulationScheduler }
})

vi.mock('../clothPhysics', () => {
  class MockClothPhysics {
    public pinTopEdge = vi.fn()
    public addTurbulence = vi.fn()
    public releaseAllPins = vi.fn()
    public update = vi.fn()
    public applyPointForce = vi.fn()
    public isOffscreen = vi.fn(() => false)
    public wake = vi.fn()
    public wakeIfPointInside = vi.fn()

    constructor(public mesh: THREE.Mesh) {
      clothMocks.instances.push(this)
    }
  }

  return { ClothPhysics: MockClothPhysics }
})

import { PortfolioWebGL } from '../portfolioWebGL'

const resetSpies = () => {
  domMocks.capture.mockReset()
  domMocks.createMesh.mockReset()
  domMocks.addMesh.mockReset()
  domMocks.removeMesh.mockReset()
  domMocks.disposeMesh.mockReset()
  domMocks.updateMeshTransform.mockReset()
  domMocks.resize.mockReset()
  domMocks.render.mockReset()
  domMocks.pointerToCanonical.mockClear()
  domMocks.detach.mockReset()
  domMocks.rendererDispose.mockReset()
  domMocks.instances.length = 0

  poolMocks.prepare.mockReset()
  poolMocks.mount.mockReset()
  poolMocks.getRecord.mockReset()
  poolMocks.recycle.mockReset()
  poolMocks.resetGeometry.mockReset()
  poolMocks.destroy.mockReset()
  poolMocks.instances.length = 0

  collisionMocks.addStaticBody.mockReset()
  collisionMocks.removeStaticBody.mockReset()
  collisionMocks.apply.mockReset()
  collisionMocks.setViewportDimensions.mockReset()
  collisionMocks.refresh.mockReset()
  collisionMocks.clear.mockReset()

  schedulerMocks.addBody.mockReset()
  schedulerMocks.removeBody.mockReset()
  schedulerMocks.notifyPointer.mockReset()
  schedulerMocks.step.mockReset()
  schedulerMocks.clear.mockReset()

  clothMocks.instances.length = 0
  recordMap.clear()
}

let rafSpy: vi.SpyInstance<number, [FrameRequestCallback]>
let cafSpy: vi.SpyInstance<void, [number]>

beforeAll(() => {
  if (typeof (globalThis as any).PointerEvent === 'undefined') {
    ;(globalThis as any).PointerEvent = MouseEvent as unknown as typeof PointerEvent
  }
})

beforeEach(() => {
  resetSpies()
  rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as any)
  cafSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  document.body.innerHTML = `
    <div class="wrapper">
      <button id="cta" class="cloth-enabled">Click me</button>
      <div id="static">Static content</div>
      <a id="link" class="cloth-enabled">Link</a>
    </div>
  `
  ;(document.getElementById('cta') as HTMLElement).getBoundingClientRect = () => ({
    left: 100,
    top: 200,
    right: 220,
    bottom: 260,
    width: 120,
    height: 60,
    x: 100,
    y: 200,
    toJSON() {},
  })
  ;(document.getElementById('link') as HTMLElement).getBoundingClientRect = () => ({
    left: 400,
    top: 100,
    right: 460,
    bottom: 140,
    width: 60,
    height: 40,
    x: 400,
    y: 100,
    toJSON() {},
  })
})

afterEach(() => {
  rafSpy.mockRestore()
  cafSpy.mockRestore()
  document.body.innerHTML = ''
})

describe('PortfolioWebGL DOM integration', () => {
  it('captures cloth-enabled elements, hides DOM, and mounts meshes on init', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    const clothElements = Array.from(document.querySelectorAll<HTMLElement>('.cloth-enabled'))

    expect(poolMocks.prepare).toHaveBeenCalledTimes(clothElements.length)
    expect(poolMocks.mount).toHaveBeenCalledTimes(clothElements.length)
    clothElements.forEach((el) => {
      expect(el.style.opacity).toBe('0')
    })

    expect(collisionMocks.setViewportDimensions).toHaveBeenCalledWith(1200, 900)

    webgl.dispose()
  })

  it('refreshes meshes and collision bounds on scroll/resize', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    const initialSetCalls = collisionMocks.setViewportDimensions.mock.calls.length
    window.dispatchEvent(new Event('resize'))
    expect(domMocks.resize).toHaveBeenCalled()
    expect(collisionMocks.setViewportDimensions.mock.calls.length).toBe(initialSetCalls + 1)

    window.dispatchEvent(new Event('scroll'))
    expect(domMocks.updateMeshTransform).toHaveBeenCalled()

    webgl.dispose()
  })

  it('activates cloth on click and routes pointer events through scheduler', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    const button = document.getElementById('cta') as HTMLElement
    button.dispatchEvent(new MouseEvent('click'))

    expect(clothMocks.instances).toHaveLength(1)
    expect(schedulerMocks.addBody).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 400 }))
    expect(schedulerMocks.notifyPointer).toHaveBeenCalled()

    webgl.dispose()
  })

  it('returns cloth to dormant state after it falls offscreen', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    const button = document.getElementById('cta') as HTMLElement
    button.dispatchEvent(new MouseEvent('click'))

    expect(schedulerMocks.addBody).toHaveBeenCalledTimes(1)
    const adapter = schedulerMocks.addBody.mock.calls[0][0]
    const cloth = clothMocks.instances[0]

    cloth.isOffscreen = vi.fn().mockReturnValue(true)
    adapter.update(0.016)

    expect(poolMocks.recycle).toHaveBeenCalledWith(button)
    expect(poolMocks.resetGeometry).toHaveBeenCalledWith(button)
    expect(poolMocks.mount).toHaveBeenCalledWith(button)
    expect(schedulerMocks.removeBody).toHaveBeenCalled()

    schedulerMocks.addBody.mockClear()

    button.dispatchEvent(new MouseEvent('click'))
    expect(schedulerMocks.addBody).toHaveBeenCalledTimes(1)
    expect(clothMocks.instances.length).toBe(2)

    webgl.dispose()
  })
})
