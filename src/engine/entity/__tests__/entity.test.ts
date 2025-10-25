import { describe, expect, it, vi } from 'vitest'

import type { Component } from '../component'
import { EntityManager } from '../entityManager'

class MockComponent implements Component {
  attached = false
  detached = false

  onAttach() {
    this.attached = true
  }

  onDetach() {
    this.detached = true
  }
}

describe('Entity + EntityManager', () => {
  it('adds and retrieves components', () => {
    const manager = new EntityManager()
    const entity = manager.createEntity({ name: 'cloth' })

    const component = entity.addComponent(new MockComponent())
    expect(component.attached).toBe(true)
    expect(entity.getComponent(MockComponent)).toBe(component)
  })

  it('removes components and triggers detach', () => {
    const manager = new EntityManager()
    const entity = manager.createEntity()

    const component = entity.addComponent(new MockComponent())
    entity.removeComponent(MockComponent)

    expect(component.detached).toBe(true)
    expect(entity.hasComponent(MockComponent)).toBe(false)
  })

  it('destroys entities and clears registry', () => {
    const manager = new EntityManager()
    const entity = manager.createEntity({ id: 'cloth-1' })

    const component = entity.addComponent(new MockComponent())
    entity.destroy()

    expect(component.detached).toBe(true)
    expect(manager.getEntity('cloth-1')).toBeUndefined()
  })
})
