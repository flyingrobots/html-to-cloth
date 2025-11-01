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
  private pinGroup?: THREE.Group

  constructor(options: DebugOverlayOptions) {
    this.view = options.view
    this.state = options.state
    this.priority = 5
  }

  onDetach() {
    this.dispose()
  }

  dispose() {
    // Pointer
    if (this.pointer) {
      this.pointer.geometry.dispose()
      const mat = this.pointer.material
      if (mat instanceof THREE.Material) mat.dispose()
      if (this.attached) this.view.scene?.remove(this.pointer)
      this.pointer = undefined
      this.attached = false
    }
    // Groups
    if (this.aabbGroup) {
      this.clearOverlayGroup(this.aabbGroup)
      this.view.scene?.remove(this.aabbGroup)
      this.aabbGroup = undefined
    }
    if (this.pinGroup) {
      this.clearOverlayGroup(this.pinGroup)
      this.view.scene?.remove(this.pinGroup)
      this.pinGroup = undefined
    }
    if (this.circleGroup) {
      this.clearOverlayGroup(this.circleGroup)
      this.view.scene?.remove(this.circleGroup)
      this.circleGroup = undefined
    }
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
    // Render other gizmos independently of pointer visibility
    this.drawAABBs(!!this.state.drawAABBs)
    this.drawSimCircles(!!this.state.drawSleep)
    this.drawPins(!!this.state.drawPins)
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

  private clearOverlayGroup(group: THREE.Group) {
    for (const child of [...group.children]) {
      if (child instanceof THREE.LineSegments || child instanceof THREE.LineLoop) {
        child.geometry.dispose()
        const mat = child.material
        if (mat instanceof THREE.Material) mat.dispose()
      }
      group.remove(child)
    }
  }

  private drawAABBs(visible: boolean) {
    if (!this.view.scene) return
    if (!this.aabbGroup) {
      this.aabbGroup = new THREE.Group()
      this.aabbGroup.renderOrder = 999
      this.view.scene.add(this.aabbGroup)
    }
    this.aabbGroup.visible = visible
    if (!visible) return
    // Rebuild each frame for simplicity (counts are small); dispose old resources first.
    this.clearOverlayGroup(this.aabbGroup)
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

  private drawPins(visible: boolean) {
    if (!this.view.scene) return
    if (!this.pinGroup) {
      this.pinGroup = new THREE.Group()
      this.pinGroup.renderOrder = 1001
      this.view.scene.add(this.pinGroup)
    }
    this.pinGroup.visible = visible
    if (!visible) return
    this.clearOverlayGroup(this.pinGroup)
    const size = 0.02
    const color = new THREE.Color(0x00ffff)
    for (const p of this.state.pinMarkers) {
      const geom = new THREE.BufferGeometry()
      const verts = new Float32Array([
        p.x - size, p.y, 0.12,
        p.x + size, p.y, 0.12,
        p.x, p.y - size, 0.12,
        p.x, p.y + size, 0.12,
      ])
      geom.setAttribute('position', new THREE.BufferAttribute(verts, 3))
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
      const lines = new THREE.LineSegments(geom, mat)
      this.pinGroup.add(lines)
    }
  }

  private drawSimCircles(visible: boolean) {
    if (!this.view.scene) return
    if (!this.circleGroup) {
      this.circleGroup = new THREE.Group()
      this.circleGroup.renderOrder = 1000
      this.view.scene.add(this.circleGroup)
    }
    this.circleGroup.visible = visible
    if (!visible) return
    this.clearOverlayGroup(this.circleGroup)
    const snap = this.state.simSnapshot
    if (!snap) return
    for (const body of snap.bodies) {
      const segments = 64
      const verts: number[] = []
      for (let i = 0; i < segments; i++) {
        const t = (i / segments) * Math.PI * 2
        verts.push(body.center.x + Math.cos(t) * body.radius, body.center.y + Math.sin(t) * body.radius, 0.1)
      }
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
      const mat = new THREE.LineBasicMaterial({
        color: body.sleeping ? 0x55cc55 : 0xff8844,
        transparent: true,
        opacity: 0.9,
      })
      const loop = new THREE.LineLoop(geom, mat)
      this.circleGroup.add(loop)
    }
  }
}
