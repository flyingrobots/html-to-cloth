import * as THREE from 'three'
import { edgeToCanonicalX, edgeToCanonicalY } from './units'
import { ClothPhysics } from './clothPhysics'

type StaticBody = {
  element: HTMLElement
  min: THREE.Vector2
  max: THREE.Vector2
  observer?: ResizeObserver
}

export class CollisionSystem {
  private staticBodies: StaticBody[] = []
  private viewportWidth = window.innerWidth
  private viewportHeight = window.innerHeight

  getStaticCount() {
    return this.staticBodies.length
  }

  setViewportDimensions(width: number, height: number) {
    this.viewportWidth = width
    this.viewportHeight = height
    this.refresh()
  }

  addStaticBody(element: HTMLElement) {
    const body: StaticBody = {
      element,
      min: new THREE.Vector2(),
      max: new THREE.Vector2(),
    }
    this.recomputeBody(body)

    if (typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(() => {
        this.recomputeBody(body)
      })
      obs.observe(element)
      body.observer = obs
    }

    this.staticBodies.push(body)
  }

  removeStaticBody(element: HTMLElement) {
    this.staticBodies = this.staticBodies.filter((body) => {
      if (body.element === element) {
        body.observer?.disconnect()
        return false
      }
      return true
    })
  }

  refresh() {
    for (const body of this.staticBodies) {
      this.recomputeBody(body)
    }
  }

  apply(cloth: ClothPhysics) {
    for (const body of this.staticBodies) {
      cloth.constrainWithinAABB(body.min, body.max)
    }
  }

  clear() {
    for (const body of this.staticBodies) body.observer?.disconnect()
    this.staticBodies = []
  }

  private recomputeBody(body: StaticBody) {
    const rect = body.element.getBoundingClientRect()
    // If layout is not ready yet (e.g., fonts loading), retry on the next frame when width/height are too small.
    if ((rect.width ?? 0) < 4 || (rect.height ?? 0) < 4) {
      requestAnimationFrame(() => this.recomputeBody(body))
      return
    }
    body.min = this.rectMin(rect)
    body.max = this.rectMax(rect)
  }

  /** Returns a snapshot of static body AABBs (canonical units). */
  getStaticAABBs(): Array<{ min: THREE.Vector2; max: THREE.Vector2 }> {
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
