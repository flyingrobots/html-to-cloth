import { describe, it, expect } from 'vitest'
import * as THREE from 'three'

import { ClothPhysics } from '../../../lib/clothPhysics'
import {
  createClothScenario,
  createRigidScenario,
  clothScenarioIds,
  rigidScenarioIds,
} from '../physicsScenarios'

// Tiny helper so tests can construct a scenario context that mirrors how
// Sandbox/engine code will use the DSL, without depending on DOM.
function makeClothContext() {
  return {
    three: THREE,
    makeClothPatch: (widthVertices = 3, heightVertices = 3) => {
      const geometry = new THREE.PlaneGeometry(
        1,
        1,
        widthVertices - 1,
        heightVertices - 1,
      )
      const material = new THREE.MeshBasicMaterial()
      const mesh = new THREE.Mesh(geometry, material)
      return new ClothPhysics(mesh)
    },
  }
}

describe('Physics Scenarios DSL', () => {
  it('exposes the expected cloth and rigid scenario ids', () => {
    expect(clothScenarioIds).toContain('cloth-c1-settling')
    expect(clothScenarioIds).toContain('cloth-c2-sleep-wake')
    expect(rigidScenarioIds).toContain('rigid-stack-rest')
    expect(rigidScenarioIds).toContain('rigid-drop-onto-static')
  })

  it('cloth-c1-settling reproduces the original jitter acceptance when run via the DSL', () => {
    const ctx = makeClothContext()
    const { cloth, step } = createClothScenario('cloth-c1-settling', ctx)

    const dt = 0.016
    const steps = 240
    const centerYHistory: number[] = []

    for (let i = 0; i < steps; i++) {
      step(dt)
      const sphere = cloth.getBoundingSphere()
      centerYHistory.push(sphere.center.y)
    }

    expect(cloth.isSleeping()).toBe(true)

    const tailWindow = 60
    const tail = centerYHistory.slice(-tailWindow)
    const minY = Math.min(...tail)
    const maxY = Math.max(...tail)
    expect(maxY - minY).toBeLessThan(1e-4)
  })

  it('cloth-c2-sleep-wake reproduces the original wake-if-point-inside acceptance via the DSL', () => {
    const ctx = makeClothContext()
    const { cloth, step } = createClothScenario('cloth-c2-sleep-wake', ctx)

    for (let i = 0; i < 160; i++) {
      step(0.016)
    }

    expect(cloth.isSleeping()).toBe(true)

    const sphere = cloth.getBoundingSphere()
    const insidePoint = new THREE.Vector2(sphere.center.x, sphere.center.y)

    cloth.wakeIfPointInside(insidePoint)

    expect(cloth.isSleeping()).toBe(false)

    const before = cloth.getVertexPositions()[0].clone()
    cloth.applyPointForce(insidePoint, new THREE.Vector2(0.5, 0), 1, 1)
    step(0.016)
    const after = cloth.getVertexPositions()[0]
    expect(after.x).not.toBeCloseTo(before.x)
  })

  it('rigid-stack-rest scenario encodes a stable two-box stack that settles with limited jitter', () => {
    const { system, topBody } = createRigidScenario('rigid-stack-rest')

    const dt = 1 / 60
    const totalSteps = 360
    const tailWindow = 60
    const topYHistory: number[] = []

    for (let i = 0; i < totalSteps; i++) {
      system.fixedUpdate(dt)
      topYHistory.push(topBody.center.y)
    }

    const tail = topYHistory.slice(-tailWindow)
    const minY = Math.min(...tail)
    const maxY = Math.max(...tail)
    expect(maxY - minY).toBeLessThan(0.08)
  })

  it('rigid-drop-onto-static scenario encodes a falling box that comes to rest on the floor with limited jitter', () => {
    const result = createRigidScenario('rigid-drop-onto-static')
    // Narrow the union for this test: this branch returns { system, body }.
    if (!('body' in result)) {
      throw new Error('Expected rigid-drop-onto-static to return a single body scenario')
    }
    const { system, body } = result

    const dt = 1 / 60
    const totalSteps = 240
    const tailWindow = 60
    const yHistory: number[] = []

    for (let i = 0; i < totalSteps; i++) {
      system.fixedUpdate(dt)
      yHistory.push(body.center.y)
    }

    // The box must have moved downward overall from its initial height.
    const initialY = yHistory[0]
    const finalY = yHistory[yHistory.length - 1]
    expect(finalY).toBeLessThan(initialY)

    const tail = yHistory.slice(-tailWindow)
    const minY = Math.min(...tail)
    const maxY = Math.max(...tail)
    // Allow some residual jitter but require the body to be effectively at rest.
    expect(maxY - minY).toBeLessThan(0.25)
  })
})
