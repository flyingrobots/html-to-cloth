import * as THREE from 'three'
import {
  CANONICAL_HEIGHT_METERS,
  CANONICAL_WIDTH_METERS,
  fromPointerToCanonical,
  toCanonicalHeightMeters,
  toCanonicalWidthMeters,
  toCanonicalX,
  toCanonicalY,
} from './units'

const HTML2CANVAS_IFRAME_CLASS = 'html2canvas-container'
const patchedDocuments = new WeakMap()
let documentWritePatched = false
let iframeContentWindowPatched = false
/** @type {PropertyDescriptor | null} */
let originalIframeContentWindowDescriptor = null
/** @type {typeof Document.prototype.write | null} */
let originalDocumentWrite = null
/** @type {typeof Document.prototype.writeln | null} */
let originalDocumentWriteln = null

const scheduleMicrotask = (callback) => {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(callback)
    return
  }
  Promise.resolve().then(callback).catch(() => {
    // Swallow unhandled rejections from the fallback microtask scheduler.
  })
}

const shouldInterceptDocumentWrite = (target) => {
  if (!target || typeof target !== 'object') return false
  const defaultView = /** @type {Window | null | undefined} */ (target.defaultView)
  if (!defaultView) return false
  const frameElement = /** @type {Element | null | undefined} */ (defaultView.frameElement)
  if (!frameElement || frameElement.tagName !== 'IFRAME') return false
  return frameElement.classList?.contains(HTML2CANVAS_IFRAME_CLASS) ?? false
}

const replaceDocumentContents = (targetDocument, htmlText, record) => {
  if (typeof DOMParser === 'undefined') return false

  const markup = htmlText && htmlText.length > 0 ? htmlText : '<html></html>'
  const parser = new DOMParser()
  const parsed = parser.parseFromString(markup, 'text/html')
  if (!parsed) return false

  try {
    while (targetDocument.firstChild) {
      targetDocument.removeChild(targetDocument.firstChild)
    }

    if (parsed.doctype && targetDocument.implementation?.createDocumentType) {
      const docType = targetDocument.implementation.createDocumentType(
        parsed.doctype.name,
        parsed.doctype.publicId,
        parsed.doctype.systemId,
      )
      targetDocument.appendChild(docType)
    }

    const importedElement = targetDocument.importNode
      ? targetDocument.importNode(parsed.documentElement, true)
      : parsed.documentElement.cloneNode(true)
    targetDocument.appendChild(importedElement)

    if (record && !record.loadDispatched) {
      record.loadDispatched = true
      scheduleMicrotask(() => {
        const loadEvent = new Event('load')
        const view = targetDocument.defaultView
        view?.dispatchEvent(loadEvent)
        const frameElement = view?.frameElement
        if (frameElement) {
          frameElement.dispatchEvent(new Event('load'))
        }
      })
    }
  } catch (error) {
    return false
  }

  return true
}

const getInterceptRecord = (doc) => {
  let record = patchedDocuments.get(doc)
  if (!record) {
    record = { loadDispatched: false }
    patchedDocuments.set(doc, record)
  }
  return record
}

const handleDocumentWrite = (targetDocument, originalFn, args, appendNewline) => {
  if (!shouldInterceptDocumentWrite(targetDocument)) {
    return originalFn?.apply(targetDocument, args)
  }

  const htmlText = args.map((value) => (value == null ? '' : String(value))).join('') + (appendNewline ? '\n' : '')
  const record = getInterceptRecord(targetDocument)
  if (!replaceDocumentContents(targetDocument, htmlText, record)) {
    return originalFn?.apply(targetDocument, args)
  }
  return undefined
}

const patchDocumentInstance = (doc) => {
  if (!doc || doc.__html2canvasPatched) return
  const record = getInterceptRecord(doc)
  const originalWrite = typeof doc.write === 'function' ? doc.write.bind(doc) : null
  const originalWriteln = typeof doc.writeln === 'function' ? doc.writeln.bind(doc) : null

  doc.write = (...args) => handleDocumentWrite(doc, originalWrite, args, false)
  doc.writeln = (...args) => handleDocumentWrite(doc, originalWriteln, args, true)
  doc.__html2canvasPatched = true
  record.originalWrite = originalWrite
  record.originalWriteln = originalWriteln
}

