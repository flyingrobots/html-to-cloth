import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { WireframeOverlaySystem } from '../../render/WireframeOverlaySystem'
import { RenderSettingsState } from '../../render/RenderSettingsState'

describe('Wireframe overlay (spec)', () => {
  it('draws an overlay wireframe group above solids when enabled', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    const view = { scene, camera, render: () => {} }
    const settings = new RenderSettingsState()
    const sys = new WireframeOverlaySystem({ view, settings })

    // Initially hidden until wireframe is enabled
    sys.frameUpdate()
    const groupA = scene.children.find((c) => c.name === 'wireframe-overlay') as THREE.Group | undefined
    expect(groupA).toBeTruthy()
    expect(groupA?.visible).toBe(false)

    // Enable and expect visible on next frame
    settings.wireframe = true
    sys.frameUpdate()
    const groupB = scene.children.find((c) => c.name === 'wireframe-overlay') as THREE.Group | undefined
    expect(groupB).toBeTruthy()
    expect(groupB?.visible).toBe(true)
  })
})
