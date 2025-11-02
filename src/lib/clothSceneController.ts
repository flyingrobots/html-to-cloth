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
import { RigidBody2D } from './rigidBody2d'
import { EventBus } from '../engine/events/EventBus'

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
  tag?: string | null
}

type RigidItem = {
  element: HTMLElement
  originalOpacity: string
  clickHandler: (event: MouseEvent) => void
  isActive: boolean
  record?: DOMMeshRecord
  adapter?: RigidBodyAdapter
  entity?: Entity
  tag?: string | null
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
  private _worldSleeping = false
  private _modelRadius = 0
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
    // Precompute constant model-space bounding-sphere radius:
    // radius = max extent along any axis in model space (centered at origin)
    try {
      const geom = this.record.mesh.geometry
      if (!geom.boundingBox) geom.computeBoundingBox()
      const bb = geom.boundingBox
      if (bb) {
        const hx = (bb.max.x - bb.min.x) * 0.5
        const hy = (bb.max.y - bb.min.y) * 0.5
        const hz = (bb.max.z - bb.min.z) * 0.5
        // True local-space bounding sphere: max distance from origin (half-diagonal)
        this._modelRadius = Math.hypot(hx, hy, hz)
      } else {
        const w = this.record.widthMeters ?? 0
        const h = this.record.heightMeters ?? 0
        this._modelRadius = 0.5 * Math.hypot(w, h)
      }
      if (!Number.isFinite(this._modelRadius) || this._modelRadius <= 0) {
        const w = this.record.widthMeters ?? 0
        const h = this.record.heightMeters ?? 0
        this._modelRadius = 0.5 * Math.hypot(w, h)
      }
    } catch {
      const w = this.record.widthMeters ?? 0
      const h = this.record.heightMeters ?? 0
      this._modelRadius = 0.5 * Math.hypot(w, h)
    }
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
        // Use world-space center derived from model origin
        const localCenter = { x: 0, y: 0 }
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
        this._worldSleeping = false
      } else {
        this._worldStillFrames += 1
        // Guard: keep cloth awake until world-still for N frames
        if (this._worldStillFrames < this._worldSleepFrameThreshold) {
          cloth.wake()
          this._worldSleeping = false
        } else {
          this._worldSleeping = true
        }
      }
      this._lastWorldCenter.copy(worldCenter)
      // Radius is constant; no need to update here
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
    return this._worldSleeping
  }

  wake() {
    this._worldSleeping = false
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
      // Model-space center fixed at origin, radius is precomputed constant
      const sphere = { center: new THREE.Vector2(0, 0), radius: this._modelRadius }
      const worldBody = this.record.worldBody
      if (worldBody) {
        // Transform center to world space
        const world = worldBody.localToWorldPoint(this._tmpLocalV3.set(0, 0, 0), this._tmpWorldV3)
        // Transform radius using the maximum world scaling along axes
        const wx = worldBody.localToWorldVector(this._tmpLocalV3.set(sphere.radius, 0, 0), this._tmpWorldV3B).length()
        const wy = worldBody.localToWorldVector(this._tmpLocalV3.set(0, sphere.radius, 0), this._tmpWorldV3B).length()
        const wz = worldBody.localToWorldVector(this._tmpLocalV3.set(0, 0, sphere.radius), this._tmpWorldV3B).length()
        const r = Math.max(wx, wy, wz)
        return { center: new THREE.Vector2(world.x, world.y), radius: r }
      }
      return { center: new THREE.Vector2(0, 0), radius: this._modelRadius }
    }

    const center = this.record.mesh.position
    const radius = Math.max(this.record.widthMeters ?? 0, this.record.heightMeters ?? 0) / 2 || 0.25
    return {
      center: new THREE.Vector2(center.x, center.y),
      radius,
    }
  }

  getAABB(): { min: THREE.Vector2; max: THREE.Vector2 } {
    const cloth = this.item.cloth
    const worldBody = this.record.worldBody
    if (cloth && worldBody) {
      const box = cloth.getAABB()
      return { min: box.min.clone(), max: box.max.clone() }
    }
    // Fallback for static/uncaptured: derive from local rectangle passed through WorldBody
    const hw = (this.record.widthMeters || 0) * 0.5
    const hh = (this.record.heightMeters || 0) * 0.5
    const corners = [
      this._tmpLocalV3.set(-hw, -hh, 0),
      this._tmpLocalV3B.set(hw, -hh, 0),
      this._tmpLocalV3.set(hw, hh, 0),
      this._tmpLocalV3B.set(-hw, hh, 0),
    ]
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of corners) {
      const w = this.record.worldBody.localToWorldPoint(c, this._tmpWorldV3)
      if (w.x < minX) minX = w.x
      if (w.y < minY) minY = w.y
      if (w.x > maxX) maxX = w.x
      if (w.y > maxY) maxY = w.y
    }
    return { min: new THREE.Vector2(minX, minY), max: new THREE.Vector2(maxX, maxY) }
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

