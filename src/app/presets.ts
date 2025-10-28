export type DebugPreset = {
  name: string
  gravity: number
  iterations: number
  sleepVelocity: number
  sleepFrames: number
  cameraZoom: number
  warmStartPasses: number
}

const PRESET_LIST: ReadonlyArray<Readonly<DebugPreset>> = Object.freeze([
  {
    name: 'Floaty',
    gravity: 6.0,
    iterations: 3,
    sleepVelocity: 0.0005,
    sleepFrames: 80,
    cameraZoom: 1.2,
    warmStartPasses: 2,
  },
  {
    name: 'Crisp',
    gravity: 9.81,
    iterations: 6,
    sleepVelocity: 0.001,
    sleepFrames: 60,
    cameraZoom: 1.0,
    warmStartPasses: 3,
  },
  {
    name: 'Heavy',
    gravity: 14.0,
    iterations: 8,
    sleepVelocity: 0.002,
    sleepFrames: 40,
    cameraZoom: 0.9,
    warmStartPasses: 1,
  },
])

export const PRESETS: ReadonlyArray<Readonly<DebugPreset>> = PRESET_LIST

export function getPreset(name: string): Readonly<DebugPreset> | undefined {
  return PRESET_LIST.find((p) => p.name === name)
}
