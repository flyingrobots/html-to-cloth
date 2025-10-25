import * as THREE from 'three'
import { CameraSystem } from '../engine/camera'
import { DOMToWebGL } from './domToWebGL'
import type { DOMMeshRecord } from './domToWebGL'
import { ClothPhysics } from './clothPhysics'
import { CollisionSystem } from './collisionSystem'
import { CANONICAL_HEIGHT_METERS } from './units'
import { ElementPool } from './elementPool'
import { SimulationScheduler, type SleepableBody } from './simulationScheduler'

const FIXED_DT = 1 / 60
const MAX_ACCUMULATED_TIME = FIXED_DT * 5
const WARM_START_PASSES = 2

export type PinMode = 'top' | 'bottom' | 'corners' | 'none'

export const DEFAULT_CAMERA_STIFFNESS = 120
export const DEFAULT_CAMERA_DAMPING = 20
export const DEFAULT_CAMERA_ZOOM_STIFFNESS = 120
export const DEFAULT_CAMERA_ZOOM_DAMPING = 20

type DebugSettings = {
  realTime: boolean
  wireframe: boolean
  gravity: number
  impulseMultiplier: number
  constraintIterations: number
  substeps: number
  tessellationSegments: number
  pointerCollider: boolean
  pinMode: PinMode
  cameraStiffness: number
  cameraDamping: number
  cameraZoomStiffness: number
  cameraZoomDamping: number
}

type PointerState = {
  position: THREE.Vector2
  previous: THREE.Vector2
  velocity: THREE.Vector2
  active: boolean
  needsImpulse: boolean
}

type ClothItem = {
  element: HTMLElement
  cloth?: ClothPhysics
  originalOpacity: string
  clickHandler: (event: MouseEvent) => void
  isActive: boolean
  record?: DOMMeshRecord
  adapter?: ClothBodyAdapter
}

/**
 * Adapter layer that exposes cloth instances through the scheduler-facing {@link SleepableBody} contract.
 */
class ClothBodyAdapter implements SleepableBody {
  public readonly id: string
  private item: ClothItem
  private pointer: PointerState
  private collisionSystem: CollisionSystem
  private handleOffscreen: () => void
  private record: DOMMeshRecord
  private debug: Pick<DebugSettings, 'impulseMultiplier'>

  /**
   * @param {string} id
   * @param {ClothItem} item
   * @param {PointerState} pointer
   * @param {CollisionSystem} collisionSystem
   * @param {() => void} handleOffscreen
   * @param {DOMMeshRecord} record
   * @param {Pick<DebugSettings, 'impulseMultiplier'>} debug
   */
  constructor(
    id: string,
    item: ClothItem,
    pointer: PointerState,
    collisionSystem: CollisionSystem,
    handleOffscreen: () => void,
    record: DOMMeshRecord,
    debug: Pick<DebugSettings, 'impulseMultiplier'>
  ) {
    this.id = id
    this.item = item
    this.pointer = pointer
    this.collisionSystem = collisionSystem
    this.handleOffscreen = handleOffscreen
    this.record = record
    this.debug = debug
  }

  /**
   * Updates the wrapped cloth simulation and applies pointer forces.
   *
   * @param {number} dt
   * @returns {void}
   */
  update(dt: number) {
    const cloth = this.item.cloth
    if (!cloth) return

    if (this.pointer.needsImpulse) {
      const radius = this.getImpulseRadius()
      const strength = this.getImpulseStrength()
      const scaledForce = this.pointer.velocity.clone().multiplyScalar(strength)
      cloth.applyImpulse(this.pointer.position, scaledForce, radius)
      this.pointer.needsImpulse = false
    }

    cloth.update(dt)
    this.collisionSystem.apply(cloth)

    if (cloth.isOffscreen(-CANONICAL_HEIGHT_METERS)) {
      this.handleOffscreen()
    }
  }

  /**
   * Indicates whether the underlying cloth is sleeping.
   *
   * @returns {boolean}
   */
  isSleeping() {
    const cloth = this.item.cloth
    if (!cloth) return true
    return cloth.isSleeping()
  }

  /**
   * Forces the cloth awake.
   *
   * @returns {void}
   */
  wake() {
    this.item.cloth?.wake()
  }

