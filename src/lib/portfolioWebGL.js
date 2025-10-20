import * as THREE from 'three'
import { DOMToWebGL } from './domToWebGL'
import { ClothPhysics } from './clothPhysics'
import { CollisionSystem } from './collisionSystem'
import { CANONICAL_HEIGHT_METERS, CANONICAL_WIDTH_METERS } from './units'
import { ElementPool } from './elementPool'
import { SimulationScheduler } from './simulationScheduler'

const FIXED_DT = 1 / 60
const MAX_ACCUMULATED_TIME = FIXED_DT * 5
const WARM_START_PASSES = 2
const DEFAULT_POINTER_RADIUS = 0.0012
const MIN_POINTER_RADIUS = 0.0006
const POINTER_RADIUS_DIVISOR = 12
const DEFAULT_TURBULENCE = 0.06
const DEFAULT_PIN_RELEASE_MS = 900
const DEFAULT_LABEL = 'Cloth Element'

/**
 * @typedef {import('./domToWebGL.js').DOMMeshRecord} DOMMeshRecord
 * @typedef {'top' | 'bottom' | 'corners' | 'none'} PinMode
 * @typedef {Object} DebugSettings
 * @property {boolean} realTime
 * @property {boolean} wireframe
 * @property {number} gravity
 * @property {number} impulseMultiplier
 * @property {number} constraintIterations
 * @property {number} substeps
 * @property {number} tessellationSegments
 * @property {boolean} pointerCollider
 * @property {PinMode} pinMode
 * @typedef {Object} PointerState
 * @property {THREE.Vector2} position
 * @property {THREE.Vector2} previous
 * @property {THREE.Vector2} velocity
 * @property {boolean} active
 * @property {boolean} needsImpulse
 * @property {number} radius
 * @typedef {Object} ClothItem
 * @property {string} id
 * @property {string} label
 * @property {HTMLElement} element
 * @property {ClothPhysics | undefined} cloth
 * @property {string} originalOpacity
 * @property {(event: MouseEvent) => void} clickHandler
 * @property {boolean} isActive
 * @property {DOMMeshRecord | undefined} record
 * @property {ClothBodyAdapter | undefined} adapter
 */

class ClothBodyAdapter {
  /**
   * @param {string} id
   * @param {ClothItem} item
   * @param {PointerState} pointer
   * @param {CollisionSystem} collisionSystem
   * @param {() => void} handleOffscreen
   * @param {DOMMeshRecord} record
   * @param {{ impulseMultiplier: number }} debug
   */
  constructor(id, item, pointer, collisionSystem, handleOffscreen, record, debug) {
    this.id = id
    this.item = item
    this.pointer = pointer
    this.collisionSystem = collisionSystem
    this.handleOffscreen = handleOffscreen
    this.record = record
    this.debug = debug
  }

