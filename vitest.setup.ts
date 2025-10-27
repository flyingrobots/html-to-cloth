import '@testing-library/jest-dom/vitest'

// JSDOM polyfills
if (typeof window !== 'undefined' && !('matchMedia' in window)) {
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
