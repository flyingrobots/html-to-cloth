import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'

import { EngineWorld } from '../../world'
import { SimulationRunner } from '../../simulationRunner'
import { SimulationSystem } from '../../systems/simulationSystem'
import { SimWorld } from '../../../lib/simWorld'
import { ClothSceneController } from '../../../lib/clothSceneController'

vi.mock('../../../lib/domToWebGL', () => {
  class MockDOMToWebGL {
    public scene = new THREE.Scene()
    public camera = new THREE.OrthographicCamera()
    public renderer = { dispose: vi.fn() }
    constructor(_container: HTMLElement) {}
    getViewportPixels() { return { width: 1200, height: 900 } }
    pointerToCanonical(x: number, y: number) { return { x: x / 100, y: y / 100 } }
    attach() {}
    detach() {}
    resize() {}
    render() {}
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

describe('ClothSceneController disposal – removes render systems', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('calls EngineWorld.removeSystemInstance for camera and renderer systems on dispose', async () => {
    document.body.innerHTML = `<button id="cta" class="cloth-enabled">Go</button>`
    ;(document.getElementById('cta') as HTMLElement).getBoundingClientRect = () => ({
      left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50, x: 0, y: 0, toJSON() {}
    })

    const engine = new EngineWorld()
    const simWorld = new SimWorld()
    const simulationSystem = new SimulationSystem({ simWorld })
    const runner = new SimulationRunner({ engine })

    const removeInstanceSpy = vi.spyOn(engine as any, 'removeSystemInstance')

    const controller = new ClothSceneController({ engine, simulationRunner: runner, simWorld, simulationSystem })
    await controller.init()
    controller.dispose()

    // Expect removal-by-instance to be invoked for camera and renderer systems.
    expect(removeInstanceSpy).toHaveBeenCalled()
    expect(removeInstanceSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})

