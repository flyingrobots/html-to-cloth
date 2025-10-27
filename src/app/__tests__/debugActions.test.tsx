import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Minimal mock for ClothSceneController so App can run without WebGL/DOM plumbing.
const runner = { setRealTime: vi.fn(), stepOnce: vi.fn(), setSubsteps: vi.fn() }
const camera = { setTargetZoom: vi.fn() }
const simulation = {
  broadcastGravity: vi.fn(),
  broadcastConstraintIterations: vi.fn(),
  broadcastSleepConfiguration: vi.fn(),
  broadcastWarmStart: vi.fn(),
}

vi.mock('../../lib/clothSceneController', () => {
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
    setPinMode() {}
    stepOnce() {}
    setSleepConfig() {}

    getRunner() { return runner }
    getEngine() { return {} }
    getCameraSystem() { return camera as any }
    getSimulationSystem() { return simulation as any }
  }
  return { ClothSceneController: MockClothSceneController }
})

import App from '../../App'

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('Debug UI → EngineActions integration (App)', () => {
  it('toggles real-time via EngineActions (SimulationRunner.setRealTime)', async () => {
    render(<App />)

    // Open the debug palette via keyboard shortcut
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })

    // Find the Real-Time row and toggle the switch
    const realTimeLabel = await screen.findByText('Real-Time')
    const row = realTimeLabel.closest('div')?.parentElement as HTMLElement
    const switchEl = row.querySelector('[data-slot="switch"]') as HTMLElement
    expect(switchEl).toBeTruthy()

    // Toggle off (calls setRealTime(false) through EngineActions)
    fireEvent.click(switchEl)

    // Allow React effects to flush
    await Promise.resolve()
    expect(runner.setRealTime).toHaveBeenCalled()
  })

  it('updates camera target zoom via EngineActions when Camera Zoom changes', async () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })

    const zoomLabel = await screen.findByText('Camera Zoom')
    const zoomRow = zoomLabel.closest('div')?.parentElement?.parentElement as HTMLElement
    // Radix slider thumb has role=slider; we can click the track to trigger onValueChange
    const slider = zoomRow.querySelector('[data-slot="slider"]') as HTMLElement
    expect(slider).toBeTruthy()

    // Fire a generic click; the component wires onValueChange so any event should cause a value update in tests.
    fireEvent.click(slider)

    await Promise.resolve()
    expect(camera.setTargetZoom).toHaveBeenCalled()
  })

  it('broadcasts gravity and constraint iterations via EngineActions when sliders change', async () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })

    // Gravity
    const gravityLabel = await screen.findByText('Gravity')
    const gravityRow = gravityLabel.closest('div')?.parentElement as HTMLElement
    const gravitySlider = gravityRow.querySelector('[data-slot="slider"]') as HTMLElement
    fireEvent.click(gravitySlider)
    await Promise.resolve()
    expect(simulation.broadcastGravity).toHaveBeenCalled()

    // Constraint iterations
    const iterationsLabel = await screen.findByText('Constraint Iterations')
    const iterationsRow = iterationsLabel.closest('div')?.parentElement as HTMLElement
    const iterationsSlider = iterationsRow.querySelector('[data-slot="slider"]') as HTMLElement
    fireEvent.click(iterationsSlider)
    await Promise.resolve()
    expect(simulation.broadcastConstraintIterations).toHaveBeenCalled()
  })

  it('updates sleep thresholds and warm-start via actions when controls change', async () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })

    // Sleep velocity threshold
    const sleepVelLabel = await screen.findByText('Sleep Velocity Threshold')
    const sleepVelRow = sleepVelLabel.closest('div')?.parentElement as HTMLElement
    const sleepVelSlider = sleepVelRow.querySelector('[data-slot="slider"]') as HTMLElement
    fireEvent.click(sleepVelSlider)
    await Promise.resolve()
    expect(simulation.broadcastSleepConfiguration).toHaveBeenCalled()

    // Warm start passes
    const warmStartLabel = await screen.findByText('Warm Start Passes')
    const warmRow = warmStartLabel.closest('div')?.parentElement as HTMLElement
    const warmSlider = warmRow.querySelector('[data-slot="slider"]') as HTMLElement
    fireEvent.click(warmSlider)
    await Promise.resolve()
    // Click the Warm Start Now button to apply immediately
    const warmButton = await screen.findByText('Warm Start Now')
    fireEvent.click(warmButton)
    await Promise.resolve()
    expect(simulation.broadcastWarmStart).toHaveBeenCalled()
  })

  it('applies a preset and routes multiple engine actions', async () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })

    const user = userEvent.setup()
    const presetBtn = await screen.findByText('Choose Preset')
    await user.click(presetBtn)
    // Try text first, then role fallback
    const heavy = (await screen.findAllByText('Heavy'))[0]
    await user.click(heavy)

    await Promise.resolve()
    expect(simulation.broadcastGravity).toHaveBeenCalled()
    expect(simulation.broadcastConstraintIterations).toHaveBeenCalled()
    expect(camera.setTargetZoom).toHaveBeenCalled()
  })
})