const ensureHtml2CanvasInterception = () => {
  if (!documentWritePatched && typeof Document !== 'undefined') {
    originalDocumentWrite = Document.prototype.write
    originalDocumentWriteln = Document.prototype.writeln

    Document.prototype.write = function (...args) {
      return handleDocumentWrite(this, originalDocumentWrite, args, false)
    }

    Document.prototype.writeln = function (...args) {
      return handleDocumentWrite(this, originalDocumentWriteln, args, true)
    }

    documentWritePatched = true
  }

  patchDocumentInstance(document)

  if (!iframeContentWindowPatched && typeof HTMLIFrameElement !== 'undefined') {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')
    if (descriptor && descriptor.get) {
      originalIframeContentWindowDescriptor = descriptor
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          const win = descriptor.get.call(this)
          try {
            if (win?.document) {
              patchDocumentInstance(win.document)
            }
          } catch (error) {
            // ignore access errors from detached frames
          }
          return win
        },
      })
      iframeContentWindowPatched = true
    }
  }
}

/**
 * @typedef {Object} DOMMeshRecord
 * @property {import('three').Mesh} mesh
 * @property {number} baseWidthMeters
 * @property {number} baseHeightMeters
 * @property {number} widthMeters
 * @property {number} heightMeters
 * @property {import('three').Texture} texture
 * @property {Float32Array} initialPositions
 * @property {number} segments
 * @property {CanonicalLayout} layout
 * @property {ClothPhysicsMetadata} physics
 */

/**
 * @typedef {Object} CanonicalLayout
 * @property {'left'|'center'|'right'} anchorX
 * @property {'top'|'center'|'bottom'} anchorY
 * @property {boolean} scaleX
 * @property {boolean} scaleY
 * @property {number} paddingLeftPx
 * @property {number} paddingRightPx
 * @property {number} paddingTopPx
 * @property {number} paddingBottomPx
 * @property {number} centerRatioX
 * @property {number} centerRatioY
 * @property {number} widthPx
 * @property {number} heightPx
 * @property {number} referenceWidthPx
 * @property {number} referenceHeightPx
 */

/**
 * @typedef {Object} ClothPhysicsMetadata
 * @property {number | undefined} density
 * @property {number | undefined} damping
 * @property {number | undefined} constraintIterations
 * @property {number | undefined} substeps
 * @property {number | undefined} turbulence
 * @property {number | undefined} releaseDelayMs
 * @property {'top'|'bottom'|'corners'|'none'|undefined} pinMode
 */

export class DOMToWebGL {
  constructor(container) {
    this.container = container
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera()
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    this.html2canvasRef = null

    this.viewportWidth = window.innerWidth
    this.viewportHeight = window.innerHeight

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(this.viewportWidth, this.viewportHeight)
    this.renderer.domElement.style.position = 'fixed'
    this.renderer.domElement.style.top = '0'
    this.renderer.domElement.style.left = '0'
    this.renderer.domElement.style.pointerEvents = 'none'
    this.renderer.domElement.style.width = '100vw'
    this.renderer.domElement.style.height = '100vh'
    this.renderer.domElement.style.zIndex = '9999'

    this.rootGroup = new THREE.Group()
    this.scene.add(this.rootGroup)

    this.updateCamera()
    this.attach()
  }

  attach() {
    if (!this.container.contains(this.renderer.domElement)) {
      this.container.appendChild(this.renderer.domElement)
    }
  }

  detach() {
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
  }

