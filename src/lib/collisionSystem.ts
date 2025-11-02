import * as THREE from 'three'
import { ClothPhysics } from './clothPhysics'
import { WorldBody } from './WorldBody'
import { toCanonicalWidthMeters, toCanonicalHeightMeters, toCanonicalX, toCanonicalY } from './units'

type StaticBody = {
  element: HTMLElement
  widthMeters: number
  heightMeters: number
  worldBody: WorldBody
}

export class CollisionSystem {
  private staticBodies: StaticBody[] = []
  private viewportWidth = window.innerWidth
  private viewportHeight = window.innerHeight

  setViewportDimensions(width: number, height: number) {
    this.viewportWidth = width
    this.viewportHeight = height
    this.refresh()
  }

  addStaticBody(element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    const widthMeters = toCanonicalWidthMeters(rect.width, this.viewportWidth)
    const heightMeters = toCanonicalHeightMeters(rect.height, this.viewportHeight)
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const x = toCanonicalX(centerX, this.viewportWidth)
    const y = toCanonicalY(centerY, this.viewportHeight)
    const worldBody = new WorldBody({ position: new THREE.Vector3(x, y, 0) })
    this.staticBodies.push({ element, widthMeters, heightMeters, worldBody })
  }

  removeStaticBody(element: HTMLElement) {
    this.staticBodies = this.staticBodies.filter((body) => body.element !== element)
  }

  refresh() {
    for (const body of this.staticBodies) {
      const rect = body.element.getBoundingClientRect()
      body.widthMeters = toCanonicalWidthMeters(rect.width, this.viewportWidth)
      body.heightMeters = toCanonicalHeightMeters(rect.height, this.viewportHeight)
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const x = toCanonicalX(centerX, this.viewportWidth)
      const y = toCanonicalY(centerY, this.viewportHeight)
      body.worldBody.setPositionComponents(x, y, 0)
      body.worldBody.setScaleComponents(1, 1, 1)
      body.worldBody.applyToMesh()
    }
  }

  apply(cloth: ClothPhysics) {
    for (const body of this.staticBodies) {
      const aabb = this.computeAABB(body)
      cloth.constrainWithinAABB(aabb.min, aabb.max)
    }
  }

  clear() {
    this.staticBodies = []
  }

  /** Returns a snapshot of static body AABBs (canonical units). */
  getStaticAABBs(): Array<{ min: THREE.Vector2; max: THREE.Vector2 }> {
    return this.staticBodies.map((b) => this.computeAABB(b))
  }

  private computeAABB(body: StaticBody): { min: THREE.Vector2; max: THREE.Vector2 } {
    const hw = (body.widthMeters || 0) / 2
    const hh = (body.heightMeters || 0) / 2
    const corners: THREE.Vector3[] = [
      new THREE.Vector3(-hw, -hh, 0),
      new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0),
      new THREE.Vector3(-hw, hh, 0),
    ]
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of corners) {
      const w = body.worldBody.localToWorldPoint(c)
      if (w.x < minX) minX = w.x
      if (w.y < minY) minY = w.y
      if (w.x > maxX) maxX = w.x
      if (w.y > maxY) maxY = w.y
    }
    return {
      min: new THREE.Vector2(minX, minY),
      max: new THREE.Vector2(maxX, maxY),
    }
  }
}
