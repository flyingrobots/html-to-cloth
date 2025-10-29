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

  /**
   * Temporarily overrides gravity for the duration of the synchronous callback.
   *
   * Why: certain operations (e.g., warm-starting constraint relaxation) should run under a
   * zero-gravity field without permanently mutating the base gravity vector.
   *
   * Notes:
   * - This is synchronous-only; asynchronous callbacks are not supported and will restore the
   *   previous override immediately after the function returns.
   * - Nested calls are supported; previous override values are restored in LIFO order.
   * - The override value is defensively cloned to avoid caller-side mutation affecting state.
   *
   * Prefer {@link setBase} for long-lived gravity changes. Use this for scoped, one-off overrides.
   */
  runWithOverride(overrideValue: THREE.Vector3, fn: () => void) {
    const previous = this.override
    this.override = overrideValue.clone()
    try {
      fn()
    } finally {
      this.override = previous
    }
  }
}
