import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Minimal mock for ClothSceneController so App can run without WebGL/DOM plumbing.
const runner = { setRealTime: vi.fn(), stepOnce: vi.fn(), setSubsteps: vi.fn() }
const cameraSnapshot = {
  position: { x: 0, y: 0, z: 0, copy() {} },
  velocity: { x: 0, y: 0, z: 0, copy() {} },
  target: { x: 0, y: 0, z: 0, copy() {} },
  zoom: 1,
  zoomVelocity: 0,
  targetZoom: 1,
}
const camera = {
  setTargetZoom: vi.fn((z: number) => {
    cameraSnapshot.targetZoom = z
    cameraSnapshot.zoom = z
    cameraSnapshot.zoomVelocity = 0
  }),
  getSnapshot: vi.fn(() => cameraSnapshot),
}
const simulation = {
  broadcastGravity: vi.fn(),
  broadcastConstraintIterations: vi.fn(),
  broadcastSleepConfiguration: vi.fn(),
  broadcastWarmStart: vi.fn(),
}

vi.mock('../../lib/clothSceneController', () => {
  const setPinMode = vi.fn()
  class MockClothSceneController {
    async init() {}
    dispose() {}
    // Legacy callbacks still present in App for non-engine actions
    setWireframe() {}
    setRealTime() {}
    setGravity() {}
    setImpulseMultiplier() {}
    setConstraintIterations() {}
    setSubsteps() {}
    setTessellationSegments() { return Promise.resolve() }
    setPointerColliderVisible() {}
    setPinMode(mode: any) { setPinMode(mode) }
    stepOnce() {}
    setSleepConfig() {}

    getRunner() { return runner }
    getEngine() { return {} }
    getCameraSystem() { return camera as any }
    getSimulationSystem() { return simulation as any }
    getOverlayState() { return { visible: false } as any }
  }
  return { ClothSceneController: MockClothSceneController, __mocks: { setPinMode } }
})

import App from '../../App'
// Access controller mocks exposed by the module factory
import { __mocks as controllerMocks } from '../../lib/clothSceneController'

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

function openDebugPalette() {
  // Use Backquote (`) / tilde key to open the debug drawer.
  // We simulate the Backquote key with code and key for robustness.
  fireEvent.keyDown(window, { key: '`', code: 'Backquote' })
}

describe('Debug UI → EngineActions integration (App)', () => {
  it('toggles real-time via EngineActions (SimulationRunner.setRealTime)', async () => {
    render(<App />)
    openDebugPalette()

    // Find the Real-Time row and toggle (Mantine Switch input role is "switch")
    const realTimeLabel = await screen.findByText('Real-Time')
    const row = realTimeLabel.closest('div')?.parentElement as HTMLElement
    const switchEl = within(row).getByRole('switch')
    // Toggle off (calls setRealTime(false) through EngineActions)
    fireEvent.click(switchEl)

    // Allow React effects to flush
    await Promise.resolve()
    expect(runner.setRealTime).toHaveBeenCalled()
  })

  it('updates camera target zoom via EngineActions when Camera Zoom changes and inspector reads snapshot', async () => {
    render(<App />)
    openDebugPalette()

    const zoomLabel = await screen.findByText('Camera Zoom')
    const zoomRow = zoomLabel.closest('div')?.parentElement as HTMLElement
    const thumb = within(zoomRow).getByRole('slider')
    // Trigger value change via keyboard to simulate user interaction in jsdom
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })

    await Promise.resolve()
    expect(camera.setTargetZoom).toHaveBeenCalled()
    // Inspector shows snapshot-derived value row
    expect(await screen.findByText('Camera Zoom (Actual)')).toBeInTheDocument()
  })

  it('broadcasts gravity and constraint iterations via EngineActions when sliders change', async () => {
    render(<App />)
    openDebugPalette()

    // Gravity
    const gravityLabel = await screen.findByText('Gravity')
    const gravityRow = gravityLabel.closest('div')?.parentElement as HTMLElement
    const gravityThumb = within(gravityRow).getByRole('slider')
    fireEvent.keyDown(gravityThumb, { key: 'ArrowRight' })
    await Promise.resolve()
    expect(simulation.broadcastGravity).toHaveBeenCalled()

    // Constraint iterations
    const iterationsLabel = await screen.findByText('Constraint Iterations')
    const iterationsRow = iterationsLabel.closest('div')?.parentElement as HTMLElement
    const iterationsThumb = within(iterationsRow).getByRole('slider')
    fireEvent.keyDown(iterationsThumb, { key: 'ArrowRight' })
    await Promise.resolve()
    expect(simulation.broadcastConstraintIterations).toHaveBeenCalled()
  })

  it('updates sleep thresholds and warm-start via actions when controls change', async () => {
    render(<App />)
    openDebugPalette()

    // Sleep velocity threshold
    const sleepVelLabel = await screen.findByText('Sleep Velocity Threshold')
    const sleepVelRow = sleepVelLabel.closest('div')?.parentElement as HTMLElement
    const sleepVelThumb = within(sleepVelRow).getByRole('slider')
    fireEvent.keyDown(sleepVelThumb, { key: 'ArrowRight' })
    await Promise.resolve()
    expect(simulation.broadcastSleepConfiguration).toHaveBeenCalled()

    // Warm start passes
    const warmStartLabel = await screen.findByText('Warm Start Passes')
    const warmRow = warmStartLabel.closest('div')?.parentElement as HTMLElement
    const warmThumb = within(warmRow).getByRole('slider')
    fireEvent.keyDown(warmThumb, { key: 'ArrowRight' })
    await Promise.resolve()
    // Click the Warm Start Now button to apply immediately
    const warmButton = await screen.findByText('Warm Start Now')
    fireEvent.click(warmButton)
    await Promise.resolve()
    expect(simulation.broadcastWarmStart).toHaveBeenCalled()
  })

  it('applies a preset and routes multiple engine actions', async () => {
    render(<App />)
    openDebugPalette()

    const user = userEvent.setup()
    const select = await screen.findByPlaceholderText('Choose preset')
    await user.click(select)
    const heavy = await screen.findByRole('option', { name: 'Heavy' })
    await user.click(heavy)

    await Promise.resolve()
    expect(simulation.broadcastConstraintIterations).toHaveBeenCalled()
    expect(camera.setTargetZoom).toHaveBeenCalled()
  })

  it('routes Pin Mode changes via EngineActions', async () => {
    render(<App />)
    openDebugPalette()

    const user = userEvent.setup()
    const pinLabel = await screen.findByText('Pin Mode')
    const pinRow = pinLabel.closest('div')?.parentElement as HTMLElement
    const trigger = within(pinRow).getByRole('button')
    await user.click(trigger)

    // Mantine Menu uses generic menu items; select by text
    const corners = await screen.findByText('Corners')
    await user.click(corners)

    await Promise.resolve()
    expect(controllerMocks.setPinMode).toHaveBeenCalledWith('corners')
  })
})
