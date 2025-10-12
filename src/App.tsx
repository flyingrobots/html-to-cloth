import { useEffect } from 'react'
import './App.css'
import { PortfolioWebGL } from './lib/portfolioWebGL'

function App() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReducedMotion.matches) return

    const controller = new PortfolioWebGL()
    void controller.init()

    return () => controller.dispose()
  }, [])

  return (
    <main className="demo-shell">
      <h1 className="demo-title">Cloth Playground</h1>
      <p className="demo-copy">
        This minimal scene keeps the DOM simple while we tune the cloth overlay.
        Click the button below to peel it away.
      </p>
      <button className="demo-button cloth-enabled" type="button">
        Peel Back
      </button>
    </main>
  )
}

export default App
