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

describe('WorldRenderer integration – render while paused', () => {
  beforeEach(() => {
    domMocks.render.mockClear()
    domMocks.instances.length = 0
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('continues to render frames via engine.frame() when SimulationRunner real-time is disabled', async () => {
    // Use real engine/runner so frame(dt) executes registered systems.
    const engine = new EngineWorld()
    const simWorld = new SimWorld()
    const simulationSystem = new SimulationSystem({ simWorld })
    engine.addSystem(simulationSystem, { priority: 100 })
    const runner = new SimulationRunner({ engine })

    const controller = new ClothSceneController({ engine, simulationRunner: runner, simWorld, simulationSystem })
    await controller.init()

    // Pausing disables fixed updates but our render system is allowWhilePaused=true.
    runner.setRealTime(false)
    expect(engine.isPaused()).toBe(true)

    // Drive a frame manually and verify the DOM view renders.
    engine.frame(1 / 60)
    expect(domMocks.render).toHaveBeenCalledTimes(1)

    // Drive a few more frames; render should continue to be called once per frame call.
    engine.frame(1 / 60)
    engine.frame(1 / 60)
    expect(domMocks.render).toHaveBeenCalledTimes(3)

    controller.dispose()
  })
})

