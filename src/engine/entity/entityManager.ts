import { Entity, type EntityOptions } from './entity'

/**
 * Registry responsible for creating, tracking, and destroying {@link Entity} instances.
 * Keeps IDs unique and exposes convenience helpers for iterating over entities.
 */
export class EntityManager {
  private entities = new Map<string, Entity>()
  private nextId = 1

  /** Creates a new entity with optional metadata. */
  createEntity(options: EntityOptions = {}) {
    const id = options.id ?? this.generateId()
    if (this.entities.has(id)) {
      throw new Error(`Entity with id ${id} already exists`)
    }
    const entity = new Entity(this, { ...options, id })
    this.entities.set(id, entity)
    return entity
  }

  /** Returns an entity by id if it exists. */
  getEntity(id: string) {
    return this.entities.get(id)
  }

  /** Destroys an entity by reference or id. */
  destroyEntity(entityOrId: Entity | string) {
    const entity = typeof entityOrId === 'string' ? this.entities.get(entityOrId) : entityOrId
    if (!entity) return
    if (!this.entities.has(entity.id)) return
    entity._markDestroyed()
    this.entities.delete(entity.id)
  }

  /** Returns an array of all tracked entities. */
  all() {
    return Array.from(this.entities.values())
  }

  /** Destroys every entity managed by this instance. */
  clear() {
    const entities = Array.from(this.entities.values())
    for (const entity of entities) {
      entity.destroy()
    }
  }

  private generateId() {
    return `entity-${this.nextId++}`
  }
}
