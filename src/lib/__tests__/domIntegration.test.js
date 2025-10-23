import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { CANONICAL_WIDTH_METERS, CANONICAL_HEIGHT_METERS } from '../units'

const domMocks = {
  capture: vi.fn(),
  createMesh: vi.fn(),
  addMesh: vi.fn(),
  removeMesh: vi.fn(),
  disposeMesh: vi.fn(),
  updateMeshTransform: vi.fn(),
  resize: vi.fn(),
  render: vi.fn(),
  pointerToCanonical: vi.fn((x, y) => ({ x: x / 100, y: y / 100 })),
  detach: vi.fn(),
  rendererDispose: vi.fn(),
  sceneAdd: vi.fn(),
  sceneRemove: vi.fn(),
  instances: [],
}

const poolMocks = {
  prepare: vi.fn(),
  mount: vi.fn(),
  getRecord: vi.fn(),
  recycle: vi.fn(),
  resetGeometry: vi.fn(),
  destroy: vi.fn(),
  instances: [],
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
  instances: [],
  options: [],
  applyImpulse: vi.fn(),
}

const recordMap = new Map()

const getCtaButton = () => {
  const button = document.getElementById('cta')
  if (!button) {
    throw new Error('CTA button not found')
  }
  return button
}

vi.mock('../domToWebGL', () => {
  class MockDOMToWebGL {
    constructor(container) {
      this.container = container
      this.renderer = { dispose: () => domMocks.rendererDispose() }
      this.detach = () => domMocks.detach()
      this.scene = {
        add: (object) => domMocks.sceneAdd(object),
        remove: (object) => domMocks.sceneRemove(object),
      }
      this.camera = { quaternion: new THREE.Quaternion() }
      this._worldCamera = {
        orthoWidth: CANONICAL_WIDTH_METERS,
        orthoHeight: CANONICAL_HEIGHT_METERS,
        aspect: CANONICAL_WIDTH_METERS / CANONICAL_HEIGHT_METERS,
        position: new THREE.Vector3(0, 0, 500),
        target: new THREE.Vector3(0, 0, 0),
        setPosition: (x, y, z) => {
          this._worldCamera.position.set(x, y, z)
        },
        setTarget: (x, y, z) => {
          this._worldCamera.target.set(x, y, z)
        },
      }
      this.captureElement = domMocks.capture
      this.createMesh = domMocks.createMesh
      this.addMesh = domMocks.addMesh
      this.removeMesh = domMocks.removeMesh
      this.disposeMesh = domMocks.disposeMesh
      this.updateMeshTransform = domMocks.updateMeshTransform
      this.resize = (...args) => {
        this._worldCamera.aspect = CANONICAL_WIDTH_METERS / CANONICAL_HEIGHT_METERS
        domMocks.resize(...args)
      }
      this.render = domMocks.render
      this.setCameraPose = (position, target) => {
        if (position) {
          this._worldCamera.position.copy(position)
        }
        if (target) {
          this._worldCamera.target.copy(target)
        }
      }
      domMocks.instances.push(this)
    }

    pointerToCanonical(x, y) {
      return domMocks.pointerToCanonical(x, y)
    }

    getViewportPixels() {
      return { width: 1200, height: 900 }
    }

    getViewportMeters() {
      return { width: 1, height: 1 }
    }

    getWorldCamera() {
      return this._worldCamera
    }
  }

  return { DOMToWebGL: MockDOMToWebGL }
})

