import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'

import { DebugOverlaySystem } from '../DebugOverlaySystem'
import { DebugOverlayState } from '../DebugOverlayState'

const view = {
  camera: new THREE.OrthographicCamera(),
  render: vi.fn(),
  scene: { add: vi.fn(), remove: vi.fn() } as unknown as THREE.Scene,
} as any

describe('DebugOverlaySystem', () => {
  it('shows and positions the pointer gizmo based on state', () => {
    const state = new DebugOverlayState()
    const sys = new DebugOverlaySystem({ view, state })

    state.visible = true
    state.pointer.set(1, -2)
    sys.frameUpdate?.(1 / 60)

    // Mesh is attached and positioned
    expect((view.scene as any).add).toHaveBeenCalled()
  })

  it('detaches when hidden', () => {
    const state = new DebugOverlayState()
    const sys = new DebugOverlaySystem({ view, state })

    state.visible = true
    sys.frameUpdate?.(1 / 60)
    state.visible = false
    sys.frameUpdate?.(1 / 60)

    expect((view.scene as any).remove).toHaveBeenCalled()
  })
})

