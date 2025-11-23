import * as THREE from 'three'
import { CcdSettingsState } from '../engine/ccd/CcdSettingsState'
import { CcdStepperSystem } from '../engine/ccd/CcdStepperSystem'
import { CcdProbeOverlaySystem } from '../engine/ccd/CcdProbeOverlaySystem'
import { DOMToWebGL } from './domToWebGL'
import type { DOMMeshRecord } from './domToWebGL'
import { ClothPhysics } from './clothPhysics'
import { CollisionSystem } from './collisionSystem'
import { EventBusSystem } from '../engine/events/EventBusSystem'
import { EventOverlayAdapter } from '../engine/events/EventOverlayAdapter'
import { PerfEmitterSystem } from '../engine/events/PerfEmitterSystem'
import { BusMetricsOverlaySystem } from '../engine/events/BusMetricsOverlaySystem'
import { WakeMarkerSystem } from '../engine/events/WakeMarkerSystem'
import { EventIds } from '../engine/events/ids'
import { CANONICAL_HEIGHT_METERS } from './units'
import { ElementPool } from './elementPool'
import { EngineWorld } from '../engine/world'
import { SimulationSystem } from '../engine/systems/simulationSystem'
import { SimulationRunner } from '../engine/simulationRunner'
import { EntityManager } from '../engine/entity/entityManager'
import { CameraSystem } from '../engine/camera/CameraSystem'
import { WorldRendererSystem } from '../engine/render/worldRendererSystem'
import { DebugOverlaySystem } from '../engine/render/DebugOverlaySystem'
import { DebugOverlayState } from '../engine/render/DebugOverlayState'
import { RenderSettingsSystem } from '../engine/render/RenderSettingsSystem'
import { RenderSettingsState } from '../engine/render/RenderSettingsState'
import { WireframeOverlaySystem } from '../engine/render/WireframeOverlaySystem'
import { PhysicsSystem } from '../engine/systems/physicsSystem'
import { PhysicsRegistry } from '../engine/registry/PhysicsRegistry'
import { attachRegistryToEventBus } from '../engine/registry/registryBusAdapter'
import type { Entity } from '../engine/entity/entity'
import type { Component } from '../engine/entity/component'
import type { PinMode } from '../types/pinMode'
import { SimWorld, type SimBody, type SimWarmStartConfig, type SimSleepConfig } from './simWorld'

const WARM_START_PASSES = 2

export type { PinMode } from '../types/pinMode'

type DebugSettings = {
  realTime: boolean
  wireframe: boolean
  gravity: number
  impulseMultiplier: number
  constraintIterations: number
  substeps: number
  tessellationSegments: number
  autoTessellation?: boolean
  tessellationMin?: number
  tessellationMax?: number
  pointerCollider: boolean
  pinMode: PinMode
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
  entity?: Entity
  releasePinsTimeout?: number
  hideOnNextFrame?: boolean
}

/**
 * Adapts DOM-backed cloth meshes into the simulation layer while implementing the
 * Component contract so they can be tracked via {@link EntityManager}.
 */
