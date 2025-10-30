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
  private aabbGroup?: THREE.Group
  private circleGroup?: THREE.Group

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
      this.view.scene?.add?.(mesh)
      this.attached = true
    } else if (!visible && this.attached) {
      this.view.scene?.remove?.(mesh)
      this.attached = false
    }
    mesh.visible = visible
    if (visible) {
      mesh.position.set(this.state.pointer.x, this.state.pointer.y, 0.2)
    }

    // Draw static AABBs
    this.drawAABBs()
    // Draw cloth centers with sleeping/awake coloring
    this.drawSimCircles()
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

  private drawAABBs() {
    if (!this.view.scene) return
    if (!this.aabbGroup) {
      this.aabbGroup = new THREE.Group()
      this.aabbGroup.renderOrder = 999
      this.view.scene.add(this.aabbGroup)
    }
    // Rebuild each frame for simplicity (counts are small); could be optimized
    while (this.aabbGroup.children.length) this.aabbGroup.remove(this.aabbGroup.children[0])
    const color = new THREE.Color(0x8888ff)
    for (const box of this.state.aabbs) {
      const geom = new THREE.BufferGeometry()
      const min = box.min, max = box.max
      const vertices = new Float32Array([
        min.x, min.y, 0,
        max.x, min.y, 0,
        max.x, min.y, 0,
        max.x, max.y, 0,
        max.x, max.y, 0,
        min.x, max.y, 0,
        min.x, max.y, 0,
        min.x, min.y, 0,
      ])
      geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })
      const lines = new THREE.LineSegments(geom, mat)
      this.aabbGroup.add(lines)
    }
  }

  private drawSimCircles() {
    if (!this.view.scene) return
    if (!this.circleGroup) {
      this.circleGroup = new THREE.Group()
      this.circleGroup.renderOrder = 1000
      this.view.scene.add(this.circleGroup)
    }
    while (this.circleGroup.children.length) this.circleGroup.remove(this.circleGroup.children[0])
    const snap = this.state.simSnapshot
    if (!snap) return
    for (const body of snap.bodies) {
      const geom = new THREE.CircleGeometry(body.radius, 48)
      const mat = new THREE.MeshBasicMaterial({
        color: body.sleeping ? 0x55cc55 : 0xff8844,
        wireframe: true,
        transparent: true,
        opacity: 0.8,
      })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.set(body.center.x, body.center.y, 0.1)
      this.circleGroup.add(mesh)
    }
  }
}