  resize() {
    this.viewportWidth = window.innerWidth
    this.viewportHeight = window.innerHeight
    this.renderer.setSize(this.viewportWidth, this.viewportHeight)
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  async captureElement(element) {
    const html2canvas = await this.ensureHtml2Canvas()
    ensureHtml2CanvasInterception()

    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale: window.devicePixelRatio,
      logging: false,
      useCORS: true,
      skipClone: true,
    })

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    return texture
  }

  createMesh(element, texture, segments = 24) {
    const rect = element.getBoundingClientRect()
    const widthMeters = toCanonicalWidthMeters(rect.width, this.viewportWidth)
    const heightMeters = toCanonicalHeightMeters(rect.height, this.viewportHeight)
    const geometry = new THREE.PlaneGeometry(widthMeters, heightMeters, segments, segments)

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false
    mesh.position.set(...this._domPositionToWorld(rect))

    const positions = mesh.geometry.attributes.position
    const initialPositions = new Float32Array(positions.array)
    const layout = this._computeLayout(element, rect)
    const physics = this._computePhysics(element)

    return {
      mesh,
      baseWidthMeters: widthMeters,
      baseHeightMeters: heightMeters,
      widthMeters,
      heightMeters,
      texture,
      initialPositions,
      segments,
      layout,
      physics,
    }
  }

  addMesh(mesh) {
    this.rootGroup.add(mesh)
  }

  removeMesh(mesh) {
    this.rootGroup.remove(mesh)
  }

  updateMeshTransform(element, record) {
    if (record.layout) {
      this._applyLayoutTransform(record)
      return
    }

    const rect = element.getBoundingClientRect()
    record.mesh.position.set(...this._domPositionToWorld(rect))

    const widthMeters = toCanonicalWidthMeters(rect.width, this.viewportWidth)
    const heightMeters = toCanonicalHeightMeters(rect.height, this.viewportHeight)

    const scaleX = widthMeters / (record.baseWidthMeters || 1)
    const scaleY = heightMeters / (record.baseHeightMeters || 1)
    record.mesh.scale.set(scaleX, scaleY, 1)
    record.widthMeters = widthMeters
    record.heightMeters = heightMeters
  }

  disposeMesh(record) {
    record.mesh.geometry.dispose()
    record.mesh.material.dispose()
    record.texture.dispose()
  }

  getViewportPixels() {
    return {
      width: this.viewportWidth,
      height: this.viewportHeight,
    }
  }

  pointerToCanonical(clientX, clientY) {
    return fromPointerToCanonical(clientX, clientY, this.viewportWidth, this.viewportHeight)
  }

  updateCamera() {
    this.camera.left = -CANONICAL_WIDTH_METERS / 2
    this.camera.right = CANONICAL_WIDTH_METERS / 2
    this.camera.top = CANONICAL_HEIGHT_METERS / 2
    this.camera.bottom = -CANONICAL_HEIGHT_METERS / 2
    this.camera.near = -1000
    this.camera.far = 1000
    this.camera.position.set(0, 0, 500)
    this.camera.lookAt(new THREE.Vector3(0, 0, 0))
    this.camera.updateProjectionMatrix()
  }

  _domPositionToWorld(rect) {
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const x = toCanonicalX(centerX, this.viewportWidth)
    const y = toCanonicalY(centerY, this.viewportHeight)
    return [x, y, 0]
  }

  async ensureHtml2Canvas() {
    if (this.html2canvasRef) return this.html2canvasRef
    const module = await import('html2canvas')
    this.html2canvasRef = module.default
    return this.html2canvasRef
  }

  _computeLayout(element, rect) {
    const referenceWidthPx = this.viewportWidth || window.innerWidth || 1
    const referenceHeightPx = this.viewportHeight || window.innerHeight || 1
    const dataset = element.dataset ?? {}
    const parsedAnchor = this._parseAnchor(dataset.clothAnchor)
    const inferredAnchor = this._inferAnchor(rect, referenceWidthPx, referenceHeightPx)
    const anchorX = parsedAnchor?.x ?? inferredAnchor.x
    const anchorY = parsedAnchor?.y ?? inferredAnchor.y
    const scale = this._parseScale(dataset.clothScale)
    const paddingOverrides = this._parsePadding(dataset.clothPadding)

    const layout = {
      anchorX,
      anchorY,
      scaleX: scale.scaleX,
      scaleY: scale.scaleY,
      paddingLeftPx: paddingOverrides.left ?? rect.left,
      paddingRightPx: paddingOverrides.right ?? Math.max(0, referenceWidthPx - rect.right),
      paddingTopPx: paddingOverrides.top ?? rect.top,
      paddingBottomPx: paddingOverrides.bottom ?? Math.max(0, referenceHeightPx - rect.bottom),
      centerRatioX: referenceWidthPx === 0 ? 0.5 : (rect.left + rect.width / 2) / referenceWidthPx,
      centerRatioY: referenceHeightPx === 0 ? 0.5 : (rect.top + rect.height / 2) / referenceHeightPx,
      widthPx: rect.width,
      heightPx: rect.height,
      referenceWidthPx,
      referenceHeightPx,
    }

    return layout
  }

  _computePhysics(element) {
    const dataset = element.dataset ?? {}
    return {
      density: this._parseDensity(dataset.clothDensity),
      damping: this._parseNumber(dataset.clothDamping, 0, 0.999, undefined),
      constraintIterations: this._parseInteger(dataset.clothIterations, 1),
      substeps: this._parseInteger(dataset.clothSubsteps, 1),
      turbulence: this._parseNumber(dataset.clothTurbulence, 0, 5, undefined),
      releaseDelayMs: this._parseReleaseDelay(dataset.clothRelease),
      pinMode: this._parsePinMode(dataset.clothPin),
    }
  }

  _parseAnchor(value) {
    if (!value) return null
    const normalized = value.trim().toLowerCase()
    const parts = normalized.split('-')
    if (parts.length === 1) {
      const single = parts[0]
      switch (single) {
        case 'center':
          return { x: 'center', y: 'center' }
        case 'top':
          return { x: 'center', y: 'top' }
        case 'bottom':
          return { x: 'center', y: 'bottom' }
        case 'left':
          return { x: 'left', y: 'center' }
        case 'right':
          return { x: 'right', y: 'center' }
        default:
          return null
      }
    }

    const [partA, partB] = parts
    const axis = { x: 'center', y: 'center' }

    const assign = (token) => {
      switch (token) {
        case 'top':
          axis.y = 'top'
          break
        case 'bottom':
          axis.y = 'bottom'
          break
        case 'left':
          axis.x = 'left'
          break
        case 'right':
          axis.x = 'right'
          break
        case 'center':
          axis.x = axis.x === 'center' ? 'center' : axis.x
          axis.y = axis.y === 'center' ? 'center' : axis.y
          break
        default:
          break
      }
    }

    assign(partA)
    assign(partB)
    return axis
  }

  _parseDensity(value) {
    if (!value) return undefined
    const lower = value.trim().toLowerCase()
    switch (lower) {
      case 'light':
        return 0.6
      case 'medium':
        return 1
      case 'heavy':
        return 1.4
      default: {
        const parsed = Number.parseFloat(lower)
        if (!Number.isFinite(parsed)) return undefined
        return Math.max(0.1, Math.min(parsed, 3))
      }
    }
  }

  _parseNumber(value, min, max, fallback = 0) {
    if (value === undefined || value === null || value === '') return fallback
    const parsed = Number.parseFloat(String(value))
    if (!Number.isFinite(parsed)) return fallback
    if (min !== undefined && parsed < min) return min
    if (max !== undefined && parsed > max) return max
    return parsed
  }

  _parseInteger(value, min) {
    if (!value) return undefined
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return undefined
    return Math.max(min, parsed)
  }

  _parsePinMode(value) {
    if (!value) return undefined
    const normalized = value.trim().toLowerCase()
    switch (normalized) {
      case 'top':
      case 'bottom':
      case 'corners':
      case 'none':
        return normalized
      default:
        return undefined
    }
  }

  _parseReleaseDelay(value) {
    if (value === undefined || value === null || String(value).trim() === '') return undefined
    const parsed = Number.parseFloat(String(value))
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined
    return parsed
  }

  _inferAnchor(rect, viewportWidth, viewportHeight) {
    const left = rect.left
    const right = Math.max(0, viewportWidth - rect.right)
    const top = rect.top
    const bottom = Math.max(0, viewportHeight - rect.bottom)

    const horizontal = this._chooseAxis(left, right, viewportWidth)
    const vertical = this._chooseAxis(top, bottom, viewportHeight, true)

    return { x: horizontal, y: vertical }
  }

  _chooseAxis(minPad, maxPad, total, isVertical = false) {
    const threshold = Math.max(12, total * 0.05)
    const diff = Math.abs(minPad - maxPad)
    if (diff < threshold) {
      return 'center'
    }
    if (minPad < maxPad) {
      return isVertical ? 'top' : 'left'
    }
    return isVertical ? 'bottom' : 'right'
  }

  _parseScale(value) {
    if (!value) {
      return { scaleX: true, scaleY: true }
    }
    const tokens = value
      .split(/[\s,]+/)
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean)

    if (tokens.includes('none')) {
      return { scaleX: false, scaleY: false }
    }

    const explicit = tokens.length > 0
    const scaleX = tokens.includes('width') || tokens.includes('both')
    const scaleY = tokens.includes('height') || tokens.includes('both')

    return {
      scaleX: explicit ? scaleX : true,
      scaleY: explicit ? scaleY : true,
    }
  }

  _parsePadding(value) {
    if (!value) return {}
    const result = {}
    const entries = value.split(/[, ]+/).filter(Boolean)
    for (const entry of entries) {
      const [key, raw] = entry.split(':')
      if (!key || !raw) continue
      const parsed = Number.parseFloat(raw)
      if (!Number.isFinite(parsed)) continue
      switch (key.trim().toLowerCase()) {
        case 'left':
          result.left = parsed
          break
        case 'right':
          result.right = parsed
          break
        case 'top':
          result.top = parsed
          break
        case 'bottom':
          result.bottom = parsed
          break
        default:
          break
      }
    }
    return result
  }

  _applyLayoutTransform(record) {
    const layout = record.layout
    const viewport = this.getViewportPixels()
    const widthScaleFactor =
      layout.referenceWidthPx <= 0 ? 1 : viewport.width / layout.referenceWidthPx
    const heightScaleFactor =
      layout.referenceHeightPx <= 0 ? 1 : viewport.height / layout.referenceHeightPx

    const sizeScaleX = layout.scaleX ? widthScaleFactor : 1
    const sizeScaleY = layout.scaleY ? heightScaleFactor : 1

    const targetWidthMeters = record.baseWidthMeters * sizeScaleX
    const targetHeightMeters = record.baseHeightMeters * sizeScaleY

    const padLeftMeters = toCanonicalWidthMeters(layout.paddingLeftPx * widthScaleFactor, viewport.width)
    const padRightMeters = toCanonicalWidthMeters(layout.paddingRightPx * widthScaleFactor, viewport.width)
    const padTopMeters = toCanonicalHeightMeters(layout.paddingTopPx * heightScaleFactor, viewport.height)
    const padBottomMeters = toCanonicalHeightMeters(layout.paddingBottomPx * heightScaleFactor, viewport.height)

    let positionX = 0
    switch (layout.anchorX) {
      case 'left':
        positionX = -CANONICAL_WIDTH_METERS / 2 + padLeftMeters + targetWidthMeters / 2
        break
      case 'right':
        positionX = CANONICAL_WIDTH_METERS / 2 - padRightMeters - targetWidthMeters / 2
        break
      case 'center':
      default:
        positionX = (layout.centerRatioX - 0.5) * CANONICAL_WIDTH_METERS
        break
    }

    let positionY = 0
    switch (layout.anchorY) {
      case 'top':
        positionY = CANONICAL_HEIGHT_METERS / 2 - padTopMeters - targetHeightMeters / 2
        break
      case 'bottom':
        positionY = -CANONICAL_HEIGHT_METERS / 2 + padBottomMeters + targetHeightMeters / 2
        break
      case 'center':
      default:
        positionY = (0.5 - layout.centerRatioY) * CANONICAL_HEIGHT_METERS
        break
    }

    record.mesh.position.set(positionX, positionY, 0)
    record.mesh.scale.set(
      targetWidthMeters / record.baseWidthMeters,
      targetHeightMeters / record.baseHeightMeters,
      1
    )

    record.widthMeters = targetWidthMeters
    record.heightMeters = targetHeightMeters
  }
}