class ClothBodyAdapter implements SimBody, Component {
  public readonly id: string
  private item: ClothItem
  private pointer: PointerState
  private collisionSystem: CollisionSystem
  private offscreenCallback: () => void
  private record: DOMMeshRecord
  private debug: Pick<DebugSettings, 'impulseMultiplier'>
  private _tmpWorldV3 = new THREE.Vector3()
  private _tmpWorldV3B = new THREE.Vector3()
  private _tmpLocalV3 = new THREE.Vector3()
  private _tmpLocalV3B = new THREE.Vector3()
  private _tmpLocalV2 = new THREE.Vector2()
  private _tmpLocalV2B = new THREE.Vector2()
  // World-space sleep tracking (prevents premature sleep on scaled meshes)
  private _lastWorldCenter = new THREE.Vector2()
  private _worldStillFrames = 0
  private _worldSleepVelThreshold = 0.001
  private _worldSleepFrameThreshold = 60

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
    this.offscreenCallback = handleOffscreen
    this.record = record
    this.debug = debug
    // Initialize world sleep thresholds from controller defaults
    this._worldSleepVelThreshold = window.__clothWorldSleepVel ?? 0.001
  }

  update(dt: number) {
    const cloth = this.item.cloth
    if (!cloth) return

    const worldBody = this.record.worldBody

    if (this.pointer.needsImpulse) {
      const worldRadius = this.getImpulseRadius()
      const localRadius = this.getLocalImpulseRadius(worldRadius)
      const strength = this.getImpulseStrength()
      const localForce = this.getLocalPointerVelocity().multiplyScalar(strength)
      const localPoint = this.getLocalPointerPosition()
      cloth.applyImpulse(localPoint, localForce, localRadius)
      this.pointer.needsImpulse = false
    }

    cloth.update(dt)
    this.collisionSystem.apply(cloth)

    let boundary = -CANONICAL_HEIGHT_METERS
    if (worldBody) {
      this._tmpWorldV3.set(0, boundary, 0)
      worldBody.worldToLocalPoint(this._tmpWorldV3, this._tmpLocalV3)
      boundary = this._tmpLocalV3.y
    }
    // World-space sleep guard: keep cloth awake until it remains still in world space
    {
      type MaybeGS = { getBoundingSphere?: () => { center: { x: number; y: number } } }
      const maybe = cloth as unknown as MaybeGS
      if (typeof maybe.getBoundingSphere !== 'function') {
        // Tests/mocks may omit this; skip world-space guard in that case.
        if (cloth.isOffscreen(boundary)) {
          this.offscreenCallback()
        }
        return
      }
      const localCenter = maybe.getBoundingSphere().center
      let worldCenter = this._tmpLocalV2
      if (worldBody) {
        const w = worldBody.localToWorldPoint(
          this._tmpLocalV3.set(localCenter.x, localCenter.y, 0),
          this._tmpWorldV3
        )
        worldCenter = this._tmpLocalV2.set(w.x, w.y)
      } else {
        // Fallback: treat local as world when no transform is present
        worldCenter = this._tmpLocalV2.set(localCenter.x, localCenter.y)
      }
      const dx = worldCenter.x - this._lastWorldCenter.x
      const dy = worldCenter.y - this._lastWorldCenter.y
      const deltaSq = dx * dx + dy * dy
      // scale threshold by dt to approximate velocity threshold per frame
      const v = this._worldSleepVelThreshold * Math.max(1e-6, dt)
      if (deltaSq >= v * v) {
        this._worldStillFrames = 0
        cloth.wake()
      } else {
        this._worldStillFrames += 1
        // Guard: keep cloth awake until world-still for N frames
        if (this._worldStillFrames < this._worldSleepFrameThreshold) {
          cloth.wake()
        }
      }
      this._lastWorldCenter.copy(worldCenter)
    }

    if (cloth.isOffscreen(boundary)) {
      this.offscreenCallback()
    }
  }

  isSleeping() {
    const cloth = this.item.cloth
    if (!cloth) return true
    return cloth.isSleeping()
  }

  wake() {
    this.item.cloth?.wake()
  }

  wakeIfPointInside(point: THREE.Vector2) {
    this.item.cloth?.wakeIfPointInside(point)
  }

  warmStart(config: SimWarmStartConfig) {
    this.item.cloth?.warmStart(config)
  }

  configureSleep(config: SimSleepConfig) {
    const cloth = this.item.cloth
    if (!cloth) return
    cloth.setSleepThresholds(config.velocityThreshold, config.frameThreshold)
    // Keep adapter thresholds in sync for world-space sleep guarding
    this._worldSleepVelThreshold = config.velocityThreshold
    this._worldSleepFrameThreshold = config.frameThreshold
  }

  setConstraintIterations(iterations: number) {
    this.item.cloth?.setConstraintIterations(iterations)
  }

  setGlobalGravity(gravity: THREE.Vector3) {
    const worldBody = this.record.worldBody
    if (!worldBody) {
      this.item.cloth?.setGravity(gravity)
      return
    }
    // Convert world gravity vector into the cloth's local/model space
    const local = this._tmpWorldV3.copy(gravity)
    worldBody.worldToLocalVector(local, this._tmpLocalV3)
    this.item.cloth?.setGravity(this._tmpLocalV3)
  }

  handleOffscreen() {
    this.offscreenCallback()
  }

  onAttach() {}

  onDetach() {}

  getBoundingSphere(): ReturnType<SimBody['getBoundingSphere']> {
    const cloth = this.item.cloth
    if (cloth) {
      const sphere = cloth.getBoundingSphere()
      return {
        center: new THREE.Vector2(sphere.center.x, sphere.center.y),
        radius: sphere.radius,
      }
    }

    const center = this.record.mesh.position
    const radius = Math.max(this.record.widthMeters ?? 0, this.record.heightMeters ?? 0) / 2 || 0.25
    return {
      center: new THREE.Vector2(center.x, center.y),
      radius,
    }
  }

  private getImpulseRadius() {
    const attr = this.item.element.dataset.clothImpulseRadius
    const parsed = attr ? Number.parseFloat(attr) : NaN
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
    const { widthMeters = 0, heightMeters = 0 } = this.record ?? {}
    const base = Math.min(widthMeters || 0, heightMeters || 0)
    const MIN_POINTER_RADIUS = 0.0006
    const DEFAULT_POINTER_RADIUS = 0.0012
    if (base > 0) {
      return Math.max(MIN_POINTER_RADIUS, base / 12)
    }
    return DEFAULT_POINTER_RADIUS
  }

  private getLocalImpulseRadius(worldRadius: number) {
    const worldBody = this.record.worldBody
    if (!worldBody) return worldRadius
    // Sample basis scaling by converting axis sample vectors
    const sx = worldBody.worldToLocalVector(this._tmpWorldV3.set(worldRadius, 0, 0), this._tmpLocalV3).length()
    const sy = worldBody.worldToLocalVector(this._tmpWorldV3B.set(0, worldRadius, 0), this._tmpLocalV3B).length()
    const avg = (sx + sy) * 0.5
    return Number.isFinite(avg) && avg > 0 ? avg : worldRadius
  }

  private getLocalPointerPosition() {
    const worldBody = this.record.worldBody
    if (!worldBody) return this._tmpLocalV2.copy(this.pointer.position)
    this._tmpWorldV3.set(this.pointer.position.x, this.pointer.position.y, 0)
    worldBody.worldToLocalPoint(this._tmpWorldV3, this._tmpLocalV3)
    return this._tmpLocalV2.set(this._tmpLocalV3.x, this._tmpLocalV3.y)
  }

  private getLocalPointerVelocity() {
    const worldBody = this.record.worldBody
    if (!worldBody) return this._tmpLocalV2B.copy(this.pointer.velocity)
    this._tmpWorldV3.set(this.pointer.velocity.x, this.pointer.velocity.y, 0)
    worldBody.worldToLocalVector(this._tmpWorldV3, this._tmpLocalV3)
    return this._tmpLocalV2B.set(this._tmpLocalV3.x, this._tmpLocalV3.y)
  }

  private getImpulseStrength() {
    const attr = this.item.element.dataset.clothImpulseStrength
    const parsed = attr ? Number.parseFloat(attr) : NaN
    const elementStrength = !Number.isNaN(parsed) && parsed > 0 ? parsed : 1
    return elementStrength * this.debug.impulseMultiplier
  }

  /** Returns world-space positions of pinned vertices for debug overlay. */
  getPinnedWorldPositions() {
    const cloth = this.item.cloth
    const record = this.record
    if (!cloth || !record) return [] as { x: number; y: number }[]
    const locals = cloth.getPinnedVertexPositions()
    const out: { x: number; y: number }[] = []
    for (const v of locals) {
      const world = record.worldBody.localToWorldPoint(this._tmpLocalV3.set(v.x, v.y, v.z), this._tmpWorldV3)
      out.push({ x: world.x, y: world.y })
    }
    return out
  }
}

