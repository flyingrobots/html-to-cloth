import { describe, it, expect, beforeEach } from 'vitest'
import { PhysicsRegistry, type RegistryEvent } from '../PhysicsRegistry'

function mockRect(x: number, y: number, w: number, h: number): DOMRect {
  return {
    x, y, width: w, height: h,
    top: y, left: x, right: x + w, bottom: y + h,
    toJSON() { return {} },
  } as DOMRect
}

describe('PhysicsRegistry', () => {
  let root: HTMLElement
  let registry: PhysicsRegistry
  let events: RegistryEvent[]

  beforeEach(() => {
    document.body.innerHTML = ''
    root = document.createElement('div')
    document.body.appendChild(root)
    registry = new PhysicsRegistry()
    events = []
    registry.on((e) => events.push(e))
  })

  it('discovers cloth and rigid nodes and emits add events', () => {
    const cloth = document.createElement('button')
    cloth.className = 'cloth-enabled'
    ;(cloth as any).getBoundingClientRect = () => mockRect(10, 20, 200, 100)
    cloth.dataset.physMass = '0.5'
    root.appendChild(cloth)

    const rigid = document.createElement('div')
    rigid.className = 'rigid-static'
    rigid.dataset.tag = 'hero'
    ;(rigid as any).getBoundingClientRect = () => mockRect(300, 40, 100, 50)
    root.appendChild(rigid)

    registry.discover(document)

    expect(events.filter((e) => e.type === 'registry:add').length).toBe(2)
    const clothDesc = events.find((e) => (e as any).current?.type === 'cloth') as any
    expect(clothDesc.current.attrs.mass).toBe(0.5)
    const rigidDesc = events.find((e) => (e as any).current?.type === 'rigid-static') as any
    expect(rigidDesc.current.tag).toBe('hero')
    expect(registry.entries().length).toBe(2)
  })

  it('emits update when layout or attrs change, and remove on detach', () => {
    const node = document.createElement('div')
    node.className = 'cloth-enabled'
    let rect = mockRect(0, 0, 100, 50)
    ;(node as any).getBoundingClientRect = () => rect
    root.appendChild(node)

    registry.discover(document)
    events = []

    // Layout change
    rect = mockRect(10, 0, 100, 50)
    registry.discover(document)
    expect(events.some((e) => e.type === 'registry:update')).toBe(true)

    // Attr change
    events = []
    node.dataset.physFriction = '0.2'
    registry.discover(document)
    const upd = events.find((e) => e.type === 'registry:update') as any
    expect(upd.previous.attrs.friction ?? -1).not.toBe(0.2)
    expect(upd.current.attrs.friction).toBe(0.2)

    // Removal
    events = []
    node.remove()
    registry.discover(document)
    expect(events.some((e) => e.type === 'registry:remove')).toBe(true)
  })
})

