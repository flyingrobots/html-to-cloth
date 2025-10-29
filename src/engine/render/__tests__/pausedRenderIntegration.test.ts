import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'

import { EngineWorld } from '../../world'
import { SimulationRunner } from '../../simulationRunner'
import { SimulationSystem } from '../../systems/simulationSystem'
import { SimWorld } from '../../../lib/simWorld'
import { ClothSceneController } from '../../../lib/clothSceneController'

const domMocks = {
  render: vi.fn(),
  instances: [] as any[],
}

vi.mock('../../../lib/domToWebGL', () => {
  class MockDOMToWebGL {
    public scene = new THREE.Scene()
    public camera = new THREE.OrthographicCamera()
    public renderer = { dispose: vi.fn() }
    constructor(_container: HTMLElement) {
      domMocks.instances.push(this)
    }
    getViewportPixels() {
      return { width: 1200, height: 900 }
    }
    pointerToCanonical(x: number, y: number) {
      return { x: x / 100, y: y / 100 }
    }
    attach() {}
    detach() {}
    resize() {}
    render() {
      domMocks.render()
    }
  }
  return { DOMToWebGL: MockDOMToWebGL }
})

vi.mock('../../../lib/elementPool', () => {
  class MockElementPool {
    prepare = vi.fn(async (_el: HTMLElement, _segments = 24) => {})
    mount = vi.fn((_el: HTMLElement) => {})
    getRecord = vi.fn((_el: HTMLElement) => {
      const geom = new THREE.PlaneGeometry(1, 1, 1, 1)
      const mat = new THREE.MeshBasicMaterial()
      const mesh = new THREE.Mesh(geom, mat)
      const initialPositions = new Float32Array((geom.attributes.position.array as Float32Array).slice())
      return {
        mesh,
        baseWidthMeters: 1,
        baseHeightMeters: 1,
        widthMeters: 1,
        heightMeters: 1,
        texture: new THREE.Texture(),
        initialPositions,
        segments: 1,
      }
    })
    destroy = vi.fn((_el?: HTMLElement) => {})
  }
  return { ElementPool: MockElementPool }
})

describe('WorldRenderer integration – render while paused', () => {
  beforeEach(() => {
    domMocks.render.mockClear()
    domMocks.instances.length = 0
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('continues to render frames via engine.frame() when SimulationRunner real-time is disabled', async () => {
    // Block the controller's internal RAF loop so only our manual frame() calls render.
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as any)
    const cafSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
    // Seed a cloth-enabled element so controller init completes.
    document.body.innerHTML = `
      <main>
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
    // Use real engine/runner so frame(dt) executes registered systems.
    const engine = new EngineWorld()
    const simWorld = new SimWorld()
    const simulationSystem = new SimulationSystem({ simWorld })
    const runner = new SimulationRunner({ engine })

    const controller = new ClothSceneController({ engine, simulationRunner: runner, simWorld, simulationSystem })
    await controller.init()

    // Pausing disables fixed updates but our render system is allowWhilePaused=true.
    runner.setRealTime(false)
    expect(engine.isPaused()).toBe(true)
    // Clear any initial render that happened during controller.init()'s first animate call.
    domMocks.render.mockClear()

    // Drive a frame manually and verify the DOM view renders.
    engine.frame(1 / 60)
    expect(domMocks.render).toHaveBeenCalledTimes(1)

    // Drive a few more frames; render should continue to be called once per frame call.
    engine.frame(1 / 60)
    engine.frame(1 / 60)
    expect(domMocks.render).toHaveBeenCalledTimes(3)

    controller.dispose()
    rafSpy.mockRestore()
    cafSpy.mockRestore()
  })
})
