import * as THREE from 'three'
import type { EngineSystem } from '../types'
import type { RenderView } from '../render/worldRendererSystem'
import type { OBB, AABB } from './sweep'

export class CcdProbeOverlaySystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly view: RenderView
  private readonly getProbe: () => OBB | null
  private readonly getObstacles: () => (OBB | AABB)[]
  private group?: THREE.Group
  private enabled = true

  constructor(options: { view: RenderView; getProbe: () => OBB | null; getObstacles: () => (OBB | AABB)[] }) {
    this.view = options.view
    this.getProbe = options.getProbe
    this.getObstacles = options.getObstacles
    this.priority = 6
    this.id = 'ccd-probe-overlay'
  }

  onAttach() {
    this.group = new THREE.Group()
    this.group.renderOrder = 1002
    this.view.scene?.add(this.group)
  }

  onDetach() {
    if (this.group && this.view.scene) this.view.scene.remove(this.group)
    this.group = undefined
  }

  frameUpdate() {
    if (!this.view.scene || !this.group) return
    this.group.visible = this.enabled
    while (this.group.children.length) this.group.remove(this.group.children[0])

    const probe = this.getProbe()
    const obs = this.getObstacles()
    for (const o of obs) this.drawBox(o, 0xffff66)
    if (probe) this.drawBox(probe, 0x66ccff)
  }

  setEnabled(v: boolean) { this.enabled = !!v }

  private drawBox(shape: OBB | AABB, color: number) {
    if (!this.group) return
    const mat = new THREE.LineBasicMaterial({ color, linewidth: 1 })
    const pts: THREE.Vector3[] = []
    if (shape.kind === 'aabb') {
      const { min, max } = shape
      pts.push(new THREE.Vector3(min.x, min.y, 0))
      pts.push(new THREE.Vector3(max.x, min.y, 0))
      pts.push(new THREE.Vector3(max.x, max.y, 0))
      pts.push(new THREE.Vector3(min.x, max.y, 0))
      pts.push(new THREE.Vector3(min.x, min.y, 0))
    } else {
      const c = shape.center, h = shape.half, a = shape.angle
      const ux = { x: Math.cos(a), y: Math.sin(a) }
      const uy = { x: -Math.sin(a), y: Math.cos(a) }
      const corners = [
        { x: -h.x, y: -h.y },
        { x: +h.x, y: -h.y },
        { x: +h.x, y: +h.y },
        { x: -h.x, y: +h.y },
      ].map((p) => ({ x: c.x + p.x * ux.x + p.y * uy.x, y: c.y + p.x * ux.y + p.y * uy.y }))
      pts.push(new THREE.Vector3(corners[0].x, corners[0].y, 0))
      pts.push(new THREE.Vector3(corners[1].x, corners[1].y, 0))
      pts.push(new THREE.Vector3(corners[2].x, corners[2].y, 0))
      pts.push(new THREE.Vector3(corners[3].x, corners[3].y, 0))
      pts.push(new THREE.Vector3(corners[0].x, corners[0].y, 0))
    }
    const geom = new THREE.BufferGeometry().setFromPoints(pts)
    const line = new THREE.Line(geom, mat)
    this.group.add(line)
  }
}

