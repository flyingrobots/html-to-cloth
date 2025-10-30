export type DebugPreset = {
  name: string
  iterations: number
  sleepVelocity: number
  sleepFrames: number
  warmStartPasses: number
}

const PRESET_LIST: ReadonlyArray<Readonly<DebugPreset>> = Object.freeze([
  {
    name: 'Floaty',
    iterations: 3,
    sleepVelocity: 0.0005,
    sleepFrames: 80,
    warmStartPasses: 2,
  },
  {
    name: 'Crisp',
    iterations: 6,
    sleepVelocity: 0.001,
    sleepFrames: 60,
    warmStartPasses: 3,
  },
  {
    name: 'Heavy',
    iterations: 8,
    sleepVelocity: 0.002,
    sleepFrames: 40,
    warmStartPasses: 1,
  },
])

// Deep-freeze each preset to prevent accidental runtime mutation, then freeze the array.
const FROZEN_LIST = Object.freeze(PRESET_LIST.map((p) => Object.freeze({ ...p })))
export const PRESETS: ReadonlyArray<Readonly<DebugPreset>> = FROZEN_LIST

export function getPreset(name: string): Readonly<DebugPreset> | undefined {
  return FROZEN_LIST.find((p) => p.name === name)
}
