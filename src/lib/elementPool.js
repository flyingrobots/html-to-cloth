/**
 * @typedef {import('./domToWebGL.js').DOMMeshRecord} DOMMeshRecord
 * @typedef {object} DOMBridge
 * @property {(element: HTMLElement) => Promise<import('three').Texture>} captureElement
 * @property {(element: HTMLElement, texture: import('three').Texture, segments?: number) => DOMMeshRecord} createMesh
 * @property {(mesh: import('three').Object3D) => void} addMesh
 * @property {(mesh: import('three').Object3D) => void} removeMesh
 * @property {(record: DOMMeshRecord) => void} disposeMesh
 * @property {(element: HTMLElement, record: DOMMeshRecord) => void} updateMeshTransform
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
  async prepare(element, segments = 24) {
    const existing = this.elements.get(element)
    if (existing && existing.segments === segments) return

    if (existing) {
      this.destroy(element)
    }

    const texture = await this.domBridge.captureElement(element)
    const record = this.domBridge.createMesh(element, texture, segments)

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
    record.mesh.scale.set(1, 1, 1)
  }
}
