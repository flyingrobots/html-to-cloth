import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

import { SimulationSystem } from '../systems/simulationSystem'

const createSimWorld = () => ({
  step: vi.fn(),
  notifyPointer: vi.fn(),
  clear: vi.fn(),
})

describe('SimulationSystem', () => {
  it('steps the simulation world on each fixed update', () => {
    const simWorld = createSimWorld()
    const system = new SimulationSystem({ simWorld })

    system.fixedUpdate?.(0.008)
    system.fixedUpdate?.(0.008)

    expect(simWorld.step).toHaveBeenCalledTimes(2)
    expect(simWorld.step).toHaveBeenNthCalledWith(1, 0.008)
  })

  it('routes pointer notifications to the simulation world', () => {
    const simWorld = createSimWorld()
    const system = new SimulationSystem({ simWorld })

    const point = new THREE.Vector2(1, 2)
    system.notifyPointer(point)

    expect(simWorld.notifyPointer).toHaveBeenCalledWith(point)
  })

  it('cleans up the simulation world when detached', () => {
    const simWorld = createSimWorld()
    const system = new SimulationSystem({ simWorld })

    system.onDetach?.()

    expect(simWorld.clear).toHaveBeenCalled()
  })
})
