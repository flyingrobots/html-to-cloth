/**
 * @typedef {import('./domToWebGL.js').DOMMeshRecord} DOMMeshRecord
 * @typedef {object} DOMBridge
 * @property {(element: HTMLElement) => Promise<import('three').Texture>} captureElement
 * @property {(element: HTMLElement, texture: import('three').Texture, segments?: number) => DOMMeshRecord} createMesh
 * @property {(mesh: import('three').Object3D) => void} addMesh
 * @property {(mesh: import('three').Object3D) => void} removeMesh
 * @property {(record: DOMMeshRecord) => void} disposeMesh
 * @property {(element: HTMLElement, record: DOMMeshRecord) => void} updateMeshTransform
  * @property {() => { width: number, height: number }} getViewportPixels
 */

export class ElementPool {
  /**
   * @param {DOMBridge} domBridge
   */
  constructor(domBridge) {
    this.domBridge = domBridge
    this.elements = new Map()
    this.mounted = new Set()
  }

  /**
   * @param {HTMLElement} element
   * @param {number} [segments]
   */
  async prepare(element, segments = 24, options = {}) {
    const resolvedSegments = this._resolveSegments(element, segments)
    const existing = this.elements.get(element)
    const force = options.force === true
    if (!force && existing && existing.segments === resolvedSegments) return

    if (existing) {
      this.destroy(element)
    }

    const texture = await this.domBridge.captureElement(element)
    const record = this.domBridge.createMesh(element, texture, resolvedSegments)
    record.segments = resolvedSegments

    this.elements.set(element, record)
  }

  getRecord(element) {
    return this.elements.get(element)
  }

  mount(element) {
    const record = this.elements.get(element)
    if (!record) return
    if (this.mounted.has(element)) return

    this.domBridge.addMesh(record.mesh)
    this.domBridge.updateMeshTransform(element, record)
    this.mounted.add(element)
  }

  recycle(element) {
    const record = this.elements.get(element)
    if (!record) return
    if (!this.mounted.has(element)) return

    this.domBridge.removeMesh(record.mesh)
    this.mounted.delete(element)
  }

  destroy(element) {
    const record = this.elements.get(element)
    if (!record) return

    this.domBridge.removeMesh(record.mesh)
    this.domBridge.disposeMesh(record)
    this.elements.delete(element)
    this.mounted.delete(element)
  }

  has(element) {
    return this.elements.has(element)
  }

  resetGeometry(element) {
    const record = this.elements.get(element)
    if (!record) return

    const positions = record.mesh.geometry.attributes.position
    if (!positions) return

    const array = positions.array
    const source = record.initialPositions
    for (let i = 0; i < source.length; i++) {
      array[i] = source[i]
    }
    positions.needsUpdate = true
    record.mesh.geometry.computeVertexNormals()
    record.mesh.geometry.computeBoundingSphere()

    record.widthMeters = record.baseWidthMeters
    record.heightMeters = record.baseHeightMeters
    if (record.worldBody) {
      record.worldBody.resetTransform({ includePosition: false })
    } else if (record.mesh?.scale) {
      record.mesh.scale.set(1, 1, 1)
    }
  }

  _resolveSegments(element, maxSegments) {
    const attr = element.dataset?.clothSegments
    const override = attr ? Number.parseInt(attr, 10) : NaN
    if (!Number.isNaN(override) && override > 0) {
      return Math.max(1, Math.round(override))
    }

    const { scaleMin, scaleMax } = this._segmentBounds(maxSegments)
    const rect = typeof element.getBoundingClientRect === 'function'
      ? element.getBoundingClientRect()
      : { width: 0, height: 0 }

    const viewport = typeof this.domBridge.getViewportPixels === 'function'
      ? this.domBridge.getViewportPixels()
      : { width: window.innerWidth || 1, height: window.innerHeight || 1 }

    const viewportArea = Math.max(1, viewport.width * viewport.height)
    const elementArea = Math.max(0, rect.width * rect.height)
    const areaRatio = Math.min(1, elementArea / viewportArea)

    const normalized = Number.isFinite(areaRatio) ? Math.sqrt(areaRatio) : 0
    const segments = scaleMin + normalized * (scaleMax - scaleMin)
    return Math.max(scaleMin, Math.min(scaleMax, Math.round(segments)))
  }

  _segmentBounds(maxSegments) {
    const min = 6
    const max = Math.max(min, Math.round(maxSegments ?? 24))
    return { scaleMin: min, scaleMax: max }
  }
}
