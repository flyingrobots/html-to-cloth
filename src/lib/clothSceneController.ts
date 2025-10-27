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
import type { Entity } from '../engine/entity/entity'
import type { Component } from '../engine/entity/component'
import { SimWorld, type SimBody, type SimWarmStartConfig, type SimSleepConfig } from './simWorld'

const WARM_START_PASSES = 2

export type PinMode = 'top' | 'bottom' | 'corners' | 'none'

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
  }

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
  }

  setConstraintIterations(iterations: number) {
    this.item.cloth?.setConstraintIterations(iterations)
  }

  setGlobalGravity(gravity: THREE.Vector3) {
    this.item.cloth?.setGravity(gravity)
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
    const base = Math.max(widthMeters, heightMeters)
    return base > 0 ? base / 2 : 0.25
  }

  private getImpulseStrength() {
    const attr = this.item.element.dataset.clothImpulseStrength
    const parsed = attr ? Number.parseFloat(attr) : NaN
    const elementStrength = !Number.isNaN(parsed) && parsed > 0 ? parsed : 1
    return elementStrength * this.debug.impulseMultiplier
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

  /**
   * Creates a new cloth scene controller. All dependencies are optional and may be supplied to
   * facilitate testing or reuse across projects.
   */
  constructor(options: ClothSceneControllerOptions = {}) {
    this.simWorld = options.simWorld ?? new SimWorld()
    this.simulationSystem = options.simulationSystem ?? new SimulationSystem({ simWorld: this.simWorld })

    this.engine = options.engine ?? new EngineWorld()
    this.engine.addSystem(this.simulationSystem, { priority: 100 })

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
    // Pause, then detach; onDetach() will clear once.
    this.setRealTime(false)
    this.engine.removeSystem(this.simulationSystem.id)
    this.elementIds.clear()
  }

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
    cloth.setGravity(gravityVector)

    cloth.addTurbulence(0.06)
    item.releasePinsTimeout = window.setTimeout(() => {
      cloth.releaseAllPins()
      delete item.releasePinsTimeout
    }, 900)

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
    this.simulationSystem.addBody(adapter, {
      warmStart: this.createWarmStartConfig(),
      sleep: this.sleepConfig,
    })
    const entity = this.entities.createEntity({ id: adapterId, name: element.id })
    entity.addComponent(adapter)
    item.adapter = adapter
    item.entity = entity
    element.removeEventListener('click', item.clickHandler)
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
    // Create a camera system and world renderer that reads snapshots each frame.
    this.cameraSystem = new CameraSystem()
    this.worldRenderer = new WorldRendererSystem({ view: this.domToWebGL, camera: this.cameraSystem })
    // Debug overlay state/system for render-only gizmos (e.g., pointer collider)
    this.overlayState = new DebugOverlayState()
    this.overlaySystem = new DebugOverlaySystem({ view: this.domToWebGL as any, state: this.overlayState })
    // Register with lower priority than simulation so render sees the latest snapshot.
    this.engine.addSystem(this.cameraSystem, { priority: 50, allowWhilePaused: true })
    this.engine.addSystem(this.worldRenderer, { priority: 10, allowWhilePaused: true })
    this.engine.addSystem(this.overlaySystem, { priority: 5, allowWhilePaused: true })
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
    // overlay pointer updated elsewhere
  }

  private resetPointer() {
    this.pointer.active = false
    this.pointer.needsImpulse = false
    this.pointer.velocity.set(0, 0)
    this.overlayState?.pointer.set(0, 0)
    // overlay pointer updated elsewhere
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
    this.debug.wireframe = enabled
    for (const item of this.items.values()) {
      const material = item.record?.mesh.material as THREE.MeshBasicMaterial | undefined
      if (material) {
        material.wireframe = enabled
      }
    }
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
    const clamped = Math.max(1, Math.round(substeps))
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
