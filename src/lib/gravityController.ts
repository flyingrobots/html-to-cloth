import * as THREE from 'three'

export class GravityController {
  private base: THREE.Vector3
  private override: THREE.Vector3 | null = null

  constructor(initial?: THREE.Vector3) {
    this.base = initial ? initial.clone() : new THREE.Vector3(0, -9.81, 0)
  }

  getCurrent(target: THREE.Vector3) {
    target.copy(this.override ?? this.base)
    return target
  }

  setBase(next: THREE.Vector3) {
    this.base.copy(next)
  }

  getBase(target: THREE.Vector3) {
    target.copy(this.base)
    return target
  }

  runWithOverride(temp: THREE.Vector3, fn: () => void) {
    const previous = this.override
    this.override = temp.clone()
    try {
      fn()
    } finally {
      this.override = previous
    }
  }
}
