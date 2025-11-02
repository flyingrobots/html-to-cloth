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
  sceneAdd: vi.fn(),
  sceneRemove: vi.fn(),
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

const simulationRunnerMocks = {
  update: vi.fn(),
  stepOnce: vi.fn(),
  setRealTime: vi.fn(),
  setSubsteps: vi.fn(),
  setPaused: vi.fn(),
  frame: vi.fn(),
  instances: [] as any[],
}

const simulationSystemMocks = {
  addBody: vi.fn(),
  removeBody: vi.fn(),
  notifyPointer: vi.fn(),
  queueWarmStart: vi.fn(),
  queueSleepConfiguration: vi.fn(),
  clear: vi.fn(),
  getSnapshot: vi.fn(() => ({ bodies: [] })),
  instances: [] as any[],
}

const clothMocks = {
  instances: [] as any[],
  applyImpulse: vi.fn(),
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
    scene = {
      add: vi.fn((object: THREE.Object3D) => domMocks.sceneAdd(object)),
      remove: vi.fn((object: THREE.Object3D) => domMocks.sceneRemove(object)),
    } as unknown as THREE.Scene

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

    prepare = vi.fn(async (element: HTMLElement, segments = 24) => {
      const existing = recordMap.get(element)
      if (existing && existing.segments === segments) {
        return
      }
      poolMocks.prepare(element, segments)
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
        segments,
      })
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
    getStaticAABBs = vi.fn(() => [])
  }

  return { CollisionSystem: MockCollisionSystem }
})

vi.mock('../../engine/simulationRunner', () => {
  class MockSimulationRunner {
    constructor() {
      simulationRunnerMocks.instances.push(this)
    }

    update = vi.fn((dt: number) => simulationRunnerMocks.update(dt))
    stepOnce = vi.fn(() => simulationRunnerMocks.stepOnce())
    setRealTime = vi.fn((value: boolean) => simulationRunnerMocks.setRealTime(value))
    setSubsteps = vi.fn((value: number) => simulationRunnerMocks.setSubsteps(value))
    frame = vi.fn((dt: number) => simulationRunnerMocks.frame(dt))
    getEngine = vi.fn(() => ({
      setPaused: simulationRunnerMocks.setPaused,
      frame: simulationRunnerMocks.frame,
    }))
  }

  return { SimulationRunner: MockSimulationRunner }
})

vi.mock('../../engine/systems/simulationSystem', () => {
  class MockSimulationSystem {
    public id = `simulation-mock-${simulationSystemMocks.instances.length + 1}`

    constructor() {
      simulationSystemMocks.instances.push(this)
    }

    addBody = vi.fn((body: any, options?: any) => simulationSystemMocks.addBody(body, options))
    removeBody = vi.fn((id: string) => simulationSystemMocks.removeBody(id))
    notifyPointer = vi.fn((point: THREE.Vector2) => simulationSystemMocks.notifyPointer(point))
    queueWarmStart = vi.fn((id: string, config: any) => simulationSystemMocks.queueWarmStart(id, config))
    queueSleepConfiguration = vi.fn((id: string, config: any) =>
      simulationSystemMocks.queueSleepConfiguration(id, config)
    )
    clear = vi.fn(() => simulationSystemMocks.clear())
    getSnapshot = vi.fn(() => simulationSystemMocks.getSnapshot())
  }

  return { SimulationSystem: MockSimulationSystem }
})

vi.mock('../clothPhysics', () => {
  class MockClothPhysics {
    public pinTopEdge = vi.fn()
    public pinBottomEdge = vi.fn()
    public pinCorners = vi.fn()
    public addTurbulence = vi.fn()
    public releaseAllPins = vi.fn()
    public update = vi.fn()
    public applyPointForce = vi.fn()
    public applyImpulse = vi.fn((point: THREE.Vector2, force: THREE.Vector2, radius: number) =>
      clothMocks.applyImpulse(point, force, radius)
    )
    public isOffscreen = vi.fn(() => false)
    public wake = vi.fn()
    public wakeIfPointInside = vi.fn()
    public setGravity = vi.fn()
    public setConstraintIterations = vi.fn()
    public setSubsteps = vi.fn()
    public relaxConstraints = vi.fn()
    public setSleepThresholds = vi.fn()
    public isSleeping = vi.fn(() => false)
    public getPinnedVertexPositions = vi.fn(() => [])

    constructor(public mesh: THREE.Mesh) {
      clothMocks.instances.push(this)
    }
  }

  return { ClothPhysics: MockClothPhysics }
})

