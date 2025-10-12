import { useEffect, useRef, useState } from 'react'
import './App.css'
import { PortfolioWebGL } from './lib/portfolioWebGL'

function App() {
  const controllerRef = useRef<PortfolioWebGL | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [realTime, setRealTime] = useState(true)
  const [gravity, setGravity] = useState(9.81)
  const [impulseMultiplier, setImpulseMultiplier] = useState(1)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReducedMotion.matches) return

    const controller = new PortfolioWebGL()
    controllerRef.current = controller
    void controller.init()

    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setDebugOpen((open) => !open)
        return
      }
      if (!realTime && event.key === ' ') {
        event.preventDefault()
        controller.stepOnce()
      }
    }
    window.addEventListener('keydown', handler)

    return () => {
      window.removeEventListener('keydown', handler)
      controller.dispose()
      controllerRef.current = null
    }
  }, [realTime])

  useEffect(() => {
    controllerRef.current?.setWireframe(wireframe)
  }, [wireframe])

  useEffect(() => {
    controllerRef.current?.setRealTime(realTime)
  }, [realTime])

  useEffect(() => {
    controllerRef.current?.setGravity(gravity)
  }, [gravity])

  useEffect(() => {
    controllerRef.current?.setImpulseMultiplier(impulseMultiplier)
  }, [impulseMultiplier])

  const modifierKey =
    typeof navigator !== 'undefined' && navigator?.platform?.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'

  return (
    <>
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
      <div className="debug-toast">
        <p>
          Press <span className="kbd">{modifierKey} + J</span> to open the debug palette
        </p>
      </div>
      {debugOpen ? (
        <div className="debug-overlay" role="dialog" aria-modal="true">
          <div className="debug-card">
            <header className="debug-card__header">
              <div>
                <h2>Debug Settings</h2>
                <p>Control simulation parameters</p>
              </div>
              <button className="debug-close" onClick={() => setDebugOpen(false)} aria-label="Close debug palette">
                ×
              </button>
            </header>
            <div className="debug-card__content">
              <label className="debug-field">
                <input type="checkbox" checked={wireframe} onChange={(event) => setWireframe(event.target.checked)} />
                <span>Wireframe</span>
              </label>
              <label className="debug-field">
                <input type="checkbox" checked={realTime} onChange={(event) => setRealTime(event.target.checked)} />
                <span>Real-Time Simulation</span>
              </label>
              {!realTime ? (
                <button className="debug-step" type="button" onClick={() => controllerRef.current?.stepOnce()}>
                  Step (Space)
                </button>
              ) : null}
              <label className="debug-field">
                <span>Gravity ({gravity.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={gravity}
                  onChange={(event) => setGravity(Number.parseFloat(event.target.value))}
                />
              </label>
              <label className="debug-field">
                <span>Impulse Multiplier ({impulseMultiplier.toFixed(2)})</span>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={impulseMultiplier}
                  onChange={(event) => setImpulseMultiplier(Number.parseFloat(event.target.value))}
                />
              </label>
            </div>
            <footer className="debug-card__footer">
              <button
                className="debug-reset"
                type="button"
                onClick={() => {
                  setWireframe(false)
                  setRealTime(true)
                  setGravity(9.81)
                  setImpulseMultiplier(1)
                }}
              >
                Reset
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default App
