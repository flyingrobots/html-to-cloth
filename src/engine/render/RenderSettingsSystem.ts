import * as THREE from 'three'

import type { EngineSystem } from '../types'
import type { RenderView } from './worldRendererSystem'
import { RenderSettingsState } from './RenderSettingsState'

export type RenderSettingsOptions = {
  view: RenderView
  state: RenderSettingsState
}

/**
 * Applies render settings (e.g., wireframe) to scene content during frameUpdate.
 * Safe while paused; does not mutate simulation state.
 */
export class RenderSettingsSystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly view: RenderSettingsOptions['view']
  private readonly state: RenderSettingsState
  // Kept for future toggles; currently unused because we enforce every frame
  // to cover meshes created after the last toggle.
  // private lastWireframe = false

  constructor(options: RenderSettingsOptions) {
    this.view = options.view
    this.state = options.state
    this.priority = 8
  }

  frameUpdate() {
    const scene = this.view.scene as THREE.Scene | undefined
    if (!scene) return

    // Always enforce current state on cloth meshes. New meshes can appear after the last
    // toggle (e.g., user clicks to activate cloth or clothifies the debug panel). Applying
    // the value every frame is cheap and prevents drift.
    // this.lastWireframe = this.state.wireframe

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      const mat = (mesh.material as THREE.Material | undefined) as THREE.MeshBasicMaterial | undefined
      if (!mat) return
      const userData = (mesh as unknown as { userData?: Record<string, unknown> }).userData || {}
      const isCloth = !!userData['isCloth']
      const isStatic = !!userData['isStatic']
      if (isCloth || (isStatic && this.state.applyToStatic)) {
        mat.wireframe = this.state.wireframe
      }
    })
  }
}
