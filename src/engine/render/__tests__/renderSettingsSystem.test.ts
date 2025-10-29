import { describe, it, expect } from 'vitest'
import * as THREE from 'three'

import { RenderSettingsSystem } from '../RenderSettingsSystem'
import { RenderSettingsState } from '../RenderSettingsState'

describe('RenderSettingsSystem', () => {
  it('toggles wireframe on cloth meshes only', () => {
    const scene = new THREE.Scene()
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ wireframe: false }))
    ;(cloth as any).userData.isCloth = true
    const staticMesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ wireframe: false }))
    ;(staticMesh as any).userData.isStatic = true
    scene.add(cloth)
    scene.add(staticMesh)

    const state = new RenderSettingsState()
    const sys = new RenderSettingsSystem({ view: { camera: new THREE.OrthographicCamera(), render() {}, scene } as any, state })

    state.wireframe = true
    sys.frameUpdate?.(1 / 60)
    expect((cloth.material as THREE.MeshBasicMaterial).wireframe).toBe(true)
    expect((staticMesh.material as THREE.MeshBasicMaterial).wireframe).toBe(false)
  })
})

