import * as THREE from 'three'
import { DOMToWebGL } from './domToWebGL'
import { ClothPhysics } from './clothPhysics'
import { CollisionSystem } from './collisionSystem'
import { CANONICAL_HEIGHT_METERS } from './units'
import { ElementPool } from './elementPool'
import { SimulationScheduler } from './simulationScheduler'

const FIXED_DT = 1 / 60
const MAX_ACCUMULATED_TIME = FIXED_DT * 5
const WARM_START_PASSES = 2

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
 * @typedef {Object} ClothItem
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

    if (this.pointer.needsImpulse) {
      const radius = this._getImpulseRadius()
      const strength = this._getImpulseStrength()
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
    const base = Math.max(widthMeters, heightMeters)
    return base > 0 ? base / 2 : 0.25
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
    }
    this.pointerHelper = null
    this.pointerHelperAttached = false
    this.pointerColliderVisible = false
    this.debug = {
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
    if (!this.domToWebGL || !this.pool) return

    for (const element of elements) {
      await this.pool.prepare(element, this.debug.tessellationSegments)
      this.pool.mount(element)

      const record = this.pool.getRecord(element)

      const originalOpacity = element.style.opacity
      element.style.opacity = '0'

      const clickHandler = (event) => {
        event.preventDefault()
        this._activate(element)
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

  _activate(element) {
    if (!this.domToWebGL || !this.pool) return

    const item = this.items.get(element)
    if (!item || item.isActive) return

    item.isActive = true
    this.collisionSystem.removeStaticBody(element)
    this._resetPointer()

    const record = this.pool.getRecord(element)
    if (!record) return

    this.pool.resetGeometry(element)

    const cloth = new ClothPhysics(record.mesh, {
      damping: 0.97,
      constraintIterations: this.debug.constraintIterations,
    })

    cloth.setConstraintIterations(this.debug.constraintIterations)
    cloth.setSubsteps(this.debug.substeps)
    this._applyPinMode(cloth)

    const gravityVector = new THREE.Vector3(0, -this.debug.gravity, 0)
    this._runWarmStart(cloth)
    cloth.setGravity(gravityVector)

    cloth.addTurbulence(0.06)
    setTimeout(() => cloth.releaseAllPins(), 900)

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
    this.domToWebGL.render()
  }

  _handleResize() {
    if (!this.domToWebGL) return
    this.domToWebGL.resize()
    const viewport = this.domToWebGL.getViewportPixels()
    this.collisionSystem.setViewportDimensions(viewport.width, viewport.height)
    this.collisionSystem.refresh()
    this._syncStaticMeshes()
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
      this._updatePointerHelper()
      return
    }

    this.pointer.velocity.copy(this.pointer.position).sub(this.pointer.previous)
    const speedSq = this.pointer.velocity.lengthSq()

    if (speedSq > 0.0001) {
      this.pointer.needsImpulse = true
    }

    this.scheduler.notifyPointer(this.pointer.position)
    this._updatePointerHelper()
  }

  _resetPointer() {
    this.pointer.active = false
    this.pointer.needsImpulse = false
    this.pointer.velocity.set(0, 0)
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
      item.cloth?.setGravity(new THREE.Vector3(0, -gravity, 0))
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
    const gravityVector = new THREE.Vector3(0, -this.debug.gravity, 0)
    for (const item of this.items.values()) {
      const cloth = item.cloth
      if (!cloth) continue
      cloth.clearPins()
      this._applyPinMode(cloth)
      this._runWarmStart(cloth)
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
  }

  _ensurePointerHelper() {
    if (!this.pointerHelper) {
      const geometry = new THREE.SphereGeometry(0.12, 16, 16)
      const material = new THREE.MeshBasicMaterial({ color: 0xff6699, wireframe: true })
      this.pointerHelper = new THREE.Mesh(geometry, material)
      this.pointerHelper.visible = false
    }
    return this.pointerHelper
  }

  _applyPinMode(cloth) {
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

  _runWarmStart(cloth) {
    if (WARM_START_PASSES <= 0) return
    cloth.wake()
    cloth.setGravity(new THREE.Vector3(0, 0, 0))
    cloth.relaxConstraints(this.debug.constraintIterations * WARM_START_PASSES)
  }
}
