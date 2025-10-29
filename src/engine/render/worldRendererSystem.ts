import * as THREE from 'three'

import type { EngineSystem } from '../types'
import type { CameraSystem } from '../camera/CameraSystem'

export type RenderView = {
  camera: THREE.OrthographicCamera
  render: () => void
  scene?: THREE.Scene
}

export type WorldRendererOptions = {
  view: RenderView
  camera: CameraSystem
}

/**
 * Renders the engine world by applying the CameraSystem snapshot to an
 * Orthographic camera and invoking the view's render call each frame.
 *
 * This system runs during frameUpdate and is safe to run while the engine
 * is paused; it never mutates simulation state and treats camera snapshots
 * as read-only.
 */
export class WorldRendererSystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly view: RenderView
  private readonly camera: CameraSystem

  constructor(options: WorldRendererOptions) {
    this.view = options.view
    this.camera = options.camera
    this.priority = 10
  }

  frameUpdate() {
    const snap = this.camera.getSnapshot()

    // Apply snapshot to the view camera without mutating the snapshot itself.
    this.view.camera.position.copy(snap.position)
    this.view.camera.zoom = snap.zoom
    this.view.camera.updateProjectionMatrix()

    this.view.render()
  }
}