vi.mock('../elementPool', () => {
  class MockElementPool {
    constructor() {
      poolMocks.instances.push(this)
      this.prepare = vi.fn(async (element, segments = 24) => {
        const existing = recordMap.get(element)
        if (existing && existing.segments === segments) {
          return
        }
        poolMocks.prepare(element, segments)
        const geometry = new THREE.PlaneGeometry(1, 1, 1, 1)
        const material = new THREE.MeshBasicMaterial()
        const mesh = new THREE.Mesh(geometry, material)
        const baseArray = geometry.attributes.position.array
        const initialPositions = Float32Array.from(baseArray)
        const dataset = element.dataset ?? {}
        /** @type {Record<string, any>} */
        const physics = {}
        if (dataset.clothDensity) physics.density = Number.parseFloat(dataset.clothDensity)
        if (dataset.clothDamping) physics.damping = Number.parseFloat(dataset.clothDamping)
        if (dataset.clothIterations) physics.constraintIterations = Number.parseInt(dataset.clothIterations, 10)
        if (dataset.clothSubsteps) physics.substeps = Number.parseInt(dataset.clothSubsteps, 10)
        if (dataset.clothTurbulence) physics.turbulence = Number.parseFloat(dataset.clothTurbulence)
        if (dataset.clothRelease) physics.releaseDelayMs = Number.parseFloat(dataset.clothRelease)
        if (dataset.clothPin) physics.pinMode = dataset.clothPin
        recordMap.set(element, {
          mesh,
          baseWidthMeters: 1,
          baseHeightMeters: 1,
          widthMeters: 1,
          heightMeters: 1,
          texture: new THREE.Texture(),
          initialPositions,
          segments,
          layout: null,
          physics,
        })
      })

      this.mount = vi.fn((element) => poolMocks.mount(element))
      this.getRecord = vi.fn((element) => {
        poolMocks.getRecord(element)
        return recordMap.get(element)
      })
      this.recycle = vi.fn((element) => poolMocks.recycle(element))
      this.resetGeometry = vi.fn((element) => poolMocks.resetGeometry(element))
      this.destroy = vi.fn(() => poolMocks.destroy())
    }
  }

  return { ElementPool: MockElementPool }
})

vi.mock('../collisionSystem', () => {
  class MockCollisionSystem {
    constructor() {
      this.addStaticBody = vi.fn((element) => collisionMocks.addStaticBody(element))
      this.removeStaticBody = vi.fn((element) => collisionMocks.removeStaticBody(element))
      this.apply = vi.fn(() => collisionMocks.apply())
      this.setViewportDimensions = vi.fn((w, h) => collisionMocks.setViewportDimensions(w, h))
      this.refresh = vi.fn(() => collisionMocks.refresh())
      this.clear = vi.fn(() => collisionMocks.clear())
    }
  }

  return { CollisionSystem: MockCollisionSystem }
})

vi.mock('../simulationScheduler', () => {
  class MockSimulationScheduler {
    constructor() {
      this.addBody = vi.fn((body) => schedulerMocks.addBody(body))
      this.removeBody = vi.fn((id) => schedulerMocks.removeBody(id))
      this.notifyPointer = vi.fn((point) => schedulerMocks.notifyPointer(point))
      this.step = vi.fn((dt) => schedulerMocks.step(dt))
      this.stepCloth = vi.fn((dt) => schedulerMocks.step(dt))
      this.clear = vi.fn(() => schedulerMocks.clear())
    }
  }

  return { SimulationScheduler: MockSimulationScheduler }
})

