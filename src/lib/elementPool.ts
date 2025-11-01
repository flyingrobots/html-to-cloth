import type { DOMMeshRecord, DOMToWebGL } from './domToWebGL'

export class ElementPool {
  private domBridge: Pick<
    DOMToWebGL,
    'captureElement' | 'createMesh' | 'addMesh' | 'removeMesh' | 'disposeMesh' | 'updateMeshTransform'
  >
  private elements = new Map<HTMLElement, DOMMeshRecord>()
  private mounted = new Set<HTMLElement>()

  constructor(
    domBridge: Pick<
      DOMToWebGL,
      'captureElement' | 'createMesh' | 'addMesh' | 'removeMesh' | 'disposeMesh' | 'updateMeshTransform'
    >
  ) {
    this.domBridge = domBridge
  }

  async prepare(element: HTMLElement, segments = 24, options: { force?: boolean } = {}) {
    const existing = this.elements.get(element)
    if (existing && existing.segments === segments && !options.force) return

    if (existing) {
      this.destroy(element)
    }

    const texture = await this.domBridge.captureElement(element)
    const record = this.domBridge.createMesh(element, texture, segments)

    this.elements.set(element, record)
  }

  getRecord(element: HTMLElement) {
    return this.elements.get(element)
  }

  mount(element: HTMLElement) {
    const record = this.elements.get(element)
    if (!record) return
    if (this.mounted.has(element)) return

    this.domBridge.addMesh(record.mesh)
    this.domBridge.updateMeshTransform(element, record)
    this.mounted.add(element)
  }

  recycle(element: HTMLElement) {
    const record = this.elements.get(element)
    if (!record) return
    if (!this.mounted.has(element)) return

    this.domBridge.removeMesh(record.mesh)
    this.mounted.delete(element)
  }

  destroy(element: HTMLElement) {
    const record = this.elements.get(element)
    if (!record) return

    this.domBridge.removeMesh(record.mesh)
    this.domBridge.disposeMesh(record)
    this.elements.delete(element)
    this.mounted.delete(element)
  }

  has(element: HTMLElement) {
    return this.elements.has(element)
  }

  resetGeometry(element: HTMLElement) {
    const record = this.elements.get(element)
    if (!record) return

    const positions = record.mesh.geometry.attributes.position
    if (!positions) return

    const array = positions.array as Float32Array
    array.set(record.initialPositions)
    positions.needsUpdate = true
    record.mesh.geometry.computeVertexNormals()
    record.mesh.geometry.computeBoundingSphere()

    record.widthMeters = record.baseWidthMeters
    record.heightMeters = record.baseHeightMeters
    record.mesh.scale.set(1, 1, 1)
  }
}
