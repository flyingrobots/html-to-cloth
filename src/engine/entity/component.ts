import type { Entity } from './entity'

/**
 * Base interface implemented by components that can be attached to an {@link Entity}.
 */
export interface Component {
  /** Called when the component is added to an entity. */
  onAttach?(entity: Entity): void
  /** Called when the component is removed from an entity or when the entity is destroyed. */
  onDetach?(entity: Entity): void
}

/** Utility type describing the constructor signature required for registering components. */
export type ComponentType<T extends Component> = new (...args: any[]) => T
