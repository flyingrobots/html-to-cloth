import { describe, it, beforeEach, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Local mock for ClothSceneController so we can observe overlay state in the
// sandbox Drop Box test without depending on other suites' mocks.
const overlayState = {
  aabbs: [] as Array<{ min: { x: number; y: number }; max: { x: number; y: number } }>,
  rigidBodies: [] as Array<{ id: number; center: { x: number; y: number }; half: { x: number; y: number } }>,
}

vi.mock('../../lib/clothSceneController', () => {
  return {
    ClothSceneController: class MockClothSceneController {
      init() { return Promise.resolve() }
      dispose() {}
      setRealTime() {}
      setSubsteps() {}
      setGravity() {}
      setImpulseMultiplier() {}
      setConstraintIterations() {}
      setTessellationSegments() { return Promise.resolve() }
      setPinMode() {}
      setSleepConfig() {}
      stepOnce() {}
      getRunner() { return { setRealTime() {}, stepOnce() {}, setSubsteps() {} } }
      getEngine() { return { step() {}, frame() {} } }
      getCameraSystem() { return null }
      getSimulationSystem() { return null }
      getOverlayState() { return overlayState }
      getRenderSettingsState() { return null }
      getEventBus() { return null }
      getCcdSettingsState() { return null }
      setCcdEnabled() {}
      configureCcd() {}
      setCcdProbeSpeed() {}
      setCcdCollisionListener() {}
      getPhysicsSystem() {
        return {
          addRigidBody(body: any) {
            overlayState.rigidBodies.push({
              id: body.id,
              center: { x: body.center.x, y: body.center.y },
              half: { x: body.half.x, y: body.half.y },
            })
          },
          debugGetRigidBodies() {
            return overlayState.rigidBodies
          },
        }
      }
      getPhysicsRegistry() { return null }
    },
  }
})

import App from '../../App'

describe('Sandbox Drop Box integration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    overlayState.aabbs = []
    overlayState.rigidBodies = []
  })

  it('spawns a rigid body above the sandbox floor and reports it via the debug overlay state', async () => {
    // Force sandbox mode
    window.history.pushState({}, '', '/sandbox')

    // Provide a predictable overlay AABB for the floor to mirror CollisionSystem.
    overlayState.aabbs = [
      {
        min: { x: -2, y: -1.5 },
        max: { x: 2, y: -1.0 },
      },
    ]
    overlayState.rigidBodies = []

    render(<App />)

    const dropButton = await screen.findByRole('button', { name: /drop box/i })
    fireEvent.click(dropButton)

    // The sandbox click handler should have used overlayState.aabbs[0] and
    // delegated to EngineActions.addRigidBody. The debug overlay state is
    // kept in sync via the physics lane; the mock controller exposes it.

    const bodies = overlayState.rigidBodies ?? []
    expect(bodies.length).toBeGreaterThanOrEqual(1)

    const body = bodies[0]
    const floor = overlayState.aabbs[0]
    const floorCenterX = (floor.min.x + floor.max.x) * 0.5

    // Body should be horizontally aligned with the floor centre.
    expect(body.center.x).toBeCloseTo(floorCenterX, 4)

    // Vertically, the box should start above the floor; allow a small epsilon.
    expect(body.center.y).toBeGreaterThan(floor.max.y - 1e-4)
  })
})
