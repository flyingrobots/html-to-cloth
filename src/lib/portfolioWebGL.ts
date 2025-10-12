import * as THREE from 'three'
import { DOMToWebGL } from './domToWebGL'
import type { DOMMeshRecord } from './domToWebGL'
import { ClothPhysics } from './clothPhysics'
import { CollisionSystem } from './collisionSystem'
import { CANONICAL_HEIGHT_METERS } from './units'
import { ElementPool } from './elementPool'
import { SimulationScheduler, type SleepableBody } from './simulationScheduler'

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

class ClothBodyAdapter implements SleepableBody {
  public readonly id: string
  private item: ClothItem
  private pointer: PointerState
  private collisionSystem: CollisionSystem
  private handleOffscreen: () => void
  private record: DOMMeshRecord

  constructor(
    id: string,
    item: ClothItem,
    pointer: PointerState,
    collisionSystem: CollisionSystem,
    handleOffscreen: () => void,
    record: DOMMeshRecord
  ) {
    this.id = id
    this.item = item
    this.pointer = pointer
    this.collisionSystem = collisionSystem
    this.handleOffscreen = handleOffscreen
    this.record = record
  }

  update(dt: number) {
    const cloth = this.item.cloth
    if (!cloth) return

    if (this.pointer.needsImpulse) {
      const radius = this.getImpulseRadius()
      const strength = this.getImpulseStrength()
      const base = this.getImpulseBaseMagnitude()
      const scaledForce = this.pointer.velocity.clone().multiplyScalar(base * strength)
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

  wakeIfPointInside(point: THREE.Vector2) {
    this.item.cloth?.wakeIfPointInside(point)
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
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : 1
  }

  private getImpulseBaseMagnitude() {
    const base = Math.max(this.record.widthMeters ?? 0, this.record.heightMeters ?? 0)
    return base > 0 ? base : 0.02
  }
}

export class PortfolioWebGL {
  private domToWebGL: DOMToWebGL | null = null
  private collisionSystem = new CollisionSystem()
  private items = new Map<HTMLElement, ClothItem>()
  private rafId: number | null = null
  private clock = new THREE.Clock()
  private disposed = false
  private pool: ElementPool | null = null
  private scheduler = new SimulationScheduler()
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
  private onPointerMove = (event: PointerEvent) => this.handlePointerMove(event)
  private onPointerLeave = () => this.resetPointer()

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

    if ('fonts' in document && typeof (document as any).fonts?.ready === 'object') {
      try {
        await (document as any).fonts.ready
      } catch (error) {
        console.warn('Waiting for fonts failed', error)
      }
    }

    await this.prepareElements(clothElements)

    window.addEventListener('resize', this.onResize, { passive: true })
    window.addEventListener('scroll', this.onScroll, { passive: true })
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('pointerup', this.onPointerLeave, { passive: true })
    window.addEventListener('pointerleave', this.onPointerLeave, { passive: true })
    window.addEventListener('pointercancel', this.onPointerLeave, { passive: true })

    this.clock.start()
    this.animate()
  }

  dispose() {
    this.disposed = true
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
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

  private async prepareElements(elements: HTMLElement[]) {
    if (!this.domToWebGL || !this.pool) return

    for (const element of elements) {
      await this.pool.prepare(element)
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

    const record = this.pool.getRecord(element)
    if (!record) return

    const cloth = new ClothPhysics(record.mesh, {
      damping: 0.97,
      constraintIterations: 4,
    })

    cloth.pinTopEdge()
    cloth.addTurbulence(0.06)
    setTimeout(() => cloth.releaseAllPins(), 900)

    item.cloth = cloth
    item.record = record
    const adapterId = this.getBodyId(element)
    const adapter = new ClothBodyAdapter(
      adapterId,
      item,
      this.pointer,
      this.collisionSystem,
      () => this.handleClothOffscreen(item),
      record
    )
    this.scheduler.addBody(adapter)
    item.adapter = adapter
    element.removeEventListener('click', item.clickHandler)
  }

  private animate() {
    if (this.disposed || !this.domToWebGL) return

    this.rafId = requestAnimationFrame(() => this.animate())
    const delta = Math.min(this.clock.getDelta(), 0.033)

    this.scheduler.step(delta)

    if (this.pointer.needsImpulse) {
      this.pointer.velocity.multiplyScalar(0.65)
      if (this.pointer.velocity.lengthSq() < 0.25) {
        this.pointer.velocity.set(0, 0)
        this.pointer.needsImpulse = false
      }
    }

    this.domToWebGL.render()
  }

  private handleResize() {
    if (!this.domToWebGL) return
    this.domToWebGL.resize()
    const viewport = this.domToWebGL.getViewportPixels()
    this.collisionSystem.setViewportDimensions(viewport.width, viewport.height)
    this.collisionSystem.refresh()
    this.syncStaticMeshes()
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

    if (!this.pointer.active) {
      this.pointer.active = true
      this.pointer.previous.copy(this.pointer.position)
      this.scheduler.notifyPointer(this.pointer.position)
      return
    }

    this.pointer.velocity.copy(this.pointer.position).sub(this.pointer.previous)
    const speedSq = this.pointer.velocity.lengthSq()

    if (speedSq > 0.0001) {
      this.pointer.needsImpulse = true
    }

    this.scheduler.notifyPointer(this.pointer.position)
  }

  private resetPointer() {
    this.pointer.active = false
    this.pointer.needsImpulse = false
    this.pointer.velocity.set(0, 0)
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
}
