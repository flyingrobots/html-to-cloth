import * as THREE from 'three'

import type { EngineSystem } from '../types'
import type { RenderView } from './worldRendererSystem'
import { RenderSettingsState } from './RenderSettingsState'

export type RenderSettingsOptions = {
  view: RenderView & { scene?: THREE.Scene }
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
  private lastWireframe = false

  constructor(options: RenderSettingsOptions) {
    this.view = options.view
    this.state = options.state
    this.priority = 8
  }

  frameUpdate() {
    const scene = this.view.scene as THREE.Scene | undefined
    if (!scene) return

    // Only walk when the value changes to avoid per-frame churn.
    if (this.state.wireframe === this.lastWireframe) return
    this.lastWireframe = this.state.wireframe

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      const mat = (mesh.material as THREE.Material | undefined) as THREE.MeshBasicMaterial | undefined
      if (!mat) return
      // We only toggle for cloth meshes flagged by the controller.
      if ((mesh as any).userData?.isCloth) {
        mat.wireframe = this.state.wireframe
      }
    })
  }
}