vi.mock('../clothPhysics', () => {
  class MockClothPhysics {
    constructor(mesh, options = {}) {
      this.mesh = mesh
      this.options = options
      this.pinTopEdge = vi.fn()
      this.pinBottomEdge = vi.fn()
      this.pinCorners = vi.fn()
      this.clearPins = vi.fn()
      this.addTurbulence = vi.fn()
      this.releaseAllPins = vi.fn()
      this.update = vi.fn()
      this.applyPointForce = vi.fn()
      this.applyImpulse = vi.fn((point, force, radius) => clothMocks.applyImpulse(point, force, radius))
      this.isOffscreen = vi.fn(() => false)
      this.wake = vi.fn()
      this.wakeIfPointInside = vi.fn()
      this.setGravity = vi.fn()
      this.setConstraintIterations = vi.fn()
      this.setSubsteps = vi.fn()
      this.relaxConstraints = vi.fn()
      clothMocks.instances.push(this)
      clothMocks.options.push(options)
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
  domMocks.sceneAdd.mockReset()
  domMocks.sceneRemove.mockReset()
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
  clothMocks.options.length = 0
  clothMocks.applyImpulse.mockReset()
  recordMap.clear()
}

let rafSpy = null
let cafSpy = null

beforeAll(() => {
  if (typeof globalThis.PointerEvent === 'undefined') {
    globalThis.PointerEvent = MouseEvent
  }
})

beforeEach(() => {
  resetSpies()
  rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1)
  cafSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  document.body.innerHTML = `
    <main class="demo">
      <h1>Tactile demo</h1>
      <button id="cta" class="cloth-enabled">Peel Back</button>
    </main>
  `
  const cta = document.getElementById('cta')
  if (!cta) throw new Error('CTA not found in test setup')
  cta.getBoundingClientRect = () => ({
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
})

afterEach(() => {
  rafSpy?.mockRestore()
  cafSpy?.mockRestore()
  document.body.innerHTML = ''
})

describe('PortfolioWebGL DOM integration', () => {
  it('captures cloth-enabled elements, hides DOM, and mounts meshes on init', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    const clothElements = Array.from(document.querySelectorAll('.cloth-enabled'))

    expect(clothElements).toHaveLength(1)
    expect(poolMocks.prepare).toHaveBeenCalledTimes(1)
    expect(poolMocks.mount).toHaveBeenCalledTimes(1)
    clothElements.forEach((el) => {
      expect(el.style.opacity).toBe('0')
    })

    expect(collisionMocks.setViewportDimensions).toHaveBeenCalledWith(1200, 900)

    webgl.dispose()
  })

  it('refreshes meshes and collision bounds on scroll/resize', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    collisionMocks.setViewportDimensions.mockClear()
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

    const button = getCtaButton()
    button.dispatchEvent(new MouseEvent('click'))

    expect(clothMocks.instances).toHaveLength(1)
    expect(schedulerMocks.addBody).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 400 }))
    expect(schedulerMocks.notifyPointer).toHaveBeenCalled()

    webgl.dispose()
  })

  it('applies default impulse radius based on mesh width', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    const button = getCtaButton()
    button.dispatchEvent(new MouseEvent('click'))

    const adapter = schedulerMocks.addBody.mock.calls[0][0]
    const cloth = clothMocks.instances[0]
    const pointer = webgl.pointer

    pointer.previous.set(0, 0)
    pointer.position.set(0.2, 0.1)
    pointer.velocity.set(0.2, 0.1)
    pointer.needsImpulse = true

    cloth.applyImpulse.mockReset()
    const initialVelocity = pointer.velocity.clone()
    adapter.update(0.016)

    expect(cloth.applyImpulse).toHaveBeenCalledTimes(1)
    const [, force, radius] = cloth.applyImpulse.mock.calls[0]
    expect(radius).toBeCloseTo(1 / 12, 5)
    expect(force.x).toBeCloseTo(initialVelocity.x)
    expect(force.y).toBeCloseTo(initialVelocity.y)

    webgl.dispose()
  })

  it('applies per-element physics overrides from dataset', async () => {
    vi.useFakeTimers()
    const button = getCtaButton()
    button.dataset.clothDensity = '1.5'
    button.dataset.clothDamping = '0.92'
    button.dataset.clothIterations = '6'
    button.dataset.clothSubsteps = '2'
    button.dataset.clothTurbulence = '0.12'
    button.dataset.clothPin = 'bottom'
    button.dataset.clothRelease = '450'

    const webgl = new PortfolioWebGL()
    try {
      await webgl.init()

      const record = recordMap.get(button)
      if (record) {
        record.physics = {
          density: 1.5,
          damping: 0.92,
          constraintIterations: 6,
          substeps: 2,
          turbulence: 0.12,
          releaseDelayMs: 450,
          pinMode: 'bottom',
        }
      }

      button.dispatchEvent(new MouseEvent('click'))

      const cloth = clothMocks.instances.at(-1)
      const options = clothMocks.options.at(-1)
      expect(options.damping).toBeCloseTo(0.92)
      expect(options.constraintIterations).toBe(6)
      expect(cloth.setConstraintIterations).toHaveBeenCalledWith(6)
      expect(cloth.setSubsteps).toHaveBeenCalledWith(2)
      expect(cloth.addTurbulence).toHaveBeenCalledWith(0.12)
      const gravityArg = cloth.setGravity.mock.calls.at(-1)?.[0]
      expect(gravityArg?.y).toBeCloseTo(-3) // gravity (2) * density (1.5)
      expect(cloth.pinBottomEdge).toHaveBeenCalled()

      const releaseSpy = cloth.releaseAllPins
      vi.runAllTimers()
      expect(releaseSpy).toHaveBeenCalled()

      expect(button.dataset.clothDensity).toBe('1.5')
      expect(button.dataset.clothDamping).toBe('0.92')
      expect(button.dataset.clothIterations).toBe('6')
      expect(button.dataset.clothSubsteps).toBe('2')
      expect(button.dataset.clothTurbulence).toBe('0.12')
      expect(button.dataset.clothPin).toBe('bottom')
      expect(button.dataset.clothRelease).toBe('450')
    } finally {
      webgl.dispose()
      vi.useRealTimers()
    }
  })

  it('honors per-element impulse tuning via data attributes', async () => {
    const button = getCtaButton()
    button.dataset.clothImpulseRadius = '0.9'
    button.dataset.clothImpulseStrength = '1.5'

    const webgl = new PortfolioWebGL()
    await webgl.init()

    button.dispatchEvent(new MouseEvent('click'))
    const adapter = schedulerMocks.addBody.mock.calls[0][0]
    const cloth = clothMocks.instances[0]
    const pointer = webgl.pointer

    pointer.previous.set(0, 0)
    pointer.position.set(0.3, 0.2)
    pointer.velocity.set(0.3, 0.2)
    pointer.needsImpulse = true

    cloth.applyImpulse.mockReset()
    const datasetVelocity = pointer.velocity.clone()
    adapter.update(0.016)

    const [, force, radius] = cloth.applyImpulse.mock.calls[0]
    expect(radius).toBeCloseTo(0.9)
    expect(force.x).toBeCloseTo(datasetVelocity.x * 1.5)
    expect(force.y).toBeCloseTo(datasetVelocity.y * 1.5)

    webgl.dispose()
  })

  it('returns cloth to dormant state after it falls offscreen', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    const button = getCtaButton()
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

  it('steps physics using fixed substeps when stepping manually', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    schedulerMocks.step.mockClear()

    webgl.setSubsteps(3)
    webgl.stepOnce()

    expect(schedulerMocks.step).toHaveBeenCalledTimes(3)
    const calls = schedulerMocks.step.mock.calls.map(([dt]) => dt)
    calls.forEach((dt) => {
      expect(dt).toBeCloseTo(1 / 180, 5)
    })

    webgl.dispose()
  })

  it('resets pointer state and geometry before activating a cloth body', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 200 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 260, clientY: 220 }))

    const pointer = webgl.pointer
    expect(pointer.active).toBe(true)
    expect(pointer.needsImpulse).toBe(true)

    poolMocks.resetGeometry.mockClear()
    const button = getCtaButton()
    button.dispatchEvent(new MouseEvent('click'))

    expect(poolMocks.resetGeometry).toHaveBeenCalledWith(button)
    expect(pointer.active).toBe(false)
    expect(pointer.needsImpulse).toBe(false)
    expect(pointer.velocity.lengthSq()).toBe(0)

    webgl.dispose()
  })

  it('applies configured pin mode and gravity to newly activated cloth', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    webgl.setPinMode('corners')
    webgl.setGravity(14)

    const button = getCtaButton()
    button.dispatchEvent(new MouseEvent('click'))

    const cloth = clothMocks.instances.at(-1)
    expect(cloth.pinCorners).toHaveBeenCalled()
    expect(cloth.setGravity).toHaveBeenCalled()
    const gravityArg = cloth.setGravity.mock.calls.at(-1)?.[0]
    expect(gravityArg.y).toBeCloseTo(-14)

    webgl.dispose()
  })

  it('rebuilds meshes when tessellation segments change', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    poolMocks.prepare.mockClear()
    poolMocks.mount.mockClear()

    await webgl.setTessellationSegments(12)

    const button = getCtaButton()
    expect(poolMocks.prepare).toHaveBeenCalledWith(button, 12)
    expect(poolMocks.mount).toHaveBeenCalledWith(button)

    webgl.dispose()
  })

  it('updates constraint iterations for active cloth bodies', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    const button = getCtaButton()
    button.dispatchEvent(new MouseEvent('click'))

    const cloth = clothMocks.instances.at(-1)
    cloth.setConstraintIterations.mockClear()

    webgl.setConstraintIterations(8)

    expect(cloth.setConstraintIterations).toHaveBeenCalledWith(8)

    webgl.dispose()
  })

  it('toggles pointer collider visualization in the scene', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    domMocks.sceneAdd.mockClear()
    domMocks.sceneRemove.mockClear()

    webgl.setPointerColliderVisible(true)
    expect(domMocks.sceneAdd).toHaveBeenCalledTimes(1)

    webgl.setPointerColliderVisible(false)
    expect(domMocks.sceneRemove).toHaveBeenCalledTimes(1)

    webgl.dispose()
  })

  it('keeps cloth trigger clickable after enabling the pointer collider', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    // Simulate the debug drawer disabling pointer interaction while open.
    webgl.setPointerInteractionEnabled(false)
    webgl.setPointerColliderVisible(false)

    // Resume simulation after closing the drawer with the collider switch enabled.
    webgl.setPointerInteractionEnabled(true)
    webgl.setPointerColliderVisible(true)

    schedulerMocks.addBody.mockClear()
    const button = getCtaButton()
    button.dispatchEvent(new MouseEvent('click'))

    expect(schedulerMocks.addBody).toHaveBeenCalledTimes(1)

    webgl.dispose()
  })

  it('keeps cloth trigger clickable after toggling the pointer collider back off', async () => {
    const webgl = new PortfolioWebGL()
    await webgl.init()

    webgl.setPointerInteractionEnabled(false)
    webgl.setPointerColliderVisible(false)

    // User enables the collider, closes the drawer, then disables it again.
    webgl.setPointerInteractionEnabled(true)
    webgl.setPointerColliderVisible(true)
    webgl.setPointerColliderVisible(false)

    schedulerMocks.addBody.mockClear()
    const button = getCtaButton()
    button.dispatchEvent(new MouseEvent('click'))

    expect(schedulerMocks.addBody).toHaveBeenCalledTimes(1)

    webgl.dispose()
  })

  it('activates cloth via pointer collider pointerdown fallback', async () => {
    const originalElementFromPoint = document.elementFromPoint?.bind(document)
    const button = getCtaButton()
    document.elementFromPoint = () => button

    const webgl = new PortfolioWebGL()
    await webgl.init()

    try {
      webgl.setPointerInteractionEnabled(false)
      webgl.setPointerColliderVisible(false)

      webgl.setPointerInteractionEnabled(true)
      webgl.setPointerColliderVisible(true)

      schedulerMocks.addBody.mockClear()
      window.dispatchEvent(new MouseEvent('pointerdown', { clientX: 110, clientY: 220, button: 0 }))

      expect(schedulerMocks.addBody).toHaveBeenCalledTimes(1)
    } finally {
      webgl.dispose()
      document.elementFromPoint = originalElementFromPoint ?? (() => null)
    }
  })
})