import { ClothSceneController } from '../clothSceneController'

const getSimulationRunner = () => {
  const instance = simulationRunnerMocks.instances.at(-1)
  if (!instance) {
    throw new Error('Simulation runner instance not found')
  }
  return instance as {
    update: ReturnType<typeof vi.fn>
    stepOnce: ReturnType<typeof vi.fn>
    setRealTime: ReturnType<typeof vi.fn>
    setSubsteps: ReturnType<typeof vi.fn>
    setPaused: ReturnType<typeof vi.fn>
  }
}

const getSimulationSystem = () => {
  const instance = simulationSystemMocks.instances.at(-1)
  if (!instance) {
    throw new Error('Simulation system instance not found')
  }
  return instance as {
    addBody: ReturnType<typeof vi.fn>
    removeBody: ReturnType<typeof vi.fn>
    notifyPointer: ReturnType<typeof vi.fn>
    queueWarmStart: ReturnType<typeof vi.fn>
    queueSleepConfiguration: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
    getSnapshot: ReturnType<typeof vi.fn>
  }
}

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

  simulationRunnerMocks.update.mockReset()
  simulationRunnerMocks.stepOnce.mockReset()
  simulationRunnerMocks.setRealTime.mockReset()
  simulationRunnerMocks.setSubsteps.mockReset()
  simulationRunnerMocks.setPaused.mockReset()
  simulationRunnerMocks.frame.mockReset()
  simulationRunnerMocks.instances.length = 0

  simulationSystemMocks.addBody.mockReset()
  simulationSystemMocks.removeBody.mockReset()
  simulationSystemMocks.notifyPointer.mockReset()
  simulationSystemMocks.queueWarmStart.mockReset()
  simulationSystemMocks.queueSleepConfiguration.mockReset()
  simulationSystemMocks.clear.mockReset()
  simulationSystemMocks.getSnapshot.mockReset()
  simulationSystemMocks.getSnapshot.mockImplementation(() => ({ bodies: [] }))
  simulationSystemMocks.instances.length = 0

  clothMocks.instances.length = 0
  clothMocks.applyImpulse.mockReset()
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
  vi.useFakeTimers()
  rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as any)
  cafSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  document.body.innerHTML = `
    <main class="demo">
      <h1>Tactile demo</h1>
      <button id="cta" class="cloth-enabled">Peel Back</button>
    </main>
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
})

afterEach(() => {
  rafSpy.mockRestore()
  cafSpy.mockRestore()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('ClothSceneController DOM integration', () => {
  it('captures cloth-enabled elements, hides DOM, and mounts meshes on init', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    const clothElements = Array.from(document.querySelectorAll<HTMLElement>('.cloth-enabled'))

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
    const webgl = new ClothSceneController()
    await webgl.init()

    const initialSetCalls = collisionMocks.setViewportDimensions.mock.calls.length
    window.dispatchEvent(new Event('resize'))
    expect(domMocks.resize).toHaveBeenCalled()
    expect(collisionMocks.setViewportDimensions.mock.calls.length).toBe(initialSetCalls + 1)

    window.dispatchEvent(new Event('scroll'))
    expect(domMocks.updateMeshTransform).toHaveBeenCalled()

    webgl.dispose()
  })

  it('activates cloth on click and routes pointer events through the simulation system', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    const simulation = getSimulationSystem()

    const button = document.getElementById('cta') as HTMLElement
    button.dispatchEvent(new MouseEvent('click'))

    expect(clothMocks.instances).toHaveLength(1)
    expect(simulation.addBody).toHaveBeenCalledTimes(1)
    const [, options] = simulation.addBody.mock.calls[0]
    expect(options?.warmStart).toBeDefined()
    expect(options?.sleep).toMatchObject({ frameThreshold: expect.any(Number) })

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 400 }))
    expect(simulation.notifyPointer).toHaveBeenCalled()

    webgl.dispose()
  })

  it('applies default impulse radius based on mesh width', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    const simulation = getSimulationSystem()

    const button = document.getElementById('cta') as HTMLElement
    button.dispatchEvent(new MouseEvent('click'))

    const adapter = simulation.addBody.mock.calls[0][0]
    const cloth = clothMocks.instances[0]
    const pointer = (webgl as any).pointer as any

    pointer.previous.set(0, 0)
    pointer.position.set(0.2, 0.1)
    pointer.velocity.set(0.2, 0.1)
    pointer.needsImpulse = true

    cloth.applyImpulse.mockReset()
    const initialVelocity = pointer.velocity.clone()
    adapter.update(0.016)

    expect(cloth.applyImpulse).toHaveBeenCalledTimes(1)
    const [, force, radius] = cloth.applyImpulse.mock.calls[0]
    // Default radius scaled to base/12 to keep impulses sane across sizes
    expect(radius).toBeCloseTo(0.08333333333333333)
    expect(force.x).toBeCloseTo(initialVelocity.x)
    expect(force.y).toBeCloseTo(initialVelocity.y)

    webgl.dispose()
  })

  it('honors per-element impulse tuning via data attributes', async () => {
    const button = document.getElementById('cta') as HTMLElement
    button.dataset.clothImpulseRadius = '0.9'
    button.dataset.clothImpulseStrength = '1.5'

    const webgl = new ClothSceneController()
    await webgl.init()

    const simulation = getSimulationSystem()

    button.dispatchEvent(new MouseEvent('click'))
    const adapter = simulation.addBody.mock.calls[0][0]
    const cloth = clothMocks.instances[0]
    const pointer = (webgl as any).pointer as any

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
    const webgl = new ClothSceneController()
    await webgl.init()

    const simulation = getSimulationSystem()

    const button = document.getElementById('cta') as HTMLElement
    button.dispatchEvent(new MouseEvent('click'))

    expect(simulation.addBody).toHaveBeenCalledTimes(1)
    const adapter = simulation.addBody.mock.calls[0][0]
    const cloth = clothMocks.instances[0]

    cloth.isOffscreen = vi.fn().mockReturnValue(true)
    adapter.update(0.016)

    expect(poolMocks.recycle).toHaveBeenCalledWith(button)
    expect(poolMocks.resetGeometry).toHaveBeenCalledWith(button)
    expect(poolMocks.mount).toHaveBeenCalledWith(button)
    expect(simulation.removeBody).toHaveBeenCalled()

    simulation.addBody.mockClear()

    button.dispatchEvent(new MouseEvent('click'))
    expect(simulation.addBody).toHaveBeenCalledTimes(1)
    expect(clothMocks.instances.length).toBe(2)

    webgl.dispose()
  })

  it('steps physics using fixed substeps when stepping manually', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    const simulation = getSimulationRunner()
    simulation.stepOnce.mockClear()

    ;(webgl as any).setSubsteps(3)
    expect(simulation.setSubsteps).toHaveBeenCalledWith(3)

    ;(webgl as any).stepOnce()
    expect(simulation.stepOnce).toHaveBeenCalledTimes(1)

    webgl.dispose()
  })

  it('resets pointer state and geometry before activating a cloth body', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 200 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 260, clientY: 220 }))

    const pointer = (webgl as any).pointer as { active: boolean; needsImpulse: boolean; velocity: THREE.Vector2 }
    expect(pointer.active).toBe(true)
    expect(pointer.needsImpulse).toBe(true)

    poolMocks.resetGeometry.mockClear()
    const button = document.getElementById('cta') as HTMLElement
    button.dispatchEvent(new MouseEvent('click'))

    expect(poolMocks.resetGeometry).toHaveBeenCalledWith(button)
    expect(pointer.active).toBe(false)
    expect(pointer.needsImpulse).toBe(false)
    expect(pointer.velocity.lengthSq()).toBe(0)

    webgl.dispose()
  })

  it('applies configured pin mode and gravity to newly activated cloth', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    ;(webgl as any).setPinMode('corners')
    ;(webgl as any).setGravity(14)

    const button = document.getElementById('cta') as HTMLElement
    button.dispatchEvent(new MouseEvent('click'))

    const cloth = clothMocks.instances.at(-1) as any
    expect(cloth.pinCorners).toHaveBeenCalled()
    expect(cloth.setGravity).toHaveBeenCalled()
    const gravityArg = cloth.setGravity.mock.calls.at(-1)?.[0] as THREE.Vector3
    expect(gravityArg.y).toBeCloseTo(-14)

    const simulation = getSimulationSystem()
    simulation.queueWarmStart.mockClear()
    ;(webgl as any).setPinMode('bottom')
    expect(simulation.queueWarmStart).toHaveBeenCalled()

    webgl.dispose()
  })

  it('clears pending release pin timers on dispose', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    const button = document.getElementById('cta') as HTMLElement
    button.dispatchEvent(new MouseEvent('click'))

    const cloth = clothMocks.instances.at(-1) as any
    expect(cloth.releaseAllPins).not.toHaveBeenCalled()

    webgl.dispose()
    vi.runAllTimers()

    expect(cloth.releaseAllPins).not.toHaveBeenCalled()
  })

  it('rebuilds meshes when tessellation segments change', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    poolMocks.prepare.mockClear()
    poolMocks.mount.mockClear()

    await (webgl as any).setTessellationSegments(12)

    const button = document.getElementById('cta') as HTMLElement
    // Auto tessellation scales with element size; ensure it stays within [6, 12]
    const calledSegments = poolMocks.prepare.mock.calls[0][1]
    expect(calledSegments).toBeGreaterThanOrEqual(6)
    expect(calledSegments).toBeLessThanOrEqual(12)
    expect(poolMocks.mount).toHaveBeenCalledWith(button)

    webgl.dispose()
  })

  it('honors tessellation auto toggle and min/max caps', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    poolMocks.prepare.mockClear()
    poolMocks.mount.mockClear()

    // Turn auto OFF → exact segments should be used for inactive meshes
    ;(webgl as any).setTessellationAutoEnabled(false)
    await (webgl as any).setTessellationSegments(15)

    const calledSegmentsFixed = poolMocks.prepare.mock.calls[0][1]
    expect(calledSegmentsFixed).toBe(15)

    // Turn auto ON with custom min/max caps
    poolMocks.prepare.mockClear()
    ;(webgl as any).setTessellationMinMax(8, 20)
    ;(webgl as any).setTessellationAutoEnabled(true)
    await (webgl as any).setTessellationSegments(18)

    const autoSeg = poolMocks.prepare.mock.calls[0][1]
    expect(autoSeg).toBeGreaterThanOrEqual(8)
    expect(autoSeg).toBeLessThanOrEqual(20)

    webgl.dispose()
  })

  it('updates constraint iterations for active cloth bodies', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    const button = document.getElementById('cta') as HTMLElement
    button.dispatchEvent(new MouseEvent('click'))

    const cloth = clothMocks.instances.at(-1) as any
    cloth.setConstraintIterations.mockClear()

    ;(webgl as any).setConstraintIterations(8)

    expect(cloth.setConstraintIterations).toHaveBeenCalledWith(8)

    webgl.dispose()
  })

  it('updates overlay pointer state on pointer move and leaves last position on pointer leave (no teleport)', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    const state = (webgl as any).getOverlayState?.()
    expect(state).toBeTruthy()
    expect(state.pointer.x).toBe(0)
    expect(state.pointer.y).toBe(0)

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 150 }))
    expect(state.pointer.x).not.toBe(0)
    expect(state.pointer.y).not.toBe(0)

    const lastX = state.pointer.x
    const lastY = state.pointer.y
    window.dispatchEvent(new Event('pointerleave'))
    // Overlay retains last known pointer to avoid a 0,0 jump
    expect(state.pointer.x).toBe(lastX)
    expect(state.pointer.y).toBe(lastY)

    webgl.dispose()
  })

  it('keeps cloth awake under world-space motion when guard is enabled', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    const button = document.getElementById('cta') as HTMLElement
    button.dispatchEvent(new MouseEvent('click'))

    const sim = getSimulationSystem()
    const adapter = sim.addBody.mock.calls[0][0]
    const cloth = clothMocks.instances.at(-1) as any
    // Inject bounding sphere method so the guard path executes
    cloth.getBoundingSphere = vi.fn(() => ({ center: new THREE.Vector2(0.1, 0.1), radius: 0.5 }))
    cloth.wake.mockClear()

    adapter.update(0.016)
    expect(cloth.wake).toHaveBeenCalled()

    webgl.dispose()
  })

  it('allows sleep path when world-space guard is disabled', async () => {
    const webgl = new ClothSceneController()
    await webgl.init()

    ;(webgl as any).setWorldSleepGuardEnabled(false)

    const button = document.getElementById('cta') as HTMLElement
    button.dispatchEvent(new MouseEvent('click'))

    const sim = getSimulationSystem()
    const adapter = sim.addBody.mock.calls[0][0]
    const cloth = clothMocks.instances.at(-1) as any
    // Inject bounding sphere method so the guard would run if enabled
    cloth.getBoundingSphere = vi.fn(() => ({ center: new THREE.Vector2(0, 0), radius: 0.5 }))
    cloth.wake.mockClear()

    adapter.update(0.016)
    // guard disabled → update should not forcibly call wake via guard
    expect(cloth.wake).not.toHaveBeenCalled()

    webgl.dispose()
  })
})
