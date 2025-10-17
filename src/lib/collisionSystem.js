import * as THREE from 'three'
import { edgeToCanonicalX, edgeToCanonicalY } from './units'
import { ClothPhysics } from './clothPhysics'

/**
 * @typedef {Object} StaticBody
 * @property {HTMLElement} element
 * @property {import('three').Vector2} min
 * @property {import('three').Vector2} max
 */

export class CollisionSystem {
  constructor() {
    this.staticBodies = []
    this.viewportWidth = window.innerWidth
    this.viewportHeight = window.innerHeight
  }

  setViewportDimensions(width, height) {
    this.viewportWidth = width
    this.viewportHeight = height
    this.refresh()
  }

  addStaticBody(element) {
    const rect = element.getBoundingClientRect()
    this.staticBodies.push({
      element,
      min: this._rectMin(rect),
      max: this._rectMax(rect),
    })
  }

  removeStaticBody(element) {
    this.staticBodies = this.staticBodies.filter((body) => body.element !== element)
  }

  refresh() {
    for (const body of this.staticBodies) {
      const rect = body.element.getBoundingClientRect()
      body.min = this._rectMin(rect)
      body.max = this._rectMax(rect)
    }
  }

  /**
   * @param {ClothPhysics} cloth
   */
  apply(cloth) {
    for (const body of this.staticBodies) {
      cloth.constrainWithinAABB(body.min, body.max)
    }
  }

  clear() {
    this.staticBodies = []
  }

  _rectMin(rect) {
    return new THREE.Vector2(
      edgeToCanonicalX(rect.left, this.viewportWidth),
      edgeToCanonicalY(rect.bottom, this.viewportHeight)
    )
  }

  _rectMax(rect) {
    return new THREE.Vector2(
      edgeToCanonicalX(rect.right, this.viewportWidth),
      edgeToCanonicalY(rect.top, this.viewportHeight)
    )
  }
}