export type ClothSceneControllerOptions = {
  simulationSystem?: SimulationSystem
  simulationRunner?: SimulationRunner
  simWorld?: SimWorld
  engine?: EngineWorld
  fixedDelta?: number
  maxSubSteps?: number
}

/**
 * Coordinates DOM capture, pointer interaction, and simulation orchestration for the cloth demo.
 * The controller owns no game-loop logic directly; instead it delegates to the injected
 * {@link SimulationRunner} and {@link SimulationSystem} instances.
 */
export class ClothSceneController {
  private static readonly SIM_SYSTEM_ID = 'sim-core'
  private static readonly CAMERA_SYSTEM_ID = 'render-camera'
  private static readonly RENDERER_SYSTEM_ID = 'world-renderer'
  private static readonly OVERLAY_SYSTEM_ID = 'debug-overlay'
  private domToWebGL: DOMToWebGL | null = null
  private collisionSystem = new CollisionSystem()
  private items = new Map<HTMLElement, ClothItem>()
  private sandboxObjects = new Set<THREE.Object3D>()
  private rafId: number | null = null
  private clock = new THREE.Clock()
  private disposed = false
  private pool: ElementPool | null = null
  private simulationSystem: SimulationSystem
  private simulationRunner: SimulationRunner
  private simWorld: SimWorld
  private engine: EngineWorld
  private entities = new EntityManager()
  private cameraSystem: CameraSystem | null = null
  private worldRenderer: WorldRendererSystem | null = null
  private overlaySystem: DebugOverlaySystem | null = null
  private overlayState: DebugOverlayState | null = null
  private renderSettingsSystem: RenderSettingsSystem | null = null
  private renderSettingsState: RenderSettingsState | null = null
  private wireframeOverlaySystem: WireframeOverlaySystem | null = null
  private physicsSystem: PhysicsSystem | null = null
  private registry: PhysicsRegistry | null = null
  // Event bus and overlay adapter
  private eventBusSystem: import('../engine/events/EventBusSystem').EventBusSystem | null = null
  private eventOverlayAdapter: import('../engine/events/EventOverlayAdapter').EventOverlayAdapter | null = null
  private busMetricsOverlay: import('../engine/events/BusMetricsOverlaySystem').BusMetricsOverlaySystem | null = null
  private wakeMarkerSystem: import('../engine/events/WakeMarkerSystem').WakeMarkerSystem | null = null
  // CCD demo integration
  private ccdSettings: import('../engine/ccd/CcdSettingsState').CcdSettingsState | null = null
  private ccdStepper: import('../engine/ccd/CcdStepperSystem').CcdStepperSystem | null = null
  private ccdOverlay: import('../engine/ccd/CcdProbeOverlaySystem').CcdProbeOverlaySystem | null = null
  private ccdProbe: { shape: import('../engine/ccd/sweep').OBB; velocity: import('../engine/ccd/sweep').Vec2 } | null = null
  private ccdWall: import('../engine/ccd/sweep').AABB | null = null
  private ccdOnCollision: ((payload: { id: string; obstacle: any; t: number; normal: { x: number; y: number } }) => void) | null = null
  private elementIds = new Map<HTMLElement, string>()
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
  private sleepConfig: SimSleepConfig = {
    velocityThreshold: 0.001,
    frameThreshold: 60,
  }
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
  }
  private onPointerMove = (event: PointerEvent) => this.handlePointerMove(event)
  private onPointerLeave = () => this.resetPointer()
  private onPointerUp = (event: PointerEvent) => this.handlePointerUp(event)

  /**
   * Creates a new cloth scene controller. All dependencies are optional and may be supplied to
   * facilitate testing or reuse across projects.
   */
  constructor(options: ClothSceneControllerOptions = {}) {
    this.simWorld = options.simWorld ?? new SimWorld()
    this.simulationSystem = options.simulationSystem ?? new SimulationSystem({ simWorld: this.simWorld })

    this.engine = options.engine ?? new EngineWorld()
    this.engine.addSystem(this.simulationSystem, { id: ClothSceneController.SIM_SYSTEM_ID, priority: 100 })

    this.simulationRunner =
      options.simulationRunner ??
      new SimulationRunner({
        engine: this.engine,
        fixedDelta: options.fixedDelta,
        maxSubSteps: options.maxSubSteps ?? this.debug.substeps,
      })

    this.registry = new PhysicsRegistry()
  }

  /**
   * Prepares the controller by capturing cloth-enabled DOM elements, wiring event listeners,
   * and seeding static collision geometry. Calling this method multiple times is a no-op.
   */
  async init() {
    if (this.domToWebGL) return

    this.domToWebGL = new DOMToWebGL(document.body)
    this.pool = new ElementPool(this.domToWebGL)
    // Ensure the simulation system is attached (dispose may have removed it)
    try {
      this.engine.addSystem(this.simulationSystem, { id: ClothSceneController.SIM_SYSTEM_ID, priority: 100 })
    } catch {
      // Already attached; ignore.
    }
    const viewport = this.domToWebGL.getViewportPixels()
    this.collisionSystem.setViewportDimensions(viewport.width, viewport.height)

    // Seed static collision geometry for any DOM elements explicitly marked
    // as rigid-static. This allows simple sandbox scenes (e.g. a text area
    // acting as a floor) to participate in cloth/rigid collisions without
    // additional wiring.
    const staticElements = Array.from(
      document.querySelectorAll<HTMLElement>('.rigid-static')
    )
    for (const el of staticElements) {
      this.collisionSystem.addStaticBody(el)
    }

    const clothElements = Array.from(
      document.querySelectorAll<HTMLElement>('.cloth-enabled')
    )

    if (clothElements.length > 0) {
      await this.prepareElements(clothElements)
    }
    this.updateOverlayDebug()

    window.addEventListener('resize', this.onResize, { passive: true })
    window.addEventListener('scroll', this.onScroll, { passive: true })
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('pointerup', this.onPointerUp, { passive: true })
    window.addEventListener('pointerleave', this.onPointerLeave, { passive: true })
    window.addEventListener('pointercancel', this.onPointerLeave, { passive: true })

    // Register camera + render systems once the DOM/WebGL view exists.
    this.installRenderPipeline()

    this.clock.start()
    this.animate()

    // Debug overlay handles pointer gizmos; nothing to toggle here.
  }

  /**
   * Releases all resources created by {@link init}, including DOM attachments, cloth entities,
   * and simulation bodies. Safe to call even if initialization was skipped.
   */
  dispose() {
    this.disposed = true
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
    }

    // Pointer helper removed; overlay system manages gizmos.

    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('scroll', this.onScroll)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointerleave', this.onPointerLeave)
    window.removeEventListener('pointercancel', this.onPointerLeave)

    for (const item of this.items.values()) {
      if (item.releasePinsTimeout !== undefined) {
        clearTimeout(item.releasePinsTimeout)
        delete item.releasePinsTimeout
      }
      item.entity?.destroy()
      item.element.style.opacity = item.originalOpacity
      item.element.removeEventListener('click', item.clickHandler)
      this.pool?.destroy(item.element)
    }

    this.collisionSystem.clear()
    this.clearSandboxObjects()

    if (this.domToWebGL) {
      this.domToWebGL.detach()
      this.domToWebGL.renderer.dispose()
    }

    this.items.clear()
    this.domToWebGL = null
    this.pool = null
    // Pause, clear simulation state, then detach systems.
    this.setRealTime(false)
    this.simulationSystem.clear()
    // Remove registered systems to avoid leaking across re-initializations.
    if (this.overlaySystem) {
      this.engine.removeSystemInstance(this.overlaySystem)
      this.overlaySystem = null
    }
    if (this.ccdOverlay) {
      this.engine.removeSystemInstance(this.ccdOverlay)
      this.ccdOverlay = null
    }
    if (this.ccdStepper) {
      this.engine.removeSystemInstance(this.ccdStepper)
      this.ccdStepper = null
    }
    if (this.worldRenderer) {
      this.engine.removeSystemInstance(this.worldRenderer)
      this.worldRenderer = null
    }
    if (this.cameraSystem) {
      this.engine.removeSystemInstance(this.cameraSystem)
      this.cameraSystem = null
    }
    if (this.eventOverlayAdapter) {
      this.engine.removeSystemInstance(this.eventOverlayAdapter)
      this.eventOverlayAdapter = null
    }
    if (this.eventBusSystem) {
      this.engine.removeSystemInstance(this.eventBusSystem)
      this.eventBusSystem = null
    }
    // Finally remove the simulation core system itself.
    this.engine.removeSystemInstance(this.simulationSystem)
    this.elementIds.clear()
  }

  private computeAutoSegments(rect: DOMRect, maxCap = this.debug.tessellationSegments) {
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))
    const round = (n: number) => Math.round(n)

    // Auto off → return the exact configured segments (clamped)
    if (!this.debug.autoTessellation) {
      return clamp(round(this.debug.tessellationSegments), 1, 48)
    }

    const viewport = this.domToWebGL!.getViewportPixels()
    const rectW = Number.isFinite(rect.width) ? rect.width : 0
    const rectH = Number.isFinite(rect.height) ? rect.height : 0
    const vpW = Number.isFinite(viewport.width) ? viewport.width : 0
    const vpH = Number.isFinite(viewport.height) ? viewport.height : 0

    const area = Math.max(1, rectW * rectH)
    const screenArea = Math.max(1, vpW * vpH)
    const s = Math.sqrt(area / screenArea) // proportion of screen by diagonal

    const MIN_SEGMENTS = clamp(round(this.debug.tessellationMin ?? 6), 1, 40)
    const MAX_TESSELLATION_CAP = 48
    const rawMax = round(maxCap)
    const maxUser = clamp(round(this.debug.tessellationMax ?? maxCap), MIN_SEGMENTS + 2, MAX_TESSELLATION_CAP)
    const MAX = Math.min(clamp(rawMax, MIN_SEGMENTS + 2, MAX_TESSELLATION_CAP), maxUser)

    const desired = round(MIN_SEGMENTS + s * (MAX - MIN_SEGMENTS))
    return clamp(desired, MIN_SEGMENTS, MAX)
  }

  private async prepareElements(elements: HTMLElement[]) {
    // Capture current references; the controller may get disposed while
    // awaiting pool work during rapid navigations or hot reload.
    const bridge = this.domToWebGL
    const pool = this.pool
    if (!bridge || !pool) return

    for (const element of elements) {
      // Bail early if controller was disposed or pool swapped out.
      if (this.disposed || this.pool !== pool || this.domToWebGL !== bridge) return
      const rect = element.getBoundingClientRect()
      const seg = this.computeAutoSegments(rect, this.debug.tessellationSegments)
      await pool.prepare(element, seg)
      if (this.disposed || this.pool !== pool || this.domToWebGL !== bridge) return
      pool.mount(element)

      const record = pool.getRecord(element)

      const originalOpacity = element.style.opacity

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

  private activate(element: HTMLElement) {
    if (!this.domToWebGL || !this.pool) return

    const item = this.items.get(element)
    if (!item || item.isActive) return

    item.isActive = true
    // Mark DOM element to be hidden on the next animation frame, after
    // the captured mesh has had a chance to render at least once.
    item.hideOnNextFrame = true
    this.collisionSystem.removeStaticBody(element)
    this.resetPointer()

    const record = this.pool.getRecord(element)
    if (!record) return

    this.pool.resetGeometry(element)

    const cloth = new ClothPhysics(record.mesh, {
      damping: 0.985,
      constraintIterations: this.debug.constraintIterations,
    })

    cloth.setConstraintIterations(this.debug.constraintIterations)
    cloth.setSubsteps(this.debug.substeps)
    this.applyPinMode(cloth)

    const gravityVector = new THREE.Vector3(0, -this.debug.gravity, 0)
    cloth.setGravity(gravityVector)

    // Seed a small, size-relative perturbation to avoid perfectly rigid start.
    // Using a fixed 0.06 meters overwhelmed tiny meshes on some viewports.
    const sizeHint = Math.max(0.0005, Math.min(record.widthMeters, record.heightMeters))
    const jitter = Math.min(0.02, sizeHint * 0.2)
    cloth.addTurbulence(jitter)
    item.releasePinsTimeout = window.setTimeout(() => {
      cloth.releaseAllPins()
      delete item.releasePinsTimeout
    }, 900)

    item.cloth = cloth
    item.record = record
    const material = record.mesh.material as THREE.MeshBasicMaterial | undefined
    if (material) {
      const wire = this.renderSettingsState ? this.renderSettingsState.wireframe : this.debug.wireframe
      material.wireframe = wire
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
    // Mark mesh as cloth for render settings system.
    const meshObj = record.mesh as unknown as { userData?: Record<string, unknown> }
    meshObj.userData = { ...(meshObj.userData || {}), isCloth: true, isStatic: false }
    this.simulationSystem.addBody(adapter, {
      warmStart: this.createWarmStartConfig(),
      sleep: this.sleepConfig,
    })
    const entity = this.entities.createEntity({ id: adapterId, name: element.id })
    entity.addComponent(adapter)
    item.adapter = adapter
    item.entity = entity
    element.removeEventListener('click', item.clickHandler)
    // Refresh debug overlay data (pins, snapshot) immediately after activation
    this.updateOverlayDebug()
  }

  private animate() {
    if (this.disposed || !this.domToWebGL) return

    this.rafId = requestAnimationFrame(() => this.animate())
    const delta = Math.min(this.clock.getDelta(), 0.05)

    this.simulationRunner.update(delta)
    this.simulationRunner.getEngine().frame(delta)

    this.decayPointerImpulse()
    this.hideActivatedDomElements()
  }

  private hideActivatedDomElements() {
    for (const item of this.items.values()) {
      if (item.isActive && item.hideOnNextFrame) {
        item.element.style.opacity = '0'
        item.hideOnNextFrame = false
      }
    }
  }

  private handleResize() {
    if (!this.domToWebGL) return
    this.domToWebGL.resize()
    const viewport = this.domToWebGL.getViewportPixels()
    this.collisionSystem.setViewportDimensions(viewport.width, viewport.height)
    this.collisionSystem.refresh()
    this.syncStaticMeshes()
  }

  private installRenderPipeline() {
    if (!this.domToWebGL) return
    if (this.cameraSystem && this.worldRenderer && this.overlaySystem) return
    if (
      this.cameraSystem ||
      this.worldRenderer ||
      this.overlaySystem ||
      this.renderSettingsSystem ||
      this.eventOverlayAdapter ||
      this.eventBusSystem ||
      this.busMetricsOverlay ||
      this.ccdOverlay ||
      this.ccdStepper
    ) {
      if (this.cameraSystem) this.engine.removeSystemInstance(this.cameraSystem)
      if (this.worldRenderer) this.engine.removeSystemInstance(this.worldRenderer)
      if (this.overlaySystem) this.engine.removeSystemInstance(this.overlaySystem)
      if (this.renderSettingsSystem) this.engine.removeSystemInstance(this.renderSettingsSystem)
      if (this.eventOverlayAdapter) this.engine.removeSystemInstance(this.eventOverlayAdapter)
      if (this.eventBusSystem) this.engine.removeSystemInstance(this.eventBusSystem)
      if (this.busMetricsOverlay) this.engine.removeSystemInstance(this.busMetricsOverlay)
      if (this.wakeMarkerSystem) this.engine.removeSystemInstance(this.wakeMarkerSystem)
      if (this.physicsSystem) this.engine.removeSystemInstance(this.physicsSystem)
      if (this.wireframeOverlaySystem) this.engine.removeSystemInstance(this.wireframeOverlaySystem)
      if (this.ccdOverlay) this.engine.removeSystemInstance(this.ccdOverlay)
      if (this.ccdStepper) this.engine.removeSystemInstance(this.ccdStepper)
      this.cameraSystem = null
      this.worldRenderer = null
      this.overlaySystem = null
      this.renderSettingsSystem = null
      this.eventOverlayAdapter = null
      this.eventBusSystem = null
      this.busMetricsOverlay = null
      this.wakeMarkerSystem = null
      this.physicsSystem = null
      this.wireframeOverlaySystem = null
      this.ccdOverlay = null
      this.ccdStepper = null
    }
    // Create a camera system and world renderer that reads snapshots each frame.
    this.cameraSystem = new CameraSystem()
    this.worldRenderer = new WorldRendererSystem({ view: this.domToWebGL, camera: this.cameraSystem })
    // Render-only systems: debug overlay + render settings (e.g., wireframe)
    this.overlayState = new DebugOverlayState()
    this.overlaySystem = new DebugOverlaySystem({ view: this.domToWebGL, state: this.overlayState })
    this.renderSettingsState = new RenderSettingsState()
    this.renderSettingsSystem = new RenderSettingsSystem({ view: this.domToWebGL, state: this.renderSettingsState })
    // Wireframe overlay pass (driven by render settings)
    this.wireframeOverlaySystem = new WireframeOverlaySystem({ view: this.domToWebGL, settings: this.renderSettingsState })
    // Event bus system
    this.eventBusSystem = new EventBusSystem()
    const bus = this.eventBusSystem.getBus()
    // Bridge registry events onto Phase 0 so panels/overlays can observe
    // add/update/remove changes without coupling to DOM scanning.
    if (this.registry) {
      try {
        attachRegistryToEventBus(this.registry, bus, { channel: 'frameEnd' })
        this.registry.discover(document)
      } catch (error) {
        // Registry wiring is best-effort; avoid breaking init if DOM/registry
        // integration fails in a particular environment.
        console.warn?.('PhysicsRegistry wiring failed:', error)
      }
    }
    // Physics orchestrator (static-first rigid lane). Runs before SimulationSystem.
    // It uses collisionSystem's static AABBs and publishes events to the bus.
    this.physicsSystem = new PhysicsSystem({
      bus,
      getAabbs: () => this.collisionSystem.getStaticAABBs().map((b) => ({ min: { x: b.min.x, y: b.min.y }, max: { x: b.max.x, y: b.max.y } })),
      enableDynamicPairs: true,
    })
    // Register with lower priority than simulation so render sees the latest snapshot.
    this.engine.addSystem(this.cameraSystem, {
      id: ClothSceneController.CAMERA_SYSTEM_ID,
      priority: 50,
      allowWhilePaused: true,
    })
    this.engine.addSystem(this.worldRenderer, {
      id: ClothSceneController.RENDERER_SYSTEM_ID,
      priority: 10,
      allowWhilePaused: true,
    })
    this.engine.addSystem(this.overlaySystem, {
      id: ClothSceneController.OVERLAY_SYSTEM_ID,
      priority: 5,
      allowWhilePaused: true,
    })
    this.engine.addSystem(this.renderSettingsSystem, {
      id: 'render-settings',
      priority: 8,
      allowWhilePaused: true,
    })
    // Rigid lane before simulation
    try {
      this.engine.addSystem(this.physicsSystem, { id: 'physics-core', priority: 101 })
    } catch {}
    this.engine.addSystem(this.wireframeOverlaySystem, {
      id: 'wireframe-overlay',
      priority: 7,
      allowWhilePaused: true,
    })
    // Event bus and overlays
    this.engine.addSystem(this.eventBusSystem, { id: 'event-bus', priority: 1000, allowWhilePaused: true })
    this.eventOverlayAdapter = new EventOverlayAdapter({ bus: this.eventBusSystem.getBus(), overlay: this.overlayState! })
    this.engine.addSystem(this.eventOverlayAdapter, { id: 'event-overlay-adapter', priority: 9, allowWhilePaused: true })
    // Perf emitter
    const perfRigid = new PerfEmitterSystem({ bus: this.eventBusSystem.getBus(), laneId: 0 })
    const perfCloth = new PerfEmitterSystem({ bus: this.eventBusSystem.getBus(), laneId: 1 })
    try {
      this.engine.addSystem(perfRigid, { id: 'perf-emitter-rigid', priority: 998, allowWhilePaused: true })
      this.engine.addSystem(perfCloth, { id: 'perf-emitter-cloth', priority: 997, allowWhilePaused: true })
    } catch {}
    // Bus metrics overlay bars
    this.busMetricsOverlay = new BusMetricsOverlaySystem({ view: this.domToWebGL, bus: this.eventBusSystem.getBus() })
    try { this.engine.addSystem(this.busMetricsOverlay, { id: 'bus-metrics-overlay', priority: 6, allowWhilePaused: true }) } catch {}

    // Wake markers debug system: bridge Wake events to overlay markers.
    // Skip in test environments if desired to keep jsdom lean.
    const mode = (import.meta as any)?.env?.MODE
    if (mode !== 'test') {
      this.wakeMarkerSystem = new WakeMarkerSystem({
        bus: this.eventBusSystem.getBus(),
        overlay: this.overlayState!,
        getPosition: (entityId: number) => {
          if (!this.physicsSystem) return null
          return this.physicsSystem.getRigidBodyCenter(entityId)
        },
        lifetimeFrames: 12,
      })
      try {
        this.engine.addSystem(this.wakeMarkerSystem, { id: 'wake-markers', priority: 8, allowWhilePaused: true })
      } catch {}
    }

    // CCD demo: overlay + stepper (feature-flagged)
    this.ccdSettings = new CcdSettingsState()
    // Default wall: thin vertical slab in front of camera
    this.ccdWall = { kind: 'aabb', min: { x: 2.0, y: -2.0 }, max: { x: 2.02, y: 2.0 } }
    // Probe starts inactive until toggled via UI
    this.ccdProbe = null
    this.ccdStepper = new CcdStepperSystem({
      state: this.ccdSettings,
      getMovingBodies: () => {
        if (!this.ccdProbe) return []
        const p = this.ccdProbe
        return [{ id: 'ccd-probe', shape: p.shape, velocity: p.velocity, setCenter: (x, y) => { p.shape.center.x = x; p.shape.center.y = y } }]
      },
      getObstacles: () => {
        const obs: Array<import('../engine/ccd/sweep').OBB | import('../engine/ccd/sweep').AABB> = []
        if (this.ccdWall) obs.push(this.ccdWall)
        return obs
      },
      onCollision: (payload) => {
        // Notify UI listener
        if (this.ccdOnCollision) {
          try { this.ccdOnCollision(payload) } catch {}
        }
        // Publish to event bus for panels/overlays
        const bus = this.eventBusSystem?.getBus()
        if (bus) {
          try {
            bus.publish('fixedEnd', EventIds.CcdHit, (w) => {
              // Pack: t, normal.x, normal.y
              w.f32[0] = typeof payload.t === 'number' ? payload.t : 0
              w.f32[1] = payload.normal?.x ?? 0
              w.f32[2] = payload.normal?.y ?? 0
            })
          } catch {}
        }
      }
    })
    this.engine.addSystem(this.ccdStepper, { id: 'ccd-stepper', priority: 55 })
    this.ccdOverlay = new CcdProbeOverlaySystem({
      view: this.domToWebGL,
      getProbe: () => this.ccdProbe ? this.ccdProbe.shape : null,
      getObstacles: () => (this.ccdWall ? [this.ccdWall] : []),
    })
    this.engine.addSystem(this.ccdOverlay, { id: 'ccd-probe-overlay', priority: 6, allowWhilePaused: true })
  }

  /** Returns the underlying engine world for debug actions. */
  getEngine() {
    return this.engine
  }

  /** Returns the simulation runner for debug actions. */
  getRunner() {
    return this.simulationRunner
  }

  /** Returns the camera system if installed; otherwise null. */
  getCameraSystem() {
    return this.cameraSystem
  }

  /** Returns the overlay state for EngineActions. */
  getOverlayState() {
    return this.overlayState
  }

  /** Returns the render settings state for EngineActions. */
  getRenderSettingsState() {
    return this.renderSettingsState
  }

  /** Adds a standalone Three.js object to the render scene (used by sandbox scenarios). */
  addSceneObject(obj: THREE.Object3D) {
    if (!obj) return
    if (!this.domToWebGL) return
    try {
      this.domToWebGL.addMesh(obj)
      this.sandboxObjects.add(obj)
    } catch (error) {
      console.warn?.('Failed to add scene object', error)
    }
  }

  /** Removes a previously added scene object from the render scene. */
  removeSceneObject(obj: THREE.Object3D) {
    if (!obj) return
    try {
      this.domToWebGL?.removeMesh(obj)
    } catch (error) {
      console.warn?.('Failed to remove scene object', error)
    }
    this.sandboxObjects.delete(obj)
  }

  /** Removes all sandbox-managed scene objects (used on dispose/scene swap). */
  clearSandboxObjects() {
    for (const obj of this.sandboxObjects.values()) {
      try {
        this.domToWebGL?.removeMesh(obj)
      } catch {}
    }
    this.sandboxObjects.clear()
  }

  /** Returns the event bus instance for advanced integrations. */
  getEventBus() {
    return this.eventBusSystem?.getBus() ?? null
  }

  /** CCD settings for the debug UI */
  getCcdSettingsState() {
    return this.ccdSettings
  }

  /** Enables/disables the CCD stepper and optionally spawns a probe box. */
  setCcdEnabled(enabled: boolean) {
    if (!this.ccdSettings) return
    if (enabled && !this.ccdProbe) {
      // Spawn a small probe to the left moving right
      this.ccdProbe = { shape: { kind: 'obb', center: { x: 0, y: 0 }, half: { x: 0.1, y: 0.1 }, angle: 0 }, velocity: { x: 6, y: 0 } }
    }
    if (!enabled) {
      this.ccdProbe = null
    }
  }

  /** Adjusts CCD thresholds. */
  configureCcd(options: Partial<{ speedThreshold: number; epsilon: number }>) {
    if (!this.ccdSettings) return
    if (options.speedThreshold !== undefined) this.ccdSettings.speedThreshold = Math.max(0, options.speedThreshold)
    if (options.epsilon !== undefined) this.ccdSettings.epsilon = Math.max(1e-6, options.epsilon)
  }

  /** Sets the probe speed (m/s). */
  setCcdProbeSpeed(speed: number) {
    if (!this.ccdProbe) return
    const s = Math.max(0, speed)
    this.ccdProbe.velocity.x = s
    this.ccdProbe.velocity.y = 0
  }

  /** Registers a collision listener for CCD probe hits (used by Debug UI to show toasts). */
  setCcdCollisionListener(listener: ((payload: { id: string; obstacle: any; t: number; normal: { x: number; y: number } }) => void) | null) {
    this.ccdOnCollision = listener
  }

  private syncStaticMeshes() {
    if (!this.domToWebGL) return

    for (const item of this.items.values()) {
      if (item.isActive) continue
      const record = this.pool?.getRecord(item.element)
      if (record) {
        this.domToWebGL.updateMeshTransform(item.element, record)
      }
    }
    this.updateOverlayDebug()
  }

  private handlePointerMove(event: PointerEvent) {
    if (!this.domToWebGL) return
    const canonical = this.domToWebGL.pointerToCanonical(event.clientX, event.clientY)
    const x = canonical.x
    const y = canonical.y

    this.pointer.previous.copy(this.pointer.position)
    this.pointer.position.set(x, y)
    this.overlayState?.pointer.set(x, y)
    // Publish pointer move to the event bus
    const bus = this.getEventBus()
    if (bus) {
      bus.publish('frameBegin', EventIds.PointerMove, (w) => {
        w.f32[0] = x
        w.f32[1] = y
      })
    }

    if (!this.pointer.active) {
      this.pointer.active = true
      this.pointer.previous.copy(this.pointer.position)
      this.simulationSystem.notifyPointer(this.pointer.position)
      return
    }

    this.pointer.velocity.copy(this.pointer.position).sub(this.pointer.previous)
    const speedSq = this.pointer.velocity.lengthSq()

    if (speedSq > 0.0001) {
      this.pointer.needsImpulse = true
    }

    this.simulationSystem.notifyPointer(this.pointer.position)
    this.updateOverlayDebug()
    // overlay pointer updated elsewhere
  }

  private handlePointerUp(event: PointerEvent) {
    if (!this.domToWebGL) {
      this.resetPointer()
      return
    }
    // Map the release position into canonical space and attempt a rigid pick.
    const canonical = this.domToWebGL.pointerToCanonical(event.clientX, event.clientY)
    if (this.physicsSystem) {
      try {
        this.physicsSystem.pickAt({ x: canonical.x, y: canonical.y })
      } catch {
        // Picking is best-effort; never break pointer release.
      }
    }
    this.resetPointer()
  }

  private resetPointer() {
    this.pointer.active = false
    this.pointer.needsImpulse = false
    this.pointer.velocity.set(0, 0)
    this.overlayState?.pointer.set(0, 0)
    // overlay pointer updated elsewhere
  }

  private updateOverlayDebug() {
    if (!this.overlayState) return
    // Static AABBs
    const aabbs = this.collisionSystem.getStaticAABBs().map((b) => ({
      min: { x: b.min.x, y: b.min.y },
      max: { x: b.max.x, y: b.max.y },
    }))
    this.overlayState.aabbs = aabbs
    // Rigid bodies (for debug markers)
    if (this.physicsSystem && typeof (this.physicsSystem as any).debugGetRigidBodies === 'function') {
      this.overlayState.rigidBodies = (this.physicsSystem as any).debugGetRigidBodies()
    } else {
      this.overlayState.rigidBodies = []
    }
    // Simulation snapshot (sleeping/awake)
    try {
      const snapshot = this.simulationSystem.getSnapshot()
      this.overlayState.simSnapshot = this.isSimSnapshot(snapshot) ? snapshot : undefined
    } catch (error) {
      console.error('Failed to capture simulation snapshot for overlay', error)
      this.overlayState.simSnapshot = undefined
    }
    // Pin markers from active cloth adapters
    const pins: Array<{ x: number; y: number }> = []
    for (const item of this.items.values()) {
      if (!item.isActive || !item.adapter) continue
      const pts = item.adapter.getPinnedWorldPositions()
      for (const p of pts) pins.push(p)
    }
    this.overlayState.pinMarkers = pins
  }

  private isSimSnapshot(value: unknown): value is import('./simWorld').SimWorldSnapshot {
    return Boolean(value && typeof value === 'object' && Array.isArray((value as import('./simWorld').SimWorldSnapshot).bodies))
  }

  private getBodyId(element: HTMLElement) {
    let id = this.elementIds.get(element)
    if (!id) {
      id = `cloth-${this.elementIds.size + 1}`
      this.elementIds.set(element, id)
    }
    return id
  }

  private handleClothOffscreen(item: ClothItem) {
    if (!this.pool) return

    const element = item.element
    const adapter = item.adapter
    if (adapter) {
      this.simulationSystem.removeBody(adapter.id)
    }
    if (item.releasePinsTimeout !== undefined) {
      clearTimeout(item.releasePinsTimeout)
      delete item.releasePinsTimeout
    }
    if (item.entity) {
      item.entity.destroy()
      item.entity = undefined
    }

    // Mark mesh as static again for render settings system.
    const mesh = item.record?.mesh
    if (mesh) {
      const obj = mesh as unknown as { userData?: Record<string, unknown> }
      obj.userData = { ...(obj.userData || {}), isCloth: false, isStatic: true }
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

  /** Enables or disables wireframe rendering for every captured cloth mesh. */
  setWireframe(enabled: boolean) {
    // Deprecated: wireframe toggled via RenderSettingsSystem
    this.debug.wireframe = enabled
  }

  /** Applies a new gravity scalar to every active cloth body. */
  setGravity(gravity: number) {
    this.debug.gravity = gravity
    for (const item of this.items.values()) {
      item.cloth?.setGravity(new THREE.Vector3(0, -gravity, 0))
    }
  }

  /** Adjusts the pointer impulse multiplier used by all cloth adapters. */
  setImpulseMultiplier(multiplier: number) {
    this.debug.impulseMultiplier = multiplier
  }

  /** Toggles real-time simulation updates. The controller still honours manual steps while paused. */
  setRealTime(enabled: boolean) {
    this.debug.realTime = enabled
    this.simulationRunner.setRealTime(enabled)
    if (enabled) {
      this.clock.getDelta()
    }
  }

  /** Sets the desired cloth physics sub-step count and propagates it to the runner and live cloths. */
  setSubsteps(substeps: number) {
    const clamped = Math.max(1, Math.min(16, Math.round(substeps)))
    this.debug.substeps = clamped
    this.simulationRunner.setSubsteps(clamped)
    for (const item of this.items.values()) {
      item.cloth?.setSubsteps(clamped)
    }
  }

  /** Updates constraint solver iterations for all cloth bodies. */
  setConstraintIterations(iterations: number) {
    const clamped = Math.max(1, Math.round(iterations))
    this.debug.constraintIterations = clamped
    for (const item of this.items.values()) {
      item.cloth?.setConstraintIterations(clamped)
    }
  }

  /** Updates default sleep thresholds used for future activations and broadcasts to current bodies. */
  setSleepConfig(config: SimSleepConfig) {
    this.sleepConfig = { ...config }
    this.simulationSystem.broadcastSleepConfiguration(this.sleepConfig)
  }

  setPinMode(mode: PinMode) {
    this.debug.pinMode = mode
    const gravityVector = new THREE.Vector3(0, -this.debug.gravity, 0)
    for (const item of this.items.values()) {
      const cloth = item.cloth
      if (!cloth) continue
      cloth.releaseAllPins()
      this.applyPinMode(cloth)
      cloth.setGravity(gravityVector)
      const adapter = item.adapter
      if (adapter) {
        this.simulationSystem.queueWarmStart(adapter.id, this.createWarmStartConfig())
      }
    }
  }

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
          .prepare(element, this.computeAutoSegments(element.getBoundingClientRect(), clamped))
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

  // setPointerColliderVisible removed in favour of DebugOverlaySystem

  stepOnce() {
    this.simulationRunner.stepOnce()
    this.decayPointerImpulse()
  }

  private decayPointerImpulse() {
    if (this.pointer.needsImpulse) {
      this.pointer.velocity.multiplyScalar(0.65)
      if (this.pointer.velocity.lengthSq() < 0.25) {
        this.pointer.velocity.set(0, 0)
        this.pointer.needsImpulse = false
      }
    }
  }

  // Pointer helper removed; overlay system renders gizmos

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

  private createWarmStartConfig(): SimWarmStartConfig {
    return {
      passes: WARM_START_PASSES,
      constraintIterations: this.debug.constraintIterations,
    }
  }

  /** Returns the simulation system for debug actions. */
  getSimulationSystem() {
    return this.simulationSystem
  }

  /** Returns the physics orchestrator if installed; otherwise null. */
  getPhysicsSystem() {
    return this.physicsSystem
  }

  /** Returns the physics registry instance if available; otherwise null. */
  getPhysicsRegistry() {
    return this.registry
  }
}
