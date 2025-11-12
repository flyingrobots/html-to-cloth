import * as THREE from 'three'
import type { EngineSystem } from '../types'
import type { RenderView } from '../render/worldRendererSystem'
import type { EventBus } from './bus'

/**
 * Minimal visual overlay for bus metrics: draws three tiny bars in top-left.
 * - Red: channel overwrites
 * - Yellow: tombstones
 * - Blue: sum of mailbox drops
 */
export class BusMetricsOverlaySystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly view: RenderView
  private readonly bus: EventBus
  private group?: THREE.Group
  private bars: THREE.Mesh[] = []

  constructor(opts: { view: RenderView; bus: EventBus }) {
    this.view = opts.view
    this.bus = opts.bus
    this.id = 'bus-metrics-overlay'
    this.priority = 6
  }

  onAttach() {
    if (!this.view.scene) return
    this.group = new THREE.Group()
    this.group.renderOrder = 1003
    this.view.scene.add(this.group)
    const colors = [0xff5555, 0xffee66, 0x66aaff]
    for (let i = 0; i < 3; i++) {
      const geom = new THREE.BoxGeometry(0.05, 0.05, 0.01)
      const mat = new THREE.MeshBasicMaterial({ color: colors[i] })
      const bar = new THREE.Mesh(geom, mat)
      bar.position.set(-3 + i * 0.08, 1.8, 0.0)
      this.group.add(bar)
      this.bars.push(bar)
    }
  }

  onDetach() {
    if (!this.group || !this.view.scene) return
    this.view.scene.remove(this.group)
    this.group = undefined
    this.bars = []
  }

  frameUpdate() {
    if (!this.group) return
    const m = this.bus.metrics()
    const mailboxSum = Object.values(m.drops.mailbox).reduce((a, b) => a + (b || 0), 0)
    const values = [m.drops.channel, m.drops.tombstone, mailboxSum]
    for (let i = 0; i < this.bars.length; i++) {
      const v = Math.min(1.0, Math.log10(1 + values[i]) / 2.0)
      this.bars[i].scale.setY(0.05 + v * 0.3)
    }
  }
}

