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

  it('destroys entities by id through the manager', () => {
    const manager = new EntityManager()
    const entity = manager.createEntity({ id: 'cloth-2' })
    const component = entity.addComponent(new MockComponent())

    manager.destroyEntity('cloth-2')

    expect(component.detached).toBe(true)
    expect(manager.getEntity('cloth-2')).toBeUndefined()
  })

  it('throws when adding a component to a destroyed entity', () => {
    const manager = new EntityManager()
    const entity = manager.createEntity()
    entity.addComponent(new MockComponent())
    entity.destroy()

    expect(() => entity.addComponent(new MockComponent())).toThrow('Cannot add component to destroyed entity')
  })

  it('prevents duplicate component types', () => {
    const manager = new EntityManager()
    const entity = manager.createEntity()

    entity.addComponent(new MockComponent())

    expect(() => entity.addComponent(new MockComponent())).toThrow('Component already attached')
  })

  it('handles lookups for missing components gracefully', () => {
    const manager = new EntityManager()
    const entity = manager.createEntity()

    expect(entity.getComponent(MockComponent)).toBeUndefined()
    expect(entity.hasComponent(MockComponent)).toBe(false)
    expect(entity.removeComponent(MockComponent)).toBeUndefined()
  })

  it('rejects invalid entity ids', () => {
    const manager = new EntityManager()
    expect(() => manager.createEntity({ id: '' })).toThrow('Entity id must be a non-empty string')
    expect(() => manager.createEntity({ id: '   ' })).toThrow('Entity id must be a non-empty string')
    expect(() => manager.createEntity({ id: 123 as unknown as string })).toThrow('Entity id must be a non-empty string')
  })

  it('skips used ids when generating new ones', () => {
    const manager = new EntityManager()
    manager.createEntity({ id: 'entity-1' })
    const generated = manager.createEntity()
    expect(generated.id).toBe('entity-2')
  })
})