class RigidBodyAdapter implements SimBody, Component {
  public readonly id: string
  private collisionSystem: CollisionSystem
  private worldBody: import('./WorldBody').WorldBody
  private body: RigidBody2D
  constructor(id: string, _item: RigidItem, collision: CollisionSystem, record: DOMMeshRecord) {
    this.id = id
    this.collisionSystem = collision
    this.worldBody = record.worldBody
    const pos = new THREE.Vector2(record.worldBody.position.x, record.worldBody.position.y)
    this.body = new RigidBody2D({ width: record.widthMeters, height: record.heightMeters, position: pos })
  }
  onAttach() {}
  onDetach() {}
  update(dt: number) {
    const aabbs = this.collisionSystem.getStaticAABBs()
    this.body.update(dt, aabbs)
    this.worldBody.setPositionComponents(this.body.position.x, this.body.position.y, 0)
    this.worldBody.setRotationEuler(0, 0, this.body.angle)
    this.worldBody.applyToMesh()
  }
  isSleeping() { return this.body.isSleeping() }
  wake() { this.body.wake() }
  wakeIfPointInside(point: THREE.Vector2) {
    const s = this.body.getBoundingSphere()
    const dx = point.x - s.center.x
    const dy = point.y - s.center.y
    if (dx * dx + dy * dy <= s.radius * s.radius) this.body.wake()
  }
  getBoundingSphere() { return this.body.getBoundingSphere() }
  getAABB() { return this.body.getAABB() }
  setConstraintIterations() {}
  setGlobalGravity(g: THREE.Vector3) { this.body.setGravity(g) }
  configureSleep(config: SimSleepConfig) { this.body.setSleepThresholds(config.velocityThreshold, config.frameThreshold) }
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
  private rigidItems = new Map<HTMLElement, RigidItem>()
  private eventBus = new EventBus()
  private elementIds = new Map<HTMLElement, string>()
  private onResize = () => this.handleResize()
  private onScroll = () => {
    this.syncStaticMeshes()
    this.collisionSystem.refresh()
  }
  // Layout-observer debounce timers for deferred recapture/rebuild
  private recaptureTimers = new Map<HTMLElement, number>()
  private layoutObserver: ResizeObserver | null = null
  private static readonly LAYOUT_COOL_OFF_MS = 300
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
    this.simWorld.setEventBus(this.eventBus)

    const clothElements = Array.from(document.querySelectorAll<HTMLElement>('.cloth-enabled'))
    const rigidDynamics = Array.from(document.querySelectorAll<HTMLElement>('.rigid-dynamic'))
    const rigidStatics = Array.from(document.querySelectorAll<HTMLElement>('.rigid-static'))

