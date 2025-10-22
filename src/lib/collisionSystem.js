import * as THREE from 'three'
import { edgeToCanonicalX, edgeToCanonicalY } from './units'

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
    this._worldCorners = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]
    this._localCorners = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]
    this._localMin = new THREE.Vector2()
    this._localMax = new THREE.Vector2()
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
   * @param {import('./clothPhysics.js').ClothPhysics} cloth
   */
  apply(cloth) {
    const worldBody = typeof cloth?.getWorldBody === 'function' ? cloth.getWorldBody() : null
    const useLocalTransform = !!worldBody

    for (const body of this.staticBodies) {
      if (useLocalTransform) {
        const localAabb = this._computeLocalAabb(worldBody, body.min, body.max)
        cloth.constrainWithinAABB(localAabb.min, localAabb.max)
      } else {
        cloth.constrainWithinAABB(body.min, body.max)
      }
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

  _computeLocalAabb(worldBody, worldMin, worldMax) {
    const worldCorners = this._worldCorners
    worldCorners[0].set(worldMin.x, worldMin.y, 0)
    worldCorners[1].set(worldMax.x, worldMin.y, 0)
    worldCorners[2].set(worldMin.x, worldMax.y, 0)
    worldCorners[3].set(worldMax.x, worldMax.y, 0)

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    for (let i = 0; i < worldCorners.length; i++) {
      const localCorner = worldBody.worldToLocalPoint(worldCorners[i], this._localCorners[i])
      if (localCorner.x < minX) minX = localCorner.x
      if (localCorner.x > maxX) maxX = localCorner.x
      if (localCorner.y < minY) minY = localCorner.y
      if (localCorner.y > maxY) maxY = localCorner.y
    }

    this._localMin.set(minX, minY)
    this._localMax.set(maxX, maxY)
    return { min: this._localMin, max: this._localMax }
  }
}
