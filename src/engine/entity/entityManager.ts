import { Entity, type EntityOptions } from './entity'

export class EntityManager {
  private entities = new Map<string, Entity>()
  private nextId = 1

  createEntity(options: EntityOptions = {}) {
    const id = options.id ?? this.generateId()
    if (this.entities.has(id)) {
      throw new Error(`Entity with id ${id} already exists`)
    }
    const entity = new Entity(this, { ...options, id })
    this.entities.set(id, entity)
    return entity
  }

  getEntity(id: string) {
    return this.entities.get(id)
  }

  destroyEntity(entityOrId: Entity | string) {
    const entity = typeof entityOrId === 'string' ? this.entities.get(entityOrId) : entityOrId
    if (!entity) return
    if (!this.entities.has(entity.id)) return
    entity._markDestroyed()
    this.entities.delete(entity.id)
  }

  all() {
    return Array.from(this.entities.values())
  }

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