  update(dt) {
    const cloth = this.item.cloth
    if (!cloth) return

    const radius = this._getImpulseRadius()
    this.pointer.radius = radius

    if (this.pointer.needsImpulse) {
      const strength = this._getImpulseStrength()
      const scaledForce = this.pointer.velocity.clone().multiplyScalar(strength)
      cloth.applyImpulse(this.pointer.position, scaledForce, radius)
      this.pointer.needsImpulse = false
    }

    const checkSleep = typeof cloth.isSleeping === 'function'
    const sleepingBefore = checkSleep ? cloth.isSleeping() : false
    cloth.update(dt)
    const sleepingAfter = checkSleep ? cloth.isSleeping() : false
    this.collisionSystem.apply(cloth)

    if (cloth.isOffscreen(-CANONICAL_HEIGHT_METERS)) {
      this.handleOffscreen()
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

  wakeIfPointInside(point) {
    this.item.cloth?.wakeIfPointInside(point)
  }

  _getImpulseRadius() {
    const attr = this.item.element.dataset.clothImpulseRadius
    const parsed = attr ? Number.parseFloat(attr) : NaN
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
    const { widthMeters = 0, heightMeters = 0 } = this.record ?? {}
    const base = Math.min(widthMeters || 0, heightMeters || 0)
    if (base > 0) {
      return Math.max(MIN_POINTER_RADIUS, base / POINTER_RADIUS_DIVISOR)
    }
    return DEFAULT_POINTER_RADIUS
  }

  _getImpulseStrength() {
    const attr = this.item.element.dataset.clothImpulseStrength
    const parsed = attr ? Number.parseFloat(attr) : NaN
    const elementStrength = !Number.isNaN(parsed) && parsed > 0 ? parsed : 1
    return elementStrength * this.debug.impulseMultiplier
  }
}

export class PortfolioWebGL {
  constructor() {
    this.domToWebGL = null
    this.collisionSystem = new CollisionSystem()
    this.items = new Map()
    this.rafId = null
    this.clock = new THREE.Clock()
    this.disposed = false
    this.pool = null
    this.scheduler = new SimulationScheduler()
    this.accumulator = 0
    this.elementIds = new Map()
    this.pointer = {
      position: new THREE.Vector2(),
      previous: new THREE.Vector2(),
      velocity: new THREE.Vector2(),
      active: false,
      needsImpulse: false,
      radius: DEFAULT_POINTER_RADIUS,
    }
    this.pointerHelper = null
    this.pointerHelperAttached = false
    this.pointerColliderVisible = false
    this.pointerInteractionEnabled = true
    this.autoRelease = true
    this.showAabbs = false
    this.pendingStaticRefresh = null
    this.showSleepState = false
    this.aabbHelpers = new Map()
    this.debugGroup = new THREE.Group()
    this.debugGroup.renderOrder = 10
    this.debugGroup.visible = false
    this.debug = {
      realTime: true,
      wireframe: false,
      gravity: 2,
      impulseMultiplier: 1,
      constraintIterations: 4,
      substeps: 1,
      tessellationSegments: 24,
      pointerCollider: false,
      pinMode: 'top',
    }

    this.onResize = () => this._handleResize()
    this.onScroll = () => {
      this._syncStaticMeshes()
      this.collisionSystem.refresh()
    }
    this.onPointerMove = (event) => this._handlePointerMove(event)
    this.onPointerLeave = () => this._resetPointer()
  }

  async init() {
    if (this.domToWebGL) return

    this.domToWebGL = new DOMToWebGL(document.body)
    this.pool = new ElementPool(this.domToWebGL)
    this.domToWebGL.scene.add(this.debugGroup)
    this.debugGroup.visible = this.showAabbs
    const viewport = this.domToWebGL.getViewportPixels()
    this.collisionSystem.setViewportDimensions(viewport.width, viewport.height)

    const clothElements = Array.from(
      document.querySelectorAll('.cloth-enabled')
    )

    if (!clothElements.length) return

    await this._prepareElements(clothElements)

    window.addEventListener('resize', this.onResize, { passive: true })
    window.addEventListener('scroll', this.onScroll, { passive: true })
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('pointerup', this.onPointerLeave, { passive: true })
    window.addEventListener('pointerleave', this.onPointerLeave, { passive: true })
    window.addEventListener('pointercancel', this.onPointerLeave, { passive: true })

    this.clock.start()
    this._animate()

    if (this.pointerColliderVisible) {
      this.setPointerColliderVisible(true)
    }
  }

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
      const material = this.pointerHelper.material
      if (material && typeof material.dispose === 'function') {
        material.dispose()
      }
      this.pointerHelper = null
      this.pointerHelperAttached = false
    }

    this._clearAabbHelpers()
    if (this.domToWebGL) {
      this.domToWebGL.scene.remove(this.debugGroup)
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

  async _prepareElements(elements) {
    const domBridge = this.domToWebGL
    const pool = this.pool
    if (!domBridge || !pool || this.disposed) return

    for (const element of elements) {
      if (this.disposed) return

      await pool.prepare(element, this.debug.tessellationSegments)
      if (this.disposed) return
      pool.mount(element)

      const record = pool.getRecord(element)
      if (record) {
        record.physics = record.physics ?? {}
        if (record.physics.pinMode === undefined) {
          record.physics.pinMode = this.debug.pinMode
          this._updateDatasetWithPhysics({ element, record })
        }
      }

      const originalOpacity = element.style.opacity
      element.style.opacity = '0'

      const clickHandler = (event) => {
        event.preventDefault()
        this._activate(element)
      }

      element.addEventListener('click', clickHandler)
      this.collisionSystem.addStaticBody(element)

      const id = this._getBodyId(element)
      const label = this._deriveLabel(element, id)

      this.items.set(element, {
        id,
        label,
        element,
        originalOpacity,
        clickHandler,
        isActive: false,
        record,
      })
    }
    this._syncStaticMeshes()
  }

  _activate(element) {
    if (!this.domToWebGL || !this.pool) return

    const item = this.items.get(element)
    if (!item || item.isActive) return

    item.isActive = true
    if (!item.id) {
      item.id = this._getBodyId(element)
    }
    if (!item.label) {
      item.label = this._deriveLabel(element, item.id)
    }
    this.collisionSystem.removeStaticBody(element)
    this._resetPointer()

    const record = this.pool.getRecord(element)
    if (!record) return

    this.pool.resetGeometry(element)

    const physics = record.physics ?? {}
    const damping = physics.damping ?? 0.97
    const iterations = physics.constraintIterations ?? this.debug.constraintIterations
    const substeps = physics.substeps ?? this.debug.substeps
    const density = physics.density ?? 1
    const turbulence = physics.turbulence ?? DEFAULT_TURBULENCE
    let releaseDelayMs = physics.releaseDelayMs ?? DEFAULT_PIN_RELEASE_MS
    if (!this.autoRelease) {
      releaseDelayMs = null
    }
    const pinOverride = physics.pinMode

    const cloth = new ClothPhysics(record.mesh, {
      damping,
      constraintIterations: iterations,
    })

    cloth.setConstraintIterations(iterations)
    cloth.setSubsteps(substeps)
    this._applyPinMode(cloth, pinOverride ?? this.debug.pinMode)

    const gravityVector = new THREE.Vector3(0, -(this.debug.gravity * density), 0)
    this._runWarmStart(cloth)
    cloth.setGravity(gravityVector)

    cloth.addTurbulence(turbulence)
    if (releaseDelayMs !== null && releaseDelayMs !== undefined) {
      setTimeout(() => cloth.releaseAllPins(), Math.max(0, releaseDelayMs))
    }

    item.cloth = cloth
    item.record = record
    const material = record.mesh.material
    if (material && 'wireframe' in material) {
      material.wireframe = this.debug.wireframe
    }
    const adapterId = this._getBodyId(element)
    const adapter = new ClothBodyAdapter(
      adapterId,
      item,
      this.pointer,
      this.collisionSystem,
      () => this._handleClothOffscreen(item),
      record,
      this.debug
    )
    this.scheduler.addBody(adapter)
    item.adapter = adapter
    element.removeEventListener('click', item.clickHandler)
  }

  _animate() {
    if (this.disposed || !this.domToWebGL) return

    this.rafId = requestAnimationFrame(() => this._animate())
    const delta = Math.min(this.clock.getDelta(), 0.05)

    if (this.debug.realTime) {
      this.accumulator = Math.min(this.accumulator + delta, MAX_ACCUMULATED_TIME)
      while (this.accumulator >= FIXED_DT) {
        this._stepCloth(FIXED_DT)
        this.accumulator -= FIXED_DT
      }
    }

    this._decayPointerImpulse()
    this._updatePointerHelper()
    this._updateDebugOverlays()
    this.domToWebGL.render()
  }

  _scheduleStaticRefresh() {
    if (this.pendingStaticRefresh) return
    this.pendingStaticRefresh = this._refreshStaticRecords().finally(() => {
      this.pendingStaticRefresh = null
    })
  }

  async _refreshStaticRecords() {
    const pool = this.pool
    if (!pool) return
    const tasks = []

    for (const item of this.items.values()) {
      if (item.isActive) continue
      const element = item.element
      tasks.push((async () => {
        const prevOpacity = element.style.opacity
        const prevPointer = element.style.pointerEvents
        const shouldUnhide = prevOpacity === '0'
        if (shouldUnhide) {
          element.style.opacity = item.originalOpacity ?? ''
          element.style.pointerEvents = 'none'
        }
        try {
          await pool.prepare(element, this.debug.tessellationSegments, { force: true })
        } finally {
          if (shouldUnhide) {
            element.style.opacity = prevOpacity
            element.style.pointerEvents = prevPointer
          }
        }
        pool.mount(element)
        item.record = pool.getRecord(element)
        const material = item.record?.mesh.material
        if (material && 'wireframe' in material) {
          material.wireframe = this.debug.wireframe
        }
      })())
    }

    await Promise.all(tasks)
    this.collisionSystem.refresh()
    this._updateDebugOverlays()
  }


  _handleResize() {
    if (!this.domToWebGL) return
    this.domToWebGL.resize()
    const viewport = this.domToWebGL.getViewportPixels()
    this.collisionSystem.setViewportDimensions(viewport.width, viewport.height)
    this.collisionSystem.refresh()
    this._syncStaticMeshes()
    this._scheduleStaticRefresh()
  }

  _syncStaticMeshes() {
    if (!this.domToWebGL) return

    for (const item of this.items.values()) {
      if (item.isActive) continue
      const record = this.pool?.getRecord(item.element)
      if (record) {
        this.domToWebGL.updateMeshTransform(item.element, record)
      }
    }
  }

  _handlePointerMove(event) {
    if (!this.domToWebGL || !this.pointerInteractionEnabled) return
    const canonical = this.domToWebGL.pointerToCanonical(event.clientX, event.clientY)
    const x = canonical.x
    const y = canonical.y

    this.pointer.previous.copy(this.pointer.position)
    this.pointer.position.set(x, y)

    if (!this.pointer.active) {
      this.pointer.active = true
      this.pointer.previous.copy(this.pointer.position)
      this.scheduler.notifyPointer(this.pointer.position)
      this._updatePointerHelper()
      return
    }

    this.pointer.velocity.copy(this.pointer.position).sub(this.pointer.previous)
    const speedSq = this.pointer.velocity.lengthSq()

    if (speedSq > 1e-8) {
      this.pointer.needsImpulse = true
    }

    this.scheduler.notifyPointer(this.pointer.position)
    this._updatePointerHelper()
  }

  _resetPointer() {
    this.pointer.active = false
    this.pointer.needsImpulse = false
    this.pointer.velocity.set(0, 0)
    this.pointer.radius = DEFAULT_POINTER_RADIUS
    this._updatePointerHelper()
  }

  _getBodyId(element) {
    let id = this.elementIds.get(element)
    if (!id) {
      id = `cloth-${this.elementIds.size + 1}`
      this.elementIds.set(element, id)
    }
    return id
  }

  _handleClothOffscreen(item) {
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
    this._removeAabbHelper(item)
  }

  setWireframe(enabled) {
    this.debug.wireframe = enabled
    for (const item of this.items.values()) {
      const material = item.record?.mesh.material
      if (material && 'wireframe' in material) {
        material.wireframe = enabled
      }
    }
  }

  setGravity(gravity) {
    this.debug.gravity = gravity
    for (const item of this.items.values()) {
      const density = item.record?.physics?.density ?? 1
      item.cloth?.setGravity(new THREE.Vector3(0, -(gravity * density), 0))
    }
  }

  setImpulseMultiplier(multiplier) {
    this.debug.impulseMultiplier = multiplier
  }

  setRealTime(enabled) {
    this.debug.realTime = enabled
    if (enabled) {
      this.accumulator = 0
      this.clock.getDelta()
    }
  }

  setSubsteps(substeps) {
    const clamped = Math.max(1, Math.round(substeps))
    this.debug.substeps = clamped
    for (const item of this.items.values()) {
      item.cloth?.setSubsteps(clamped)
    }
  }

  setConstraintIterations(iterations) {
    const clamped = Math.max(1, Math.round(iterations))
    this.debug.constraintIterations = clamped
    for (const item of this.items.values()) {
      item.cloth?.setConstraintIterations(clamped)
    }
  }

  setPinMode(mode) {
    this.debug.pinMode = mode
    for (const item of this.items.values()) {
      if (item.record) {
        if (!item.record.physics) {
          item.record.physics = {}
        }
        item.record.physics.pinMode = mode
        this._updateDatasetWithPhysics(item)
        if (!item.isActive) {
          this.domToWebGL?.updateMeshTransform(item.element, item.record)
        }
      }
      const cloth = item.cloth
      if (!cloth) continue
      cloth.clearPins()
      this._applyPinMode(cloth, this.debug.pinMode)
      this._runWarmStart(cloth)
      const density = item.record?.physics?.density ?? 1
      const gravityVector = new THREE.Vector3(0, -(this.debug.gravity * density), 0)
      cloth.setGravity(gravityVector)
    }
  }

  async setTessellationSegments(segments) {
    const pool = this.pool
    if (!pool) return
    const clamped = Math.max(1, Math.min(segments, 32))
    if (this.debug.tessellationSegments === clamped) return
    this.debug.tessellationSegments = clamped

    const tasks = []

    for (const item of this.items.values()) {
      if (item.isActive) continue
      const element = item.element
      tasks.push(
        pool
          .prepare(element, clamped)
          .then(() => {
            pool.mount(element)
            item.record = pool.getRecord(element)
            const material = item.record?.mesh.material
            if (material && 'wireframe' in material) {
              material.wireframe = this.debug.wireframe
            }
          })
      )
    }

    await Promise.all(tasks)
    this.collisionSystem.refresh()
  }

  setPointerColliderVisible(enabled) {
    this.debug.pointerCollider = enabled
    this.pointerColliderVisible = enabled
    if (!this.domToWebGL) return

    const helper = this._ensurePointerHelper()

    if (enabled) {
      if (!this.pointerInteractionEnabled) {
        this.setPointerInteractionEnabled(true)
      }
      if (!this.pointerHelperAttached) {
        this.domToWebGL.scene.add(helper)
        this.pointerHelperAttached = true
      }
      helper.visible = true
      this._updatePointerHelper()
    } else {
      helper.visible = false
      if (this.pointerHelperAttached) {
        this.domToWebGL.scene.remove(helper)
        this.pointerHelperAttached = false
      }
    }
  }

  stepOnce() {
    this._stepCloth(FIXED_DT)
    this._decayPointerImpulse()
    this._updatePointerHelper()
  }

  _stepCloth(dt) {
    const substeps = Math.max(1, this.debug.substeps)
    const stepSize = dt / substeps
    for (let i = 0; i < substeps; i++) {
      this.scheduler.step(stepSize)
    }
  }

  _decayPointerImpulse() {
    if (this.pointer.needsImpulse) {
      this.pointer.velocity.multiplyScalar(0.65)
      if (this.pointer.velocity.lengthSq() < 0.25) {
        this.pointer.velocity.set(0, 0)
        this.pointer.needsImpulse = false
      }
    }
  }

  _updatePointerHelper() {
    if (!this.pointerHelper) return
    this.pointerHelper.visible = this.pointerColliderVisible
    if (!this.pointerColliderVisible) return
    this.pointerHelper.position.set(this.pointer.position.x, this.pointer.position.y, 0.2)
    const radius = Math.max(MIN_POINTER_RADIUS, this.pointer.radius || DEFAULT_POINTER_RADIUS)
    const correction = this._getPointerAspectCorrection()
    this.pointerHelper.scale.set(radius * correction, radius, radius)
  }

  _ensurePointerHelper() {
    if (!this.pointerHelper) {
      const geometry = new THREE.SphereGeometry(1, 16, 16)
      const material = new THREE.MeshBasicMaterial({ color: 0xff6699, wireframe: true })
      this.pointerHelper = new THREE.Mesh(geometry, material)
      this.pointerHelper.visible = false
      const radius = Math.max(MIN_POINTER_RADIUS, this.pointer.radius || DEFAULT_POINTER_RADIUS)
      const correction = this._getPointerAspectCorrection()
      this.pointerHelper.scale.set(radius * correction, radius, radius)
    }
    return this.pointerHelper
  }

  _applyPinMode(cloth, pinMode = this.debug.pinMode) {
    switch (pinMode) {
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

  _runWarmStart(cloth) {
    if (WARM_START_PASSES <= 0) return
    cloth.wake()
    cloth.setGravity(new THREE.Vector3(0, 0, 0))
    cloth.relaxConstraints(this.debug.constraintIterations * WARM_START_PASSES)
  }

  _getPointerAspectCorrection() {
    if (!this.domToWebGL) return 1
    const viewport = this.domToWebGL.getViewportPixels()
    const canonicalAspect = CANONICAL_WIDTH_METERS / CANONICAL_HEIGHT_METERS
    const viewportAspect = viewport.height === 0 ? canonicalAspect : viewport.width / viewport.height
    if (viewportAspect === 0) return 1
    return canonicalAspect / viewportAspect
  }

  setPointerInteractionEnabled(enabled) {
    this.pointerInteractionEnabled = enabled
    if (!enabled) {
      this._resetPointer()
    }
  }

  setShowAabbs(enabled) {
    this.showAabbs = enabled
    if (this.debugGroup) {
      this.debugGroup.visible = enabled
    }
    if (!enabled) {
      this._clearAabbHelpers()
    } else {
      this._updateDebugOverlays()
    }
  }

  setShowSleepState(enabled) {
    this.showSleepState = enabled
    if (this.showAabbs) {
      this._updateDebugOverlays()
    }
  }

  _updateDebugOverlays() {
    if (!this.showAabbs || !this.domToWebGL) return

    const activeItems = new Set()

    for (const item of this.items.values()) {
      const record = item.record ?? this.pool?.getRecord(item.element)
      if (!record && !item.cloth) {
        this._removeAabbHelper(item)
        continue
      }

      const helper = this._ensureAabbHelper(item)
      if (!helper) continue

      const targetBox = helper.userData.box || (helper.userData.box = new THREE.Box3())

      if (item.cloth) {
        const mesh = record?.mesh
        targetBox.copy(item.cloth.getAABB())
        if (mesh) {
          mesh.updateMatrixWorld(true)
          targetBox.min.add(mesh.position)
          targetBox.max.add(mesh.position)
        }
      } else if (record?.mesh) {
        record.mesh.updateMatrixWorld(true)
        targetBox.setFromObject(record.mesh)
      }

      helper.box.copy(targetBox)
      helper.material.color.setHex(this._getAabbColor(item))
      helper.visible = true
      helper.updateMatrixWorld(true)
      activeItems.add(item)
    }

    for (const [item, helper] of this.aabbHelpers.entries()) {
      if (!activeItems.has(item)) {
        this._removeAabbHelper(item)
      }
    }
  }

  _ensureAabbHelper(item) {
    let helper = this.aabbHelpers.get(item)
    if (!helper) {
      helper = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(this._getAabbColor(item)))
      helper.visible = this.showAabbs
      helper.userData.box = new THREE.Box3()
      this.debugGroup.add(helper)
      this.aabbHelpers.set(item, helper)
    }
    return helper
  }

  _removeAabbHelper(item) {
    const helper = this.aabbHelpers.get(item)
    if (!helper) return
    this.debugGroup.remove(helper)
    helper.geometry?.dispose?.()
    helper.material?.dispose?.()
    this.aabbHelpers.delete(item)
  }

  _clearAabbHelpers() {
    for (const [item] of this.aabbHelpers) {
      this._removeAabbHelper(item)
    }
  }

  _getAabbColor(item) {
    if (this.showSleepState && item.cloth) {
      return item.cloth.isSleeping() ? 0xff3366 : 0x33cc66
    }
    return item.cloth ? 0x2299ff : 0x999999
  }

  _resetActiveCloths() {
    for (const item of this.items.values()) {
      if (!item.isActive) continue
      this._handleClothOffscreen(item)
    }
  }

  setAutoRelease(enabled) {
    this.autoRelease = enabled
  }

  getEntities() {
    const entities = []
    for (const item of this.items.values()) {
      const record = item.record ?? this.pool?.getRecord(item.element)
      const metrics = this._collectMetrics(item, record)
      entities.push({
        id: item.id ?? this._getBodyId(item.element),
        label: item.label,
        elementId: item.element.id || null,
        isActive: item.isActive,
        hasCloth: !!item.cloth,
        physics: record?.physics ?? {},
        layout: record?.layout ?? null,
        metrics,
      })
    }
    return entities
  }

  getEntityDetails(id) {
    const item = this._findItemById(id)
    if (!item) return null
    const record = item.record ?? this.pool?.getRecord(item.element)
    const dataset = { ...item.element.dataset }
    const metrics = this._collectMetrics(item, record)
    return {
      id: item.id ?? this._getBodyId(item.element),
      label: item.label,
      elementId: item.element.id || null,
      isActive: item.isActive,
      hasCloth: !!item.cloth,
      physics: record?.physics ?? {},
      layout: record?.layout ?? null,
      metrics,
      dataset,
    }
  }

  applyPhysicsPreset(id, overrides) {
    const item = this._findItemById(id)
    if (!item || !item.record) return
    const current = item.record.physics ?? {}
    item.record.physics = { ...current, ...overrides }
    this._updateDatasetWithPhysics(item)
    if (item.cloth) {
      this._updateActiveClothPhysics(item)
    }
  }

  pickEntityAt(clientX, clientY) {
    if (!this.domToWebGL) return null
    const pointer = this.domToWebGL.pointerToCanonical(clientX, clientY)
    let best = null
    let bestDistance = Infinity

    for (const item of this.items.values()) {
      const record = item.record ?? this.pool?.getRecord(item.element)
      if (!record) continue
      const mesh = record.mesh
      const center = mesh.position
      let inside = false
      let distance = Infinity

      if (item.isActive && item.cloth) {
        const sphere = item.cloth.getBoundingSphere()
        if (sphere) {
          const worldCenter = sphere.center.clone().add(center)
          const dx = pointer.x - worldCenter.x
          const dy = pointer.y - worldCenter.y
          const distSq = dx * dx + dy * dy
          if (distSq <= sphere.radius * sphere.radius) {
            inside = true
            distance = Math.sqrt(distSq)
          }
        }
      } else {
        const width = record.widthMeters ?? record.baseWidthMeters ?? 0
        const height = record.heightMeters ?? record.baseHeightMeters ?? 0
        const halfWidth = width / 2
        const halfHeight = height / 2
        const left = center.x - halfWidth
        const right = center.x + halfWidth
        const top = center.y + halfHeight
        const bottom = center.y - halfHeight
        if (pointer.x >= left && pointer.x <= right && pointer.y >= bottom && pointer.y <= top) {
          inside = true
          const dx = pointer.x - center.x
          const dy = pointer.y - center.y
          distance = Math.sqrt(dx * dx + dy * dy)
        }
      }

      if (!inside) continue
      if (distance < bestDistance) {
        best = item
        bestDistance = distance
      }
    }

    if (!best) return null

    return {
      id: best.id ?? this._getBodyId(best.element),
      label: best.label,
      isActive: best.isActive,
    }
  }

  _findItemById(id) {
    for (const item of this.items.values()) {
      const itemId = item.id ?? this._getBodyId(item.element)
      if (itemId === id) {
        return item
      }
    }
    return null
  }

  _updateActiveClothPhysics(item) {
    if (!item.cloth || !item.record) return
    const physics = item.record.physics ?? {}
    if (physics.damping !== undefined) {
      item.cloth.setDamping(physics.damping)
    }
    if (physics.constraintIterations !== undefined) {
      item.cloth.setConstraintIterations(physics.constraintIterations)
    }
    if (physics.substeps !== undefined) {
      item.cloth.setSubsteps(physics.substeps)
    }
    if (physics.pinMode) {
      item.cloth.clearPins()
      this._applyPinMode(item.cloth, physics.pinMode)
    }
    const density = physics.density ?? 1
    const gravityVector = new THREE.Vector3(0, -(this.debug.gravity * density), 0)
    item.cloth.setGravity(gravityVector)
  }

  _deriveLabel(element, fallbackId) {
    const dataLabel = element.dataset?.clothLabel
    if (dataLabel && dataLabel.trim().length > 0) return dataLabel.trim()
    const ariaLabel = element.getAttribute('aria-label')
    if (ariaLabel && ariaLabel.trim().length > 0) return ariaLabel.trim()
    const text = element.textContent?.trim()
    if (text) return text
    if (element.id) return element.id
    return fallbackId || DEFAULT_LABEL
  }

  _collectMetrics(item, record) {
    const mesh = record?.mesh
    const geometry = mesh?.geometry
    const vertexCount = geometry?.attributes?.position?.count ?? 0
    const triangleCount = geometry?.index?.count
      ? geometry.index.count / 3
      : Math.max(0, vertexCount - 2)

    if (item.cloth) {
      const stats = item.cloth.getConstraintStats()
      return {
        vertexCount,
        triangleCount,
        averageError: stats.averageError,
        maxError: stats.maxError,
      }
    }

    return {
      vertexCount,
      triangleCount,
      averageError: 0,
      maxError: 0,
    }
  }

  _updateDatasetWithPhysics(item) {
    if (!item.record) return
    const element = item.element
    const physics = item.record.physics ?? {}

    if (physics.density !== undefined) {
      element.dataset.clothDensity = String(physics.density)
    }
    if (physics.damping !== undefined) {
      element.dataset.clothDamping = String(physics.damping)
    }
    if (physics.constraintIterations !== undefined) {
      element.dataset.clothIterations = String(physics.constraintIterations)
    }
    if (physics.substeps !== undefined) {
      element.dataset.clothSubsteps = String(physics.substeps)
    }
    if (physics.turbulence !== undefined) {
      element.dataset.clothTurbulence = String(physics.turbulence)
    }

    let releaseDelayMs = physics.releaseDelayMs ?? DEFAULT_PIN_RELEASE_MS
    if (!this.autoRelease) {
      releaseDelayMs = null
    }
    if (releaseDelayMs !== null && releaseDelayMs !== undefined && releaseDelayMs > 0) {
      element.dataset.clothRelease = String(physics.releaseDelayMs)
    } else {
      delete element.dataset.clothRelease
    }

    if (physics.pinMode) {
      element.dataset.clothPin = physics.pinMode
    }
  }
}
