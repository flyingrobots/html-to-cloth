import type { Component, ComponentType } from './component'
import type { EntityManager } from './entityManager'

/** Optional metadata supplied when creating entities. */
export type EntityOptions = {
  id?: string
  name?: string
}

/**
 * Minimal entity implementation supporting component composition. Entities are created and
 * managed exclusively by {@link EntityManager}.
 */
export class Entity {
  private readonly components = new Map<ComponentType<Component>, Component>()
  private destroyed = false

  constructor(private readonly manager: EntityManager, private readonly options: EntityOptions = {}) {}

  get id() {
    return this.options.id ?? ''
  }

  get name() {
    return this.options.name
  }

  /** Adds a component to the entity and triggers its {@link Component.onAttach} hook. */
  addComponent<T extends Component>(component: T, type?: ComponentType<T>): T {
    if (this.destroyed) {
      throw new Error('Cannot add component to destroyed entity')
    }
    const key = (type ?? (component.constructor as ComponentType<T>)) as ComponentType<Component>
    if (this.components.has(key)) {
      throw new Error('Component already attached')
    }
    this.components.set(key, component)
    component.onAttach?.(this)
    return component
  }

  /** Retrieves a component previously registered with {@link addComponent}. */
  getComponent<T extends Component>(type: ComponentType<T>): T | undefined {
    return this.components.get(type) as T | undefined
  }

  hasComponent<T extends Component>(type: ComponentType<T>) {
    return this.components.has(type)
  }

  /** Removes the component of the requested type if present. */
  removeComponent<T extends Component>(type: ComponentType<T>): T | undefined {
    const component = this.components.get(type) as T | undefined
    if (!component) return undefined
    this.components.delete(type)
    component.onDetach?.(this)
    return component
  }

  /** Returns an array of all components attached to this entity. */
  listComponents() {
    return Array.from(this.components.values())
  }

  /** Destroys the entity and detaches all components. */
  destroy() {
    if (this.destroyed) return
    // Prevent re-entrancy if a component triggers destroy() again.
    this.destroyed = true
    const entries = Array.from(this.components.entries())
    for (const [key, component] of entries) {
      if (!this.components.has(key)) continue
      this.components.delete(key)
      try {
        component.onDetach?.(this)
      } catch {
        // Component teardown errors should not block destruction.
      }
    }
    this.manager.destroyEntity(this)
  }

  /** @internal */
  _markDestroyed() {
    this.destroyed = true
  }
}
