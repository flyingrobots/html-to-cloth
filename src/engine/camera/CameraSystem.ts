import * as THREE from 'three'

import type { EngineWorld, EngineSystem } from '../types'
import { CameraSpring, type CameraSpringOptions } from './CameraSpring'

export type CameraSnapshot = ReturnType<CameraSpring['getSnapshot']>

export class CameraSystem implements EngineSystem {
  id?: string
  priority?: number
  allowWhilePaused = true

  private readonly spring: CameraSpring
  private snapshot: CameraSnapshot
  private world: EngineWorld | null = null

  constructor(options: CameraSpringOptions = {}) {
    this.spring = new CameraSpring(options)
    this.snapshot = this.spring.getSnapshot()
  }

  onAttach(world: EngineWorld) {
    this.world = world
  }

  onDetach() {
    this.world = null
  }

  fixedUpdate(dt: number) {
    this.spring.update(dt)
    this.snapshot = this.spring.getSnapshot()
  }

  getSnapshot() {
    return this.snapshot
  }

  setTarget(position: THREE.Vector3) {
    this.spring.setTarget(position)
  }

  setTargetZoom(zoom: number) {
    this.spring.setTargetZoom(zoom)
  }

  jumpTo(position: THREE.Vector3, zoom?: number) {
    this.spring.setTarget(position)
    this.spring.setPosition(position)
    if (zoom !== undefined) {
      this.spring.setTargetZoom(zoom)
      this.spring.setZoom(zoom)
    }
    this.spring.jumpToTarget()
    this.snapshot = this.spring.getSnapshot()
  }

  configure(options: Partial<Omit<CameraSpringOptions, 'position' | 'target' | 'zoom' | 'targetZoom'>>) {
    this.spring.configure(options)
  }

  getWorld() {
    return this.world
  }
}
