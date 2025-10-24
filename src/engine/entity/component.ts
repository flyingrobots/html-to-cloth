import type { Entity } from './entity'

export interface Component {
  onAttach?(entity: Entity): void
  onDetach?(entity: Entity): void
}

export type ComponentType<T extends Component> = new (...args: any[]) => T
