import type { Component, ComponentType } from './component'
import type { EntityManager } from './entityManager'

export type EntityOptions = {
  id?: string
  name?: string
}

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

  getComponent<T extends Component>(type: ComponentType<T>): T | undefined {
    return this.components.get(type) as T | undefined
  }

  hasComponent<T extends Component>(type: ComponentType<T>) {
    return this.components.has(type)
  }

  removeComponent<T extends Component>(type: ComponentType<T>): T | undefined {
    const component = this.components.get(type) as T | undefined
    if (!component) return undefined
    this.components.delete(type)
    component.onDetach?.(this)
    return component
  }

  listComponents() {
    return Array.from(this.components.values())
  }

  destroy() {
    if (this.destroyed) return
    for (const [key, component] of this.components.entries()) {
      component.onDetach?.(this)
      this.components.delete(key)
    }
    this.destroyed = true
    this.manager.destroyEntity(this)
  }

  /** @internal */
  _markDestroyed() {
    this.destroyed = true
  }
}
