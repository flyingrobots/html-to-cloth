import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

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
