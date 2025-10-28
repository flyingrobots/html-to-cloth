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
