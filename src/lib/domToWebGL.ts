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

export type DOMMeshRecord = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  baseWidthMeters: number
  baseHeightMeters: number
  widthMeters: number
  heightMeters: number
  texture: THREE.Texture
  initialPositions: Float32Array
  segments: number
}

export class DOMToWebGL {
  public scene: THREE.Scene
  public camera: THREE.OrthographicCamera
  public renderer: THREE.WebGLRenderer

  private container: HTMLElement
  private html2canvasRef: typeof import('html2canvas')['default'] | null = null
  private viewportWidth: number
  private viewportHeight: number

  constructor(container: HTMLElement) {
    this.container = container
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera()
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })

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

  async captureElement(element: HTMLElement) {
    const html2canvas = await this.ensureHtml2Canvas()

    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale: window.devicePixelRatio,
      logging: false,
      useCORS: true,
    })

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    return texture
  }

  createMesh(element: HTMLElement, texture: THREE.Texture, segments = 24): DOMMeshRecord {
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
    ;(mesh as any).userData.isStatic = true
    ;(mesh as any).userData.isCloth = false
    mesh.frustumCulled = false
    mesh.position.set(...this.domPositionToWorld(rect))

    const positions = mesh.geometry.attributes.position
    const initialPositions = new Float32Array(positions.array as Float32Array)

    return {
      mesh,
      baseWidthMeters: widthMeters,
      baseHeightMeters: heightMeters,
      widthMeters,
      heightMeters,
      texture,
      initialPositions,
      segments,
    }
  }

  addMesh(mesh: THREE.Object3D) {
    this.rootGroup.add(mesh)
  }

  removeMesh(mesh: THREE.Object3D) {
    this.rootGroup.remove(mesh)
  }

  updateMeshTransform(element: HTMLElement, record: DOMMeshRecord) {
    const rect = element.getBoundingClientRect()
    record.mesh.position.set(...this.domPositionToWorld(rect))

    const widthMeters = toCanonicalWidthMeters(rect.width, this.viewportWidth)
    const heightMeters = toCanonicalHeightMeters(rect.height, this.viewportHeight)

    const scaleX = widthMeters / (record.baseWidthMeters || 1)
    const scaleY = heightMeters / (record.baseHeightMeters || 1)
    record.mesh.scale.set(scaleX, scaleY, 1)
    record.widthMeters = widthMeters
    record.heightMeters = heightMeters
  }

  disposeMesh(record: DOMMeshRecord) {
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

  pointerToCanonical(clientX: number, clientY: number) {
    return fromPointerToCanonical(clientX, clientY, this.viewportWidth, this.viewportHeight)
  }

  private updateCamera() {
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

  private domPositionToWorld(rect: DOMRect): [number, number, number] {
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const x = toCanonicalX(centerX, this.viewportWidth)
    const y = toCanonicalY(centerY, this.viewportHeight)
    return [x, y, 0]
  }

  private async ensureHtml2Canvas() {
    if (this.html2canvasRef) return this.html2canvasRef
    const module = await import('html2canvas')
    this.html2canvasRef = module.default
    return this.html2canvasRef
  }
}
