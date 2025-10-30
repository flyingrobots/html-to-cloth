import * as THREE from 'three'
import { edgeToCanonicalX, edgeToCanonicalY } from './units'
import { ClothPhysics } from './clothPhysics'

type StaticBody = {
  element: HTMLElement
  min: THREE.Vector2
  max: THREE.Vector2
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
    this.staticBodies.push({
      element,
      min: this.rectMin(rect),
      max: this.rectMax(rect),
    })
  }

  removeStaticBody(element: HTMLElement) {
    this.staticBodies = this.staticBodies.filter((body) => body.element !== element)
  }

  refresh() {
    for (const body of this.staticBodies) {
      const rect = body.element.getBoundingClientRect()
      body.min = this.rectMin(rect)
      body.max = this.rectMax(rect)
    }
  }

  apply(cloth: ClothPhysics) {
    for (const body of this.staticBodies) {
      cloth.constrainWithinAABB(body.min, body.max)
    }
  }

  clear() {
    this.staticBodies = []
  }

  /** Returns a snapshot of static body AABBs (canonical units). */
  getStaticAABBs() {
    return this.staticBodies.map((b) => ({
      min: b.min.clone(),
      max: b.max.clone(),
    }))
  }

  private rectMin(rect: DOMRect) {
    return new THREE.Vector2(
      edgeToCanonicalX(rect.left, this.viewportWidth),
      edgeToCanonicalY(rect.bottom, this.viewportHeight)
    )
  }

  private rectMax(rect: DOMRect) {
    return new THREE.Vector2(
      edgeToCanonicalX(rect.right, this.viewportWidth),
      edgeToCanonicalY(rect.top, this.viewportHeight)
    )
  }
}
