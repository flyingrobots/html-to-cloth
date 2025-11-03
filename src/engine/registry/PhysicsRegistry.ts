export type PhysicsType = 'cloth' | 'rigid-dynamic' | 'rigid-static'

export type PhysicsAttrs = {
  mass?: number
  restitution?: number
  friction?: number
  shape?: 'circle' | 'obb'
  damping?: number
}

export type PhysicsDescriptor = {
  id: string
  tag: string | null
  type: PhysicsType
  attrs: PhysicsAttrs
  origin: { x: number; y: number; width: number; height: number }
  active: boolean
  element: HTMLElement
}

export type RegistryEventType = 'registry:add' | 'registry:update' | 'registry:remove'

export type RegistryEvent =
  | { type: 'registry:add'; current: PhysicsDescriptor }
  | { type: 'registry:update'; previous: PhysicsDescriptor; current: PhysicsDescriptor }
  | { type: 'registry:remove'; previous: PhysicsDescriptor }

export class PhysicsRegistry {
  private map = new Map<HTMLElement, PhysicsDescriptor>()
  private listeners = new Set<(e: RegistryEvent) => void>()

  discover(root: Document | HTMLElement = document) {
    const nodes = Array.from((root as Document).querySelectorAll?.('*') ?? []) as HTMLElement[]
    for (const el of nodes) {
      const desc = this.describe(el)
      if (!desc) continue
      const prev = this.map.get(el)
      if (!prev) {
        this.map.set(el, desc)
        this.emit({ type: 'registry:add', current: desc })
      } else if (!this.equal(prev, desc)) {
        this.map.set(el, desc)
        this.emit({ type: 'registry:update', previous: prev, current: desc })
      }
    }
    // removals
    for (const [el, prev] of Array.from(this.map.entries())) {
      if (!root.contains(el)) {
        this.map.delete(el)
        this.emit({ type: 'registry:remove', previous: prev })
      }
    }
  }

  /** Subscribe to registry events. Returns an unsubscribe function. */
  on(fn: (e: RegistryEvent) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  /** Returns all currently tracked descriptors. */
  entries() {
    return Array.from(this.map.values())
  }

  // --- internals ---
  private emit(e: RegistryEvent) {
    for (const fn of this.listeners) {
      try {
        fn(e)
      } catch (err) {
        console.error('PhysicsRegistry listener error:', err)
      }
    }
  }

  private describe(el: HTMLElement): PhysicsDescriptor | null {
    let type: PhysicsType | null = null
    if (el.classList.contains('cloth-enabled')) type = 'cloth'
    else if (el.classList.contains('rigid-dynamic')) type = 'rigid-dynamic'
    else if (el.classList.contains('rigid-static')) type = 'rigid-static'
    // Also accept explicit data-phys-type
    const dataType = el.dataset.physType
    if (!type && dataType) {
      if (dataType === 'cloth' || dataType === 'rigid-dynamic' || dataType === 'rigid-static') {
        type = dataType as PhysicsType
      }
    }
    if (!type) return null

    const rect = el.getBoundingClientRect()
    const origin = { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
    const tag = el.dataset.tag || el.dataset.physTag || null
    const attrs: PhysicsAttrs = {
      mass: parseNum(el.dataset.physMass),
      restitution: parseNum(el.dataset.physRestitution),
      friction: parseNum(el.dataset.physFriction),
      shape: (el.dataset.physShape as 'circle' | 'obb' | undefined) ?? undefined,
      damping: parseNum(el.dataset.clothDamping),
    }
    return {
      id: (el.id ?? '').trim() !== '' ? el.id : this.autoId(el),
      tag,
      type,
      attrs,
      origin,
      active: false,
      element: el,
    }
  }

  private equal(a: PhysicsDescriptor, b: PhysicsDescriptor) {
    return (
      a.id === b.id &&
      a.type === b.type &&
      a.tag === b.tag &&
      a.origin.x === b.origin.x &&
      a.origin.y === b.origin.y &&
      a.origin.width === b.origin.width &&
      a.origin.height === b.origin.height &&
      a.attrs.mass === b.attrs.mass &&
      a.attrs.restitution === b.attrs.restitution &&
      a.attrs.friction === b.attrs.friction &&
      a.attrs.shape === b.attrs.shape &&
      a.attrs.damping === b.attrs.damping
    )
  }

  private autoId(el: HTMLElement) {
    // Deterministic path-based id
    const parts: string[] = []
    let n: HTMLElement | null = el
    while (n && n !== document.body) {
      let idx = 0
      let sibling = n.previousElementSibling as HTMLElement | null
      while (sibling) { idx++; sibling = sibling.previousElementSibling as HTMLElement | null }
      parts.push(`${n.tagName.toLowerCase()}:${idx}`)
      n = n.parentElement
    }
    return parts.reverse().join('/')
  }
}

function parseNum(v?: string): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
