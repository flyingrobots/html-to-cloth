import '@testing-library/jest-dom/vitest'

// JSDOM polyfills
if (typeof window !== 'undefined' && typeof (window as any).matchMedia !== 'function') {
  // Minimal matchMedia stub for components that query prefers-reduced-motion, etc.
  ;(window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

// Radix UI uses ResizeObserver internally; provide a minimal stub for jsdom.
if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
