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

  async prepare(element: HTMLElement, segments = 24, options: { force?: boolean; reason?: string } = {}) {
    const existing = this.elements.get(element)
    if (existing && existing.segments === segments && !options.force) return

    // Capture first to avoid visible gaps, then swap the record.
    const texture = await this.domBridge.captureElement(element)
    const record = this.domBridge.createMesh(element, texture, segments)

    // If an old record exists, remove its mesh only after we have a new one.
    if (existing) {
      if (this.mounted.has(element)) {
        this.domBridge.removeMesh(existing.mesh)
        this.mounted.delete(element)
      }
      this.domBridge.disposeMesh(existing)
    }

    this.elements.set(element, record)

    // Emit a browser event for debugging / observability
    try {
      if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
        const detail = {
          elementId: element.id || null,
          widthMeters: record.widthMeters,
          heightMeters: record.heightMeters,
          baseWidthMeters: record.baseWidthMeters,
          baseHeightMeters: record.baseHeightMeters,
          segments: record.segments,
          reason: options.reason ?? 'prepare',
          time: Date.now(),
        }
        window.dispatchEvent(new CustomEvent('newDomObjectGeo', { detail }))
        const mode = (import.meta as unknown as { env?: Record<string, string> }).env?.MODE
        if (mode !== 'test') {
          // eslint-disable-next-line no-console
          console.info('[newDomObjectGeo]', detail)
        }
      }
    } catch {
      // ignore if CustomEvent/window not available
    }
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
