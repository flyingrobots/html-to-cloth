import * as THREE from 'three'
import { DOMToWebGL } from './domToWebGL'
import type { DOMMeshRecord } from './domToWebGL'
import { ClothPhysics } from './clothPhysics'
import { CollisionSystem } from './collisionSystem'
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
  autoTessellation: boolean
  tessellationMin: number
  tessellationMax: number
  pointerCollider: boolean
  pinMode: PinMode
  worldSleepGuardEnabled: boolean
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
  private _worldSleepGuardEnabled = true
  private _warnedAboutMissingBoundingSphere = false
  private _lastRadius = 0
  // Keep newly activated cloth awake for a short grace window to avoid
  // immediate sleep when pins prevent initial center motion.
  private _activationGraceFrames = 20

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

    // Activation grace: force awake for the first ~0.3s at 60 fps so pinned cloth
    // can sag under gravity before world-space stillness is evaluated.
    if (this._worldSleepGuardEnabled && this._activationGraceFrames > 0) {
      cloth.wake()
    }

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

    // During activation grace, ensure local sleep cannot latch this frame
    if (this._worldSleepGuardEnabled && this._activationGraceFrames > 0) {
      cloth.wake()
      this._activationGraceFrames -= 1
    }
    this.collisionSystem.apply(cloth)

    let boundary = -CANONICAL_HEIGHT_METERS
    if (worldBody) {
      this._tmpWorldV3.set(0, boundary, 0)
      worldBody.worldToLocalPoint(this._tmpWorldV3, this._tmpLocalV3)
      boundary = this._tmpLocalV3.y
    }
    // World-space sleep guard: keep cloth awake until it remains still in world space
    if (this._worldSleepGuardEnabled) {
      type MaybeGS = { getBoundingSphere?: () => { center: { x: number; y: number } } }
      const maybe = cloth as unknown as MaybeGS
      if (typeof maybe.getBoundingSphere === 'function') {
        const bs = maybe.getBoundingSphere() as { center: { x: number; y: number }; radius?: number }
        const localCenter = bs.center
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
      const dRadius = Math.abs(((bs.radius as number) ?? 0) - this._lastRadius)
      // scale threshold by dt to approximate velocity threshold per frame
      const v = this._worldSleepVelThreshold * Math.max(1e-6, dt)
      if (deltaSq >= v * v || dRadius >= v) {
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
      this._lastRadius = ((bs.radius as number) ?? this._lastRadius)
      } else {
        if (!this._warnedAboutMissingBoundingSphere) {
          console.warn(`ClothBodyAdapter ${this.id}: getBoundingSphere not available, world sleep guard disabled`)
          this._warnedAboutMissingBoundingSphere = true
        }
      }
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

  setWorldSleepGuardEnabled(enabled: boolean) {
    this._worldSleepGuardEnabled = !!enabled
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
    autoTessellation: true,
    tessellationMin: 6,
    tessellationMax: 24,
    pointerCollider: false,
    pinMode: 'none',
    worldSleepGuardEnabled: true,
  }
  private onPointerMove = (event: PointerEvent) => this.handlePointerMove(event)
  private onPointerLeave = () => this.resetPointer()

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

    const clothElements = Array.from(
      document.querySelectorAll<HTMLElement>('.cloth-enabled')
    )

    if (!clothElements.length) return

    await this.prepareElements(clothElements)
    this.updateOverlayDebug()

    window.addEventListener('resize', this.onResize, { passive: true })
    window.addEventListener('scroll', this.onScroll, { passive: true })
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('pointerup', this.onPointerLeave, { passive: true })
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
    window.removeEventListener('pointerup', this.onPointerLeave)
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
    if (this.worldRenderer) {
      this.engine.removeSystemInstance(this.worldRenderer)
      this.worldRenderer = null
    }
    if (this.cameraSystem) {
      this.engine.removeSystemInstance(this.cameraSystem)
      this.cameraSystem = null
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

    const MIN_SEGMENTS = clamp(round(this.debug.tessellationMin ?? 6), 1, 46)
    const MAX_TESSELLATION_CAP = 48
    const rawMax = round(maxCap)
    const maxUser = clamp(round(this.debug.tessellationMax ?? maxCap), MIN_SEGMENTS + 2, MAX_TESSELLATION_CAP)
    // Effective max is the lesser of: user-configured max and the provided cap, both bounded by global limits
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
   * Prepares an arbitrary DOM element for cloth capture and (optionally) activates it immediately.
   * Useful for elements that are not present or not cloth-enabled during initial init() capture.
   */
  async clothify(element: HTMLElement, options: { activate?: boolean; addClickHandler?: boolean } = {}) {
    const { activate = true, addClickHandler = true } = options
    const bridge = this.domToWebGL
    const pool = this.pool
    if (!bridge || !pool) return
    const rect = element.getBoundingClientRect()
    const seg = this.computeAutoSegments(rect, this.debug.tessellationSegments)
    await pool.prepare(element, seg)
    pool.mount(element)
    const record = pool.getRecord(element)
    const originalOpacity = element.style.opacity
    element.style.opacity = '0'
    const clickHandler = (event: MouseEvent) => {
      event.preventDefault()
      this.activate(element)
    }
    if (addClickHandler) {
      element.addEventListener('click', clickHandler)
    }
    this.collisionSystem.addStaticBody(element)
    this.items.set(element, {
      element,
      originalOpacity,
      clickHandler,
      isActive: false,
      record,
    })
    if (activate) this.activate(element)
  }

  private activate(element: HTMLElement) {
    if (!this.domToWebGL || !this.pool) return

    const item = this.items.get(element)
    if (!item || item.isActive) return

    item.isActive = true
    this.collisionSystem.removeStaticBody(element)
    this.resetPointer()

    const record = this.pool.getRecord(element)
    if (!record) return

    // Keep using the currently mounted mesh; just flip flags. Avoid recycle/add to
    // prevent duplicate attachments or geometry resets that can cause size drift.
    // Reset geometry to a clean state (positions/tangents) before switching to cloth.
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

    // Seed a very small, size-relative perturbation to avoid perfectly rigid start
    // without causing a visible crumple/pop.
    const sizeHint = Math.max(0.0005, Math.min(record.widthMeters, record.heightMeters))
    const jitter = Math.min(0.004, sizeHint * 0.05)
    cloth.addTurbulence(jitter)
    // Do not auto-release pins; keep according to selected Pin Mode for predictable behavior.

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
    adapter.setWorldSleepGuardEnabled(this.debug.worldSleepGuardEnabled)
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

  /** Public: convert an active cloth element back to a static DOM-backed mesh. */
  async restoreElement(element: HTMLElement) {
    const item = this.items.get(element)
    if (!item) return
    // If not active, ensure it's mounted and visible
    if (!item.isActive) {
      this.pool?.mount(element)
      element.style.opacity = '1'
      this.collisionSystem.addStaticBody(element)
      return
    }
    // Remove from simulation and entity manager
    if (item.adapter) {
      this.simulationSystem.removeBody(item.adapter.id)
    }
    if (item.entity) {
      item.entity.destroy()
      item.entity = undefined
    }
    // Mark mesh as static again for render settings system
    const mesh = item.record?.mesh
    if (mesh) {
      const obj = mesh as unknown as { userData?: Record<string, unknown> }
      obj.userData = { ...(obj.userData || {}), isCloth: false, isStatic: true }
    }
    // Recycle and remount the DOM mesh in static mode
    if (this.pool) {
      this.pool.recycle(element)
      this.pool.resetGeometry(element)
      this.pool.mount(element)
    }
    element.style.opacity = '1'
    // Re-add the click handler to allow re-activation
    if (item.clickHandler) {
      element.addEventListener('click', item.clickHandler)
    }
    this.collisionSystem.addStaticBody(element)
    item.isActive = false
    item.cloth = undefined
    item.adapter = undefined
  }

  private animate() {
    if (this.disposed || !this.domToWebGL) return

    this.rafId = requestAnimationFrame(() => this.animate())
    const delta = Math.min(this.clock.getDelta(), 0.05)

    this.simulationRunner.update(delta)
    this.simulationRunner.getEngine().frame(delta)

    this.decayPointerImpulse()
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
    if (this.cameraSystem || this.worldRenderer || this.overlaySystem || this.renderSettingsSystem) {
      if (this.cameraSystem) this.engine.removeSystemInstance(this.cameraSystem)
      if (this.worldRenderer) this.engine.removeSystemInstance(this.worldRenderer)
      if (this.overlaySystem) this.engine.removeSystemInstance(this.overlaySystem)
      if (this.renderSettingsSystem) this.engine.removeSystemInstance(this.renderSettingsSystem)
      this.cameraSystem = null
      this.worldRenderer = null
      this.overlaySystem = null
      this.renderSettingsSystem = null
    }
    // Create a camera system and world renderer that reads snapshots each frame.
    this.cameraSystem = new CameraSystem()
    this.worldRenderer = new WorldRendererSystem({ view: this.domToWebGL, camera: this.cameraSystem })
    // Render-only systems: debug overlay + render settings (e.g., wireframe)
    this.overlayState = new DebugOverlayState()
    this.overlaySystem = new DebugOverlaySystem({ view: this.domToWebGL, state: this.overlayState })
    this.renderSettingsState = new RenderSettingsState()
    this.renderSettingsSystem = new RenderSettingsSystem({ view: this.domToWebGL, state: this.renderSettingsState })
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

  private resetPointer() {
    this.pointer.active = false
    this.pointer.needsImpulse = false
    this.pointer.velocity.set(0, 0)
    // Keep overlay pointer at last known position to avoid visual teleport
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
    // Pointer collider radius: derive using shared helper; prefer first active item, else first available
    let r = 0.01
    let found = false
    for (const item of this.items.values()) {
      if (!item.isActive) continue
      r = this.computePointerRadiusFor(item)
      found = true
      break
    }
    if (!found) {
      for (const item of this.items.values()) {
        r = this.computePointerRadiusFor(item)
        found = true
        break
      }
    }
    this.overlayState.pointerRadius = r
  }

  /** Computes pointer collider radius in meters mirroring ClothBodyAdapter.getImpulseRadius logic. */
  private computePointerRadiusFor(item: ClothItem) {
    const attr = item.element.dataset.clothImpulseRadius
    const parsed = attr ? Number.parseFloat(attr) : NaN
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
    const record = item.record
    const widthMeters = record?.widthMeters ?? 0
    const heightMeters = record?.heightMeters ?? 0
    const base = Math.min(widthMeters, heightMeters)
    const MIN_POINTER_RADIUS = 0.0006
    const DEFAULT_POINTER_RADIUS = 0.0012
    if (base > 0) {
      return Math.max(MIN_POINTER_RADIUS, base / 12)
    }
    return DEFAULT_POINTER_RADIUS
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
      if (!item.cloth) continue
      item.cloth.setGravity(new THREE.Vector3(0, -gravity, 0))
      item.cloth.wake()
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

  /** Enables/disables world-space sleep guard on all active adapters and future bodies. */
  setWorldSleepGuardEnabled(enabled: boolean) {
    this.debug.worldSleepGuardEnabled = !!enabled
    for (const item of this.items.values()) {
      item.adapter?.setWorldSleepGuardEnabled(this.debug.worldSleepGuardEnabled)
    }
  }

  async setTessellationSegments(segments: number, force = false) {
    const pool = this.pool
    if (!pool) return
    const clamped = Math.max(1, Math.min(segments, 32))
    if (!force && this.debug.tessellationSegments === clamped) return
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

  /** Enables/disables automatic tessellation based on on-screen size. */
  setTessellationAutoEnabled(enabled: boolean) {
    this.debug.autoTessellation = !!enabled
    if (this.debug.autoTessellation) {
      void this.setTessellationSegments(this.debug.tessellationSegments, true)
    }
  }

  /** Sets the min/max caps used by auto tessellation. */
  setTessellationMinMax(min: number, max: number) {
    const mi = Math.max(1, Math.min(46, Math.round(min)))
    const ma = Math.max(mi + 2, Math.min(48, Math.round(max)))
    this.debug.tessellationMin = mi
    this.debug.tessellationMax = ma
    if (this.debug.autoTessellation) {
      void this.setTessellationSegments(this.debug.tessellationSegments, true)
    }
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
}
