// src/engine/gameLoop.js
// Fixed timestep game loop inspired by caverns engine

const DEFAULT_FIXED_DELTA = 1 / 60

/**
 * @typedef {Object} GameLoopOptions
 * @property {() => number} [timeProvider] - returns milliseconds
 * @property {(cb: FrameRequestCallback) => number} [requestFrame]
 * @property {(handle: number) => void} [cancelFrame]
 * @property {number} [fixedDelta]
 * @property {number} [maxSubSteps]
 */

export class GameLoop {
  /**
   * @param {import('./world.js').EngineWorld} world
   * @param {GameLoopOptions} [options]
   */
  constructor(world, options = {}) {
    this.world = world
    this.fixedDelta = options.fixedDelta ?? DEFAULT_FIXED_DELTA
    this.maxSubSteps = options.maxSubSteps ?? 5
    this._timeProvider = options.timeProvider ?? (() => performance.now())
    this._requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb))
    this._cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id))

    this._running = false
    this._paused = false
    this._lastTime = 0
    this._accumulator = 0
    this._rafHandle = null
    this._tick = this._tick.bind(this)
  }

  start() {
    if (this._running) return
    this._running = true
    this._lastTime = this._timeProvider()
    this._rafHandle = this._requestFrame(this._tick)
  }

  stop() {
    if (!this._running) return
    if (this._rafHandle != null) {
      this._cancelFrame(this._rafHandle)
      this._rafHandle = null
    }
    this._running = false
  }

  pause() {
    this._paused = true
  }

  resume() {
    this._paused = false
  }

  get paused() {
    return this._paused
  }

  stepOnce() {
    this.world.tick(this.fixedDelta, { paused: false })
  }

  _tick(timestamp) {
    if (!this._running) return
    const now = timestamp ?? this._timeProvider()
    const deltaMs = now - this._lastTime
    this._lastTime = now
    const deltaSeconds = Math.min(deltaMs / 1000, 0.25)
    this._accumulator += deltaSeconds

    let subSteps = 0
    while (this._accumulator >= this.fixedDelta && subSteps < this.maxSubSteps) {
      this.world.tick(this.fixedDelta, { paused: this._paused })
      this._accumulator -= this.fixedDelta
      subSteps += 1
    }

    this._rafHandle = this._requestFrame(this._tick)
  }
}
