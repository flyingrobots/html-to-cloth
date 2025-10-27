export type DebugPreset = {
  name: string
  gravity: number
  iterations: number
  sleepVelocity: number
  sleepFrames: number
  cameraZoom: number
  warmStartPasses: number
}

export const PRESETS: DebugPreset[] = [
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
]

export function getPreset(name: string) {
  return PRESETS.find((p) => p.name === name)
}

