import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Silence noisy Node warnings (e.g., --localstorage-file) during tests.
if (!process.env.NODE_NO_WARNINGS) {
  process.env.NODE_NO_WARNINGS = '1'
}

// Mock html2canvas to avoid jsdom CSS parser/iframe cloning errors in tests.
vi.mock('html2canvas', () => ({
  default: async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    return canvas
  },
}))

// Provide a default localStorage file path to silence jsdom warnings when the
// browser runner is invoked without --localstorage-file.
if (!process.env.VITEST_BROWSER_LOCAL_STORAGE_FILE) {
  process.env.VITEST_BROWSER_LOCAL_STORAGE_FILE = '/tmp/vitest-localstorage.json'
}
// Ensure argv carries a valid --localstorage-file path to satisfy runners that inspect CLI args.
if (!process.argv.includes('--localstorage-file')) {
  process.argv.push('--localstorage-file', '/tmp/vitest-localstorage.json')
}

// Suppress noisy jsdom warning about missing --localstorage-file when using the browser runner.
const originalWarn = console.warn
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('--localstorage-file')) return
  return originalWarn(...args)
}
const originalEmitWarning = process.emitWarning
process.emitWarning = ((warning: any, ...rest: any[]) => {
  if (typeof warning === 'string' && warning.includes('--localstorage-file')) return undefined as any
  return originalEmitWarning(warning as any, ...(rest as any))
}) as any

// JSDOM polyfills
if (typeof window !== 'undefined' && typeof (window as any).matchMedia !== 'function') {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: (..._args: any[]) => {},
    removeEventListener: (..._args: any[]) => {},
    addListener: (..._args: any[]) => {},
    removeListener: (..._args: any[]) => {},
    dispatchEvent: (..._args: any[]) => false,
  }))
}

// Radix UI uses ResizeObserver internally; provide a minimal stub for jsdom.
if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(..._args: any[]) {}
      unobserve(..._args: any[]) {}
      disconnect(..._args: any[]) {}
    }
  )
}

// Normalize getComputedStyle to ignore pseudo-element arguments that jsdom lacks.
if (typeof window !== 'undefined') {
  const originalGetComputedStyle = window.getComputedStyle.bind(window)
  window.getComputedStyle = ((elt: Element, _pseudo?: string | null) => {
    return originalGetComputedStyle(elt)
  }) as any
  ;(window as any).scrollTo = (window as any).scrollTo || (() => {})
}

// Suppress WebGL context errors in jsdom by stubbing getContext on canvas
try {
  const proto = (HTMLCanvasElement as any)?.prototype
  if (proto) {
    proto.getContext = function getContext(type: string) {
      // Minimal fake WebGL context for three.js in tests.
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        return {
          getExtension: () => null,
        } as any
      }
      return {} as any
    }
  }
} catch {}