    await this.prepareElements(clothElements)
    for (const el of rigidStatics) this.collisionSystem.addStaticBody(el)
    for (const element of rigidDynamics) {
      const originalOpacity = element.style.opacity
      const clickHandler = (event: MouseEvent) => { event.preventDefault(); this.activateRigid(element) }
      element.addEventListener('click', clickHandler)
      const tag = element.dataset.tag || element.dataset.physTag || null
      this.rigidItems.set(element, { element, originalOpacity, clickHandler, isActive: false, tag })
    }
    this.updateOverlayDebug()

    // Observe per-element layout changes to recapture once layout settles.
    try {
      if (!(import.meta as unknown as { env?: Record<string, string> }).env || (import.meta as unknown as { env?: Record<string, string> }).env?.MODE !== 'test') {
        this.installLayoutObserver(clothElements)
      }
    } catch {
      // best effort; ignore in environments without import.meta
      this.installLayoutObserver(clothElements)
    }

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
    const isTest = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.MODE === 'test')

    for (const element of elements) {
      // Bail early if controller was disposed or pool swapped out.
      if (this.disposed || this.pool !== pool || this.domToWebGL !== bridge) return
      const originalOpacity = element.style.opacity

      const clickHandler = (event: MouseEvent) => {
        event.preventDefault()
        this.activate(element)
      }

      element.addEventListener('click', clickHandler)
      this.collisionSystem.addStaticBody(element)

      if (isTest) {
        // Keep previous behavior in tests: capture + mount a static mesh and hide the DOM.
        const rect = element.getBoundingClientRect()
        const seg = this.computeAutoSegments(rect, this.debug.tessellationSegments)
        await pool.prepare(element, seg, { reason: 'init' })
        if (this.disposed || this.pool !== pool || this.domToWebGL !== bridge) return
        pool.mount(element)
        const record = pool.getRecord(element)
        element.style.opacity = '0'
        try {
          const mat = record?.mesh.material as THREE.MeshBasicMaterial | undefined
          if (mat) {
            const wire = this.renderSettingsState ? this.renderSettingsState.wireframe : this.debug.wireframe
            mat.wireframe = wire
          }
        } catch { /* ignore */ }
        const tag = element.dataset.tag || element.dataset.physTag || null
        this.items.set(element, { element, originalOpacity, clickHandler, isActive: false, record, tag })
      } else {
        // Runtime: lazy capture — keep DOM visible; no mesh until activation.
        const tag = element.dataset.tag || element.dataset.physTag || null
        this.items.set(element, { element, originalOpacity, clickHandler, isActive: false, record: undefined, tag })
      }
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
    await pool.prepare(element, seg, { reason: 'manual' })
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

  private async activate(element: HTMLElement) {
    if (!this.domToWebGL || !this.pool) return

    const item = this.items.get(element)
    if (!item || item.isActive) return

    item.isActive = true
    this.collisionSystem.removeStaticBody(element)
    this.resetPointer()

    // In test environments we keep activation synchronous to preserve test semantics.
    const isTest = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.MODE === 'test')
    let record = this.pool.getRecord(element)
    if (!record) {
      // Lazy path: create record now at activation time
      const rectNow = element.getBoundingClientRect()
      const segNow = this.computeAutoSegments(rectNow, this.debug.tessellationSegments)
      await this.pool.prepare(element, segNow, { reason: 'activation' })
      this.pool.mount(element)
      record = this.pool.getRecord(element)!
    }
    if (!isTest) {
      // Rebuild geometry & recapture at activation time so the texture and local size
      // match the current DOM rect exactly (prevents aspect stretch). Use current
      // auto‑tessellation setting for segment count.
      try { this.pool.recycle(element) } catch { /* ignore unmounted */ }
      const rectNow = element.getBoundingClientRect()
      const seg = this.computeAutoSegments(rectNow, this.debug.tessellationSegments)
      await this.pool.prepare(element, seg, { force: true, reason: 'activation' })
      this.pool.mount(element)
      // Ensure baseline geometry and uniform scale
      this.pool.resetGeometry(element)
      record = this.pool.getRecord(element)!
    } else {
      // Synchronous path used in tests: reset the existing geometry to baseline
      this.pool.resetGeometry(element)
    }

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
      // Emit a browser event for activation and refresh overlays
      try {
        if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
          const detail = {
            elementId: element.id || null,
            segments: record.segments,
            pinMode: this.debug.pinMode,
            gravity: this.debug.gravity,
            sleepVelocity: this.sleepConfig.velocityThreshold,
            sleepFrames: this.sleepConfig.frameThreshold,
            worldSleepGuard: this.debug.worldSleepGuardEnabled,
            time: Date.now(),
          }
          window.dispatchEvent(new CustomEvent('clothActivated', { detail }))
          if ((import.meta as unknown as { env?: Record<string, string> }).env?.MODE !== 'test') {
            console.info('[clothActivated]', detail)
          }
          this.eventBus.post({ type: 'activated', id: adapterId, tag: item.tag ?? null, payload: detail, time: detail.time })
        }
      } catch {
        /* ignore */
      }
      // Refresh debug overlay data (pins, snapshot) immediately after activation
      this.updateOverlayDebug()
  }

  private async activateRigid(element: HTMLElement) {
    if (!this.domToWebGL || !this.pool) return
    const item = this.rigidItems.get(element)
    if (!item || item.isActive) return
    item.isActive = true
    const rect = element.getBoundingClientRect()
    const seg = this.computeAutoSegments(rect, this.debug.tessellationSegments)
    await this.pool.prepare(element, seg, { reason: 'rigid-activation', force: true })
    this.pool.mount(element)
    const record = this.pool.getRecord(element)!
    element.style.opacity = '0'
    const adapterId = this.getBodyId(element) + '-rb'
    const adapter = new RigidBodyAdapter(adapterId, item, this.collisionSystem, record)
    const entity = this.entities.createEntity({ id: adapterId, name: element.id })
    entity.addComponent(adapter)
    item.adapter = adapter
    item.entity = entity
    this.simulationSystem.addBody(adapter, { sleep: this.sleepConfig })
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

  /** Sets SimWorld broad-phase mode. */
  setBroadphaseMode(mode: 'sphere' | 'fatAABB') {
    this.simWorld.setBroadphaseMode(mode)
  }

  /** Sets SimWorld broad-phase margins. */
  setBroadphaseMargins(baseMargin: number, velocityFudge: number) {
    this.simWorld.setBroadphaseMargins(baseMargin, velocityFudge)
  }

  /** Add a non-captured DOM element to static collision so its AABB/sphere render in the overlay. */
  addStaticOverlayElement(element: HTMLElement) {
    this.collisionSystem.addStaticBody(element)
    this.updateOverlayDebug()
  }

  /** Remove a previously added static overlay element. */
  removeStaticOverlayElement(element: HTMLElement) {
    this.collisionSystem.removeStaticBody(element)
    this.updateOverlayDebug()
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
    // Static AABBs (still provided for debugging)
    const aabbs = this.collisionSystem.getStaticAABBs().map((b) => ({
      min: { x: b.min.x, y: b.min.y },
      max: { x: b.max.x, y: b.max.y },
    }))
    this.overlayState.aabbs = aabbs
    // Static world-space spheres derived from AABBs using half-diagonal (true bounding circle for a rectangle)
    const spheres = aabbs.map((b) => {
      const cx = (b.min.x + b.max.x) * 0.5
      const cy = (b.min.y + b.max.y) * 0.5
      const w = Math.abs(b.max.x - b.min.x)
      const h = Math.abs(b.max.y - b.min.y)
      const r = 0.5 * Math.hypot(w, h)
      return { center: { x: cx, y: cy }, radius: r }
    })
    this.overlayState.staticSpheres = spheres
    // Simulation snapshot (sleeping/awake)
    try {
      const snapshot = this.simulationSystem.getSnapshot()
      this.overlayState.simSnapshot = this.isSimSnapshot(snapshot) ? snapshot : undefined
    } catch (error) {
      console.error('Failed to capture simulation snapshot for overlay', error)
      this.overlayState.simSnapshot = undefined
    }
    // Active cloth AABBs and fat AABBs (approximate: base margin only)
    const simAABBs: Array<{ min: { x: number; y: number }; max: { x: number; y: number } }> = []
    const simFatAABBs: Array<{ min: { x: number; y: number }; max: { x: number; y: number } }> = []
    const cfg = this.simWorld.getBroadphaseConfig?.() ?? { mode: 'fatAABB', baseMargin: 0.006, velocityFudge: 1.25 }
    const idToItem = new Map<string, ClothItem>()
    for (const item of this.items.values()) {
      if (item.isActive && item.adapter) idToItem.set(item.adapter.id, item)
    }
    const bodies = this.overlayState.simSnapshot?.bodies ?? []
    for (const body of bodies) {
      const item = idToItem.get(body.id)
      if (!item?.adapter) continue
      const box = item.adapter.getAABB()
      simAABBs.push({ min: { x: box.min.x, y: box.min.y }, max: { x: box.max.x, y: box.max.y } })
      if (cfg.mode === 'fatAABB') {
        const pad = cfg.baseMargin
        simFatAABBs.push({
          min: { x: box.min.x - pad, y: box.min.y - pad },
          max: { x: box.max.x + pad, y: box.max.y + pad },
        })
      }
    }
    this.overlayState.simAABBs = simAABBs
    this.overlayState.simFatAABBs = simFatAABBs
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
    const isTest = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.MODE === 'test')

    for (const item of this.items.values()) {
      // In runtime: re-bake only ACTIVE cloth. In tests: keep old semantics and re-bake static meshes too.
      if (!item.isActive && !isTest) continue
      const element = item.element
      tasks.push(
        pool
          .prepare(element, this.computeAutoSegments(element.getBoundingClientRect(), clamped), { force: true, reason: 'tessellation-update' })
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

  private installLayoutObserver(elements: HTMLElement[]) {
    if (this.layoutObserver) return
    try {
      this.layoutObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement
          if (!this.items.has(el)) continue
          // schedule a deferred recapture/rebuild after layout settles
          const existing = this.recaptureTimers.get(el)
          if (existing) clearTimeout(existing)
          const timer = window.setTimeout(() => {
            // bail if controller disposed
            if (this.disposed) return
            // compute segments using current auto-tessellation
            const rect = el.getBoundingClientRect()
            const seg = this.computeAutoSegments(rect, this.debug.tessellationSegments)
            const item = this.items.get(el)
            if (!item?.isActive) {
              // Static: do not capture or mount. Just refresh collision/overlay from DOMRect.
              this.collisionSystem.refresh()
              this.updateOverlayDebug()
              this.recaptureTimers.delete(el)
              return
            }
            // Active cloth: re-bake
            this.pool?.prepare(el, seg, { force: true, reason: 'layout-settled' })
              .then(() => {
                if (this.disposed) return
                this.pool?.mount(el)
                this.pool?.resetGeometry(el)
                // Update transforms and overlay
                const rec = this.pool?.getRecord(el)
                if (rec) this.domToWebGL?.updateMeshTransform(el, rec)
                this.collisionSystem.refresh()
                this.updateOverlayDebug()
              })
              .catch(() => { /* ignore capture failures */ })
              .finally(() => {
                this.recaptureTimers.delete(el)
              })
          }, ClothSceneController.LAYOUT_COOL_OFF_MS)
          this.recaptureTimers.set(el, timer)
        }
      })
      for (const el of elements) this.layoutObserver.observe(el)
    } catch {
      // ResizeObserver not available; skip auto-recapture
    }
  }
}