  /**
   * Optionally wakes the cloth if the supplied point lies within the mesh footprint.
   *
   * @param {THREE.Vector2} point
   * @returns {void}
   */
  wakeIfPointInside(point: THREE.Vector2) {
    this.item.cloth?.wakeIfPointInside(point)
  }

  /**
   * Computes an impulse radius, either from dataset overrides or canonical defaults.
   *
   * @returns {number}
   */
  private getImpulseRadius() {
    const attr = this.item.element.dataset.clothImpulseRadius
    const parsed = attr ? Number.parseFloat(attr) : NaN
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
    const { widthMeters = 0, heightMeters = 0 } = this.record ?? {}
    const base = Math.max(widthMeters, heightMeters)
    return base > 0 ? base / 2 : 0.25
  }

  /**
   * Computes the impulse strength using dataset overrides and debug multipliers.
   *
   * @returns {number}
   */
  private getImpulseStrength() {
    const attr = this.item.element.dataset.clothImpulseStrength
    const parsed = attr ? Number.parseFloat(attr) : NaN
    const elementStrength = !Number.isNaN(parsed) && parsed > 0 ? parsed : 1
    return elementStrength * this.debug.impulseMultiplier
  }
}

/**
 * High-level controller that bridges DOM elements into the WebGL cloth simulation and camera system.
 */
export class PortfolioWebGL {
  private domToWebGL: DOMToWebGL | null = null
  private collisionSystem = new CollisionSystem()
  private items = new Map<HTMLElement, ClothItem>()
  private rafId: number | null = null
  private clock = new THREE.Clock()
  private disposed = false
  private pool: ElementPool | null = null
  private scheduler = new SimulationScheduler()
  private accumulator = 0
  private elementIds = new Map<HTMLElement, string>()
  private readonly cameraSystem = new CameraSystem({
    position: new THREE.Vector3(0, 0, 500),
    target: new THREE.Vector3(0, 0, 0),
    zoom: 1,
    stiffness: DEFAULT_CAMERA_STIFFNESS,
    damping: DEFAULT_CAMERA_DAMPING,
    zoomStiffness: DEFAULT_CAMERA_ZOOM_STIFFNESS,
    zoomDamping: DEFAULT_CAMERA_ZOOM_DAMPING,
  })
  private onResize = () => this.handleResize()
  private onScroll = () => {
    this.syncStaticMeshes()
    this.collisionSystem.refresh()
  }
  private pointer: PointerState = {
    position: new THREE.Vector2(),
    previous: new THREE.Vector2(),
    velocity: new THREE.Vector2(),
    active: false,
    needsImpulse: false,
  }
  private pointerHelper: THREE.Mesh | null = null
  private pointerHelperAttached = false
  private pointerColliderVisible = false
  private debug: DebugSettings = {
    realTime: true,
    wireframe: false,
    gravity: 9.81,
    impulseMultiplier: 1,
    constraintIterations: 4,
    substeps: 1,
    tessellationSegments: 24,
    pointerCollider: false,
    pinMode: 'top',
    cameraStiffness: DEFAULT_CAMERA_STIFFNESS,
    cameraDamping: DEFAULT_CAMERA_DAMPING,
    cameraZoomStiffness: DEFAULT_CAMERA_ZOOM_STIFFNESS,
    cameraZoomDamping: DEFAULT_CAMERA_ZOOM_DAMPING,
  }
  private onPointerMove = (event: PointerEvent) => this.handlePointerMove(event)
  private onPointerLeave = () => this.resetPointer()

  /**
   * Initializes WebGL resources, prepares meshes, and begins the simulation loop.
   *
   * @returns {Promise<void>}
   */
  async init() {
    if (this.domToWebGL) return

    this.domToWebGL = new DOMToWebGL(document.body)
    this.pool = new ElementPool(this.domToWebGL)
    const viewport = this.domToWebGL.getViewportPixels()
    this.collisionSystem.setViewportDimensions(viewport.width, viewport.height)

    const clothElements = Array.from(
      document.querySelectorAll<HTMLElement>('.cloth-enabled')
    )

    if (!clothElements.length) return

    await this.prepareElements(clothElements)

    window.addEventListener('resize', this.onResize, { passive: true })
    window.addEventListener('scroll', this.onScroll, { passive: true })
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('pointerup', this.onPointerLeave, { passive: true })
    window.addEventListener('pointerleave', this.onPointerLeave, { passive: true })
    window.addEventListener('pointercancel', this.onPointerLeave, { passive: true })

    this.clock.start()
    this.applyCameraSnapshot()
    this.animate()

    if (this.pointerColliderVisible) {
      this.setPointerColliderVisible(true)
    }
  }

