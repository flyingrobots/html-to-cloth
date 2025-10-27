import * as THREE from 'three'

import type { EngineSystem } from '../types'
import type { RenderView } from './worldRendererSystem'
import { DebugOverlayState } from './DebugOverlayState'

export type DebugOverlayOptions = {
  view: RenderView
  state: DebugOverlayState
}

/**
 * Renders developer gizmos (e.g., pointer collider) from a shared overlay state.
 * Runs during frameUpdate and is safe while paused.
 */
export class DebugOverlaySystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly view: RenderView
  private readonly state: DebugOverlayState
  private pointer?: THREE.Mesh
  private attached = false

  constructor(options: DebugOverlayOptions) {
    this.view = options.view
    this.state = options.state
    this.priority = 5
  }

  frameUpdate() {
    const mesh = this.ensurePointer()
    const visible = this.state.visible
    if (visible && !this.attached) {
      this.view.camera.updateProjectionMatrix() // no-op but ensures camera exists
      ;(this.view as any).scene?.add?.(mesh)
      this.attached = true
    } else if (!visible && this.attached) {
      ;(this.view as any).scene?.remove?.(mesh)
      this.attached = false
    }
    mesh.visible = visible
    if (visible) {
      mesh.position.set(this.state.pointer.x, this.state.pointer.y, 0.2)
    }
  }

  private ensurePointer() {
    if (!this.pointer) {
      const geometry = new THREE.SphereGeometry(0.12, 16, 16)
      const material = new THREE.MeshBasicMaterial({ color: 0x66ccff, wireframe: true })
      this.pointer = new THREE.Mesh(geometry, material)
      this.pointer.visible = false
    }
    return this.pointer
  }
}

