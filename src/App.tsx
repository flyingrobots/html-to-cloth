import { MantineProvider } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import './App.css'
import { PortfolioWebGL, type PinMode } from './lib/portfolioWebGL'

function App() {
  return (
    <MantineProvider defaultColorScheme="dark">
      <AppInner />
    </MantineProvider>
  )
}

function AppInner() {
  const controllerRef = useRef<PortfolioWebGL | null>(null)
  const realTimeRef = useRef(true)
  const [debugOpen, setDebugOpen] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [realTime, setRealTime] = useState(true)
  const [gravity, setGravity] = useState(9.81)
  const [impulseMultiplier, setImpulseMultiplier] = useState(1)
  const [tessellationSegments, setTessellationSegments] = useState(24)
  const [constraintIterations, setConstraintIterations] = useState(4)
  const [substeps, setSubsteps] = useState(1)
  const [pointerColliderVisible, setPointerColliderVisible] = useState(false)
  const [pinMode, setPinMode] = useState<PinMode>('top')

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
      if (!realTimeRef.current && event.key === ' ') {
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
  }, [])

  useEffect(() => {
    controllerRef.current?.setWireframe(wireframe)
  }, [wireframe])

  useEffect(() => {
    realTimeRef.current = realTime
    controllerRef.current?.setRealTime(realTime)
  }, [realTime])

  useEffect(() => {
    controllerRef.current?.setGravity(gravity)
  }, [gravity])

  useEffect(() => {
    controllerRef.current?.setImpulseMultiplier(impulseMultiplier)
  }, [impulseMultiplier])

  useEffect(() => {
    controllerRef.current?.setConstraintIterations(constraintIterations)
  }, [constraintIterations])

  useEffect(() => {
    controllerRef.current?.setSubsteps(substeps)
  }, [substeps])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller) return
    void controller.setTessellationSegments(tessellationSegments)
  }, [tessellationSegments])

  useEffect(() => {
    controllerRef.current?.setPointerColliderVisible(pointerColliderVisible)
  }, [pointerColliderVisible])

  useEffect(() => {
    controllerRef.current?.setPinMode(pinMode)
  }, [pinMode])

  const modifierKey =
    typeof navigator !== 'undefined' && navigator?.platform?.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'

  return (
    <>
      <main className="demo-shell">
        <h1 className="demo-title">Cloth Playground</h1>
        <p className="demo-copy">
          This minimal scene keeps the DOM simple while we tune the cloth overlay. Click the button below to peel it
          away.
        </p>
        <button className="demo-button cloth-enabled" type="button">
          Peel Back
        </button>
      </main>
      <div className="debug-toast">
        Press <span className="kbd">{modifierKey}</span> + <span className="kbd">J</span> to open the debug palette
      </div>
      {debugOpen ? (
        <div className="debug-overlay" role="dialog" aria-modal="true">
          <div className="debug-card">
            <header className="debug-card__header">
              <div>
                <h2>Debug Settings</h2>
                <p>Control simulation parameters</p>
              </div>
              <button
                className="debug-close"
                onClick={() => setDebugOpen(false)}
                aria-label="Close debug palette"
                type="button"
              >
                ×
              </button>
            </header>
            <div className="debug-card__content">
              <label className="debug-checkbox">
                <span>Wireframe</span>
                <input
                  type="checkbox"
                  checked={wireframe}
                  onChange={(event) => setWireframe(event.target.checked)}
                />
              </label>
              <label className="debug-checkbox">
                <span>Real-Time</span>
                <input
                  type="checkbox"
                  checked={realTime}
                  onChange={(event) => setRealTime(event.target.checked)}
                />
              </label>
              <label className="debug-checkbox">
                <span>Pointer Collider</span>
                <input
                  type="checkbox"
                  checked={pointerColliderVisible}
                  onChange={(event) => setPointerColliderVisible(event.target.checked)}
                />
              </label>
              <label className="debug-label">
                <span>Gravity ({gravity.toFixed(2)} m/s²)</span>
                <input
                  className="debug-range"
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={gravity}
                  onChange={(event) => setGravity(Number.parseFloat(event.target.value))}
                />
              </label>
              <label className="debug-label">
                <span>Impulse Multiplier ({impulseMultiplier.toFixed(2)})</span>
                <input
                  className="debug-range"
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={impulseMultiplier}
                  onChange={(event) => setImpulseMultiplier(Number.parseFloat(event.target.value))}
                />
              </label>
              <label className="debug-label">
                <span>Tessellation ({tessellationSegments} × {tessellationSegments})</span>
                <input
                  className="debug-range"
                  type="range"
                  min="1"
                  max="32"
                  step="1"
                  value={tessellationSegments}
                  onChange={(event) => setTessellationSegments(Number.parseInt(event.target.value, 10))}
                />
              </label>
              <label className="debug-label">
                <span>Constraint Iterations ({constraintIterations})</span>
                <input
                  className="debug-range"
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={constraintIterations}
                  onChange={(event) => setConstraintIterations(Number.parseInt(event.target.value, 10))}
                />
              </label>
              <label className="debug-label">
                <span>Substeps ({substeps})</span>
                <input
                  className="debug-range"
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={substeps}
                  onChange={(event) => setSubsteps(Number.parseInt(event.target.value, 10))}
                />
              </label>
              <label className="debug-label">
                <span>Pin Mode</span>
                <select
                  className="debug-select"
                  value={pinMode}
                  onChange={(event) => setPinMode(event.target.value as PinMode)}
                >
                  <option value="top">Top Edge</option>
                  <option value="bottom">Bottom Edge</option>
                  <option value="corners">Corners</option>
                  <option value="none">None</option>
                </select>
              </label>
              {!realTime ? (
                <button type="button" className="debug-reset" onClick={() => controllerRef.current?.stepOnce()}>
                  Step (Space)
                </button>
              ) : null}
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
                  setTessellationSegments(24)
                  setConstraintIterations(4)
                  setSubsteps(1)
                  setPointerColliderVisible(false)
                  setPinMode('top')
                  setDebugOpen(false)
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