  /**
   * Tears down all WebGL resources and event listeners.
   *
   * @returns {void}
   */
  dispose() {
    this.disposed = true
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
    }

    if (this.pointerHelper) {
      if (this.domToWebGL) {
        this.domToWebGL.scene.remove(this.pointerHelper)
      }
      this.pointerHelper.geometry.dispose()
      const material = this.pointerHelper.material as THREE.Material
      material.dispose()
      this.pointerHelper = null
      this.pointerHelperAttached = false
    }

    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('scroll', this.onScroll)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerLeave)
    window.removeEventListener('pointerleave', this.onPointerLeave)
    window.removeEventListener('pointercancel', this.onPointerLeave)

    for (const item of this.items.values()) {
      item.element.style.opacity = item.originalOpacity
      item.element.removeEventListener('click', item.clickHandler)
      this.pool?.destroy(item.element)
    }

    this.collisionSystem.clear()

    if (this.domToWebGL) {
      this.domToWebGL.detach()
      this.domToWebGL.renderer.dispose()
    }

    this.items.clear()
    this.domToWebGL = null
    this.pool = null
    this.scheduler.clear()
    this.elementIds.clear()
  }

  /**
   * Prepares incoming DOM elements by capturing meshes and inserting them into the pool.
   *
   * @param {HTMLElement[]} elements
   * @returns {Promise<void>}
   */
  private async prepareElements(elements: HTMLElement[]) {
    if (!this.domToWebGL || !this.pool) return

    for (const element of elements) {
      await this.pool.prepare(element, this.debug.tessellationSegments)
      this.pool.mount(element)

      const record = this.pool.getRecord(element)

      const originalOpacity = element.style.opacity
      element.style.opacity = '0'

      const clickHandler = (event: MouseEvent) => {
        event.preventDefault()
        this.activate(element)
      }

      element.addEventListener('click', clickHandler)
      this.collisionSystem.addStaticBody(element)

      this.items.set(element, {
        element,
        originalOpacity,
        clickHandler,
        isActive: false,
        record,
      })
    }
  }

  /**
   * Activates a DOM element, spawning a simulated cloth body for interaction.
   *
   * @param {HTMLElement} element
   * @returns {void}
   */
  private activate(element: HTMLElement) {
    if (!this.domToWebGL || !this.pool) return

    const item = this.items.get(element)
    if (!item || item.isActive) return

    item.isActive = true
    this.collisionSystem.removeStaticBody(element)
    this.resetPointer()

    const record = this.pool.getRecord(element)
    if (!record) return

    this.pool.resetGeometry(element)

    const cloth = new ClothPhysics(record.mesh, {
      damping: 0.97,
      constraintIterations: this.debug.constraintIterations,
    })

    cloth.setConstraintIterations(this.debug.constraintIterations)
    cloth.setSubsteps(this.debug.substeps)
    this.applyPinMode(cloth)

    const gravityVector = new THREE.Vector3(0, -this.debug.gravity, 0)
    this.runWarmStart(cloth)
    cloth.setGravity(gravityVector)

    cloth.addTurbulence(0.06)
    setTimeout(() => cloth.releaseAllPins(), 900)

    item.cloth = cloth
    item.record = record
    const material = record.mesh.material as THREE.MeshBasicMaterial | undefined
    if (material) {
      material.wireframe = this.debug.wireframe
    }
    const adapterId = this.getBodyId(element)
    const adapter = new ClothBodyAdapter(
      adapterId,
      item,
      this.pointer,
      this.collisionSystem,
      () => this.handleClothOffscreen(item),
      record,
      this.debug
    )
    this.scheduler.addBody(adapter)
    item.adapter = adapter
    element.removeEventListener('click', item.clickHandler)
  }

  /**
   * Advances timers, steps simulation components, and renders the scene each frame.
   *
   * @returns {void}
   */
  private animate() {
    if (this.disposed || !this.domToWebGL) return

    this.rafId = requestAnimationFrame(() => this.animate())
    const delta = Math.min(this.clock.getDelta(), 0.05)

    if (this.debug.realTime) {
      this.accumulator = Math.min(this.accumulator + delta, MAX_ACCUMULATED_TIME)
      while (this.accumulator >= FIXED_DT) {
        this.stepCamera(FIXED_DT)
        this.stepCloth(FIXED_DT)
        this.accumulator -= FIXED_DT
      }
    }

    this.applyCameraSnapshot()
    this.decayPointerImpulse()
    this.updatePointerHelper()
    this.domToWebGL.render()
  }

  /**
   * Responds to viewport resizes by updating render targets and collision data.
   *
   * @returns {void}
   */
  private handleResize() {
    if (!this.domToWebGL) return
    this.domToWebGL.resize()
    const viewport = this.domToWebGL.getViewportPixels()
    this.collisionSystem.setViewportDimensions(viewport.width, viewport.height)
    this.collisionSystem.refresh()
    this.syncStaticMeshes()
  }

  /**
   * Keeps pooled meshes aligned with their DOM counterparts while dormant.
   *
   * @returns {void}
   */
  private syncStaticMeshes() {
    if (!this.domToWebGL) return

    for (const item of this.items.values()) {
      if (item.isActive) continue
      const record = this.pool?.getRecord(item.element)
      if (record) {
        this.domToWebGL.updateMeshTransform(item.element, record)
      }
    }
  }

  /**
   * Translates browser pointer events into canonical simulation space and records velocity.
   *
   * @param {PointerEvent} event
   * @returns {void}
   */
  private handlePointerMove(event: PointerEvent) {
    if (!this.domToWebGL) return
    const canonical = this.domToWebGL.pointerToCanonical(event.clientX, event.clientY)
    const x = canonical.x
    const y = canonical.y

    this.pointer.previous.copy(this.pointer.position)
    this.pointer.position.set(x, y)

    if (!this.pointer.active) {
      this.pointer.active = true
      this.pointer.previous.copy(this.pointer.position)
      this.scheduler.notifyPointer(this.pointer.position)
      this.updatePointerHelper()
      return
    }

    this.pointer.velocity.copy(this.pointer.position).sub(this.pointer.previous)
    const speedSq = this.pointer.velocity.lengthSq()

    if (speedSq > 0.0001) {
      this.pointer.needsImpulse = true
    }

    this.scheduler.notifyPointer(this.pointer.position)
    this.updatePointerHelper()
  }

  /**
   * Clears pointer state when leaving interactive contexts.
   *
   * @returns {void}
   */
  private resetPointer() {
    this.pointer.active = false
    this.pointer.needsImpulse = false
    this.pointer.velocity.set(0, 0)
    this.updatePointerHelper()
  }

  /**
   * Fetches or allocates a deterministic adapter identifier for an element.
   *
   * @param {HTMLElement} element
   * @returns {string}
   */
  private getBodyId(element: HTMLElement) {
    let id = this.elementIds.get(element)
    if (!id) {
      id = `cloth-${this.elementIds.size + 1}`
      this.elementIds.set(element, id)
    }
    return id
  }

  /**
   * Recycles cloth instances once they fall beyond the viewport.
   *
   * @param {ClothItem} item
   * @returns {void}
   */
  private handleClothOffscreen(item: ClothItem) {
    if (!this.pool) return

    const element = item.element
    const adapter = item.adapter
    if (adapter) {
      this.scheduler.removeBody(adapter.id)
    }

    this.pool.recycle(element)
    this.pool.resetGeometry(element)
    this.pool.mount(element)
    element.style.opacity = '0'
    element.addEventListener('click', item.clickHandler)
    this.collisionSystem.addStaticBody(element)
    item.isActive = false
    item.cloth = undefined
    item.adapter = undefined
  }

  /**
   * Toggles wireframe rendering across all cloth meshes.
   *
   * @param {boolean} enabled
   * @returns {void}
   */
  setWireframe(enabled: boolean) {
    this.debug.wireframe = enabled
    for (const item of this.items.values()) {
      const material = item.record?.mesh.material as THREE.MeshBasicMaterial | undefined
      if (material) {
        material.wireframe = enabled
      }
    }
  }

  /**
   * Updates gravity applied to active cloth bodies.
   *
   * @param {number} gravity
   * @returns {void}
   */
  setGravity(gravity: number) {
    this.debug.gravity = gravity
    for (const item of this.items.values()) {
      item.cloth?.setGravity(new THREE.Vector3(0, -gravity, 0))
    }
  }

  /**
   * Configures the global pointer impulse multiplier.
   *
   * @param {number} multiplier
   * @returns {void}
   */
  setImpulseMultiplier(multiplier: number) {
    this.debug.impulseMultiplier = multiplier
  }

  /**
   * Enables or disables real-time simulation stepping.
   *
   * @param {boolean} enabled
   * @returns {void}
   */
  setRealTime(enabled: boolean) {
    this.debug.realTime = enabled
    if (enabled) {
      this.accumulator = 0
      this.clock.getDelta()
    }
  }

  /**
   * Adjusts the number of physics substeps executed per fixed tick.
   *
   * @param {number} substeps
   * @returns {void}
   */
  setSubsteps(substeps: number) {
    const clamped = Math.max(1, Math.round(substeps))
    this.debug.substeps = clamped
    for (const item of this.items.values()) {
      item.cloth?.setSubsteps(clamped)
    }
  }

  /**
   * Sets the number of constraint solver iterations for active cloth bodies.
   *
   * @param {number} iterations
   * @returns {void}
   */
  setConstraintIterations(iterations: number) {
    const clamped = Math.max(1, Math.round(iterations))
    this.debug.constraintIterations = clamped
    for (const item of this.items.values()) {
      item.cloth?.setConstraintIterations(clamped)
    }
  }

  /**
   * Chooses which cloth vertices start pinned in the simulation.
   *
   * @param {PinMode} mode
   * @returns {void}
   */
  setPinMode(mode: PinMode) {
    this.debug.pinMode = mode
    const gravityVector = new THREE.Vector3(0, -this.debug.gravity, 0)
    for (const item of this.items.values()) {
      const cloth = item.cloth
      if (!cloth) continue
      cloth.clearPins()
      this.applyPinMode(cloth)
      this.runWarmStart(cloth)
      cloth.setGravity(gravityVector)
    }
  }

  /**
   * Rebuilds dormant meshes with a new tessellation density.
   *
   * @param {number} segments
   * @returns {Promise<void>}
   */
  async setTessellationSegments(segments: number) {
    const pool = this.pool
    if (!pool) return
    const clamped = Math.max(1, Math.min(segments, 32))
    if (this.debug.tessellationSegments === clamped) return
    this.debug.tessellationSegments = clamped

    const tasks: Promise<void>[] = []

    for (const item of this.items.values()) {
      if (item.isActive) continue
      const element = item.element
      tasks.push(
        pool
          .prepare(element, clamped)
          .then(() => {
            pool.mount(element)
            item.record = pool.getRecord(element)
            const material = item.record?.mesh.material as THREE.MeshBasicMaterial | undefined
            if (material) {
              material.wireframe = this.debug.wireframe
            }
          })
      )
    }

    await Promise.all(tasks)
    this.collisionSystem.refresh()
  }

  /**
   * Toggles the pointer collider helper mesh.
   *
   * @param {boolean} enabled
   * @returns {void}
   */
  setPointerColliderVisible(enabled: boolean) {
    this.debug.pointerCollider = enabled
    this.pointerColliderVisible = enabled
    if (!this.domToWebGL) return

    const helper = this.ensurePointerHelper()

    if (enabled) {
      if (!this.pointerHelperAttached) {
        this.domToWebGL.scene.add(helper)
        this.pointerHelperAttached = true
      }
      helper.visible = true
      this.updatePointerHelper()
    } else {
      helper.visible = false
      if (this.pointerHelperAttached) {
        this.domToWebGL.scene.remove(helper)
        this.pointerHelperAttached = false
      }
    }
  }

  /**
   * Updates the positional spring stiffness that drives camera motion.
   *
   * @param {number} value
   * @returns {void}
   */
  setCameraStiffness(value: number) {
    const clamped = Math.max(0, value)
    this.debug.cameraStiffness = clamped
    this.cameraSystem.configure({ stiffness: clamped })
  }

  /**
   * Updates the positional spring damping coefficient for the camera.
   *
   * @param {number} value
   * @returns {void}
   */
  setCameraDamping(value: number) {
    const clamped = Math.max(0, value)
    this.debug.cameraDamping = clamped
    this.cameraSystem.configure({ damping: clamped })
  }

  /**
   * Updates the zoom spring stiffness constant.
   *
   * @param {number} value
   * @returns {void}
   */
  setCameraZoomStiffness(value: number) {
    const clamped = Math.max(0, value)
    this.debug.cameraZoomStiffness = clamped
    this.cameraSystem.configure({ zoomStiffness: clamped })
  }

  /**
   * Updates the zoom spring damping coefficient.
   *
   * @param {number} value
   * @returns {void}
   */
  setCameraZoomDamping(value: number) {
    const clamped = Math.max(0, value)
    this.debug.cameraZoomDamping = clamped
    this.cameraSystem.configure({ zoomDamping: clamped })
  }

  /**
   * Executes a single fixed simulation step when real-time playback is paused.
   *
   * @returns {void}
   */
  stepOnce() {
    this.stepCamera(FIXED_DT)
    this.stepCloth(FIXED_DT)
    this.applyCameraSnapshot()
    this.decayPointerImpulse()
    this.updatePointerHelper()
  }

  /**
   * Advances the camera system by one fixed timestep.
   *
   * @param {number} dt
   * @returns {void}
   */
  private stepCamera(dt: number) {
    this.cameraSystem.fixedUpdate(dt)
  }

  /**
   * Mirrors the current camera snapshot onto the Three.js camera.
   *
   * @returns {void}
   */
  private applyCameraSnapshot() {
    if (!this.domToWebGL) return
    const snapshot = this.cameraSystem.getSnapshot()
    const camera = this.domToWebGL.camera
    camera.position.copy(snapshot.position)
    camera.lookAt(snapshot.target)
    camera.zoom = snapshot.zoom
    camera.updateProjectionMatrix()
  }

  /**
   * Steps the scheduler-driven cloth bodies with optional substepping.
   *
   * @param {number} dt
   * @returns {void}
   */
  private stepCloth(dt: number) {
    const substeps = Math.max(1, this.debug.substeps)
    const stepSize = dt / substeps
    for (let i = 0; i < substeps; i++) {
      this.scheduler.step(stepSize)
    }
  }

  /**
   * Dampens accumulated pointer impulse velocity between frames.
   *
   * @returns {void}
   */
  private decayPointerImpulse() {
    if (this.pointer.needsImpulse) {
      this.pointer.velocity.multiplyScalar(0.65)
      if (this.pointer.velocity.lengthSq() < 0.25) {
        this.pointer.velocity.set(0, 0)
        this.pointer.needsImpulse = false
      }
    }
  }

  /**
   * Synchronizes the debug pointer helper with the latest pointer position.
   *
   * @returns {void}
   */
  private updatePointerHelper() {
    if (!this.pointerHelper) return
    this.pointerHelper.visible = this.pointerColliderVisible
    if (!this.pointerColliderVisible) return
    this.pointerHelper.position.set(this.pointer.position.x, this.pointer.position.y, 0.2)
  }

  /**
   * Lazily creates the pointer helper mesh if needed.
   *
   * @returns {THREE.Mesh}
   */
  private ensurePointerHelper() {
    if (!this.pointerHelper) {
      const geometry = new THREE.SphereGeometry(0.12, 16, 16)
      const material = new THREE.MeshBasicMaterial({ color: 0xff6699, wireframe: true })
      this.pointerHelper = new THREE.Mesh(geometry, material)
      this.pointerHelper.visible = false
    }
    return this.pointerHelper
  }

  /**
   * Applies the currently selected pin mode to a cloth instance.
   *
   * @param {ClothPhysics} cloth
   * @returns {void}
   */
  private applyPinMode(cloth: ClothPhysics) {
    switch (this.debug.pinMode) {
      case 'top':
        cloth.pinTopEdge()
        break
      case 'bottom':
        cloth.pinBottomEdge()
        break
      case 'corners':
        cloth.pinCorners()
        break
      case 'none':
      default:
        break
    }
  }

  /**
   * Performs warm-start passes to settle constraints before release.
   *
   * @param {ClothPhysics} cloth
   * @returns {void}
   */
  private runWarmStart(cloth: ClothPhysics) {
    if (WARM_START_PASSES <= 0) return
    cloth.wake()
    cloth.setGravity(new THREE.Vector3(0, 0, 0))
    cloth.relaxConstraints(this.debug.constraintIterations * WARM_START_PASSES)
  }
}
