import * as THREE from 'three'

import type { EngineSystem } from '../types'
import type { RenderView } from './worldRendererSystem'
import { RenderSettingsState } from './RenderSettingsState'

export type WireframeOverlayOptions = {
  view: RenderView
  settings: RenderSettingsState
}

/**
 * Minimal wireframe overlay pass. Creates a dedicated group that renders above
 * solids. Visibility is driven by RenderSettingsState.wireframe and the group
 * is attached/detached idempotently. Does not mutate simulation state.
 */
export class WireframeOverlaySystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly view: RenderView
  private readonly settings: RenderSettingsState
  private group?: THREE.Group

  constructor(options: WireframeOverlayOptions) {
    this.view = options.view
    this.settings = options.settings
    this.priority = 7 // above bus metrics (6) and debug overlay (5), below world renderer (10)
    this.id = 'wireframe-overlay'
  }

  onDetach() {
    if (this.group && this.view.scene) {
      this.view.scene.remove(this.group)
    }
    this.group = undefined
  }

  frameUpdate() {
    if (!this.view.scene) return
    // Lazily create the overlay group
    if (!this.group) {
      const g = new THREE.Group()
      g.name = 'wireframe-overlay'
      g.renderOrder = 1002
      g.visible = false
      this.view.scene.add(g)
      this.group = g
    }
    // Drive visibility from settings
    this.group.visible = !!this.settings.wireframe
  }
}

