import { useEffect, useRef, useState } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"

import { ClothSceneController, type PinMode } from "./lib/clothSceneController"
import { EngineActions } from "./engine/debug/engineActions"
import type { CameraSnapshot } from './engine/camera/CameraSystem'
import { PRESETS, getPreset } from "./app/presets"

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center rounded-md border bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
      {children}
    </span>
  )
}

function DebugPalette({
  open,
  onOpenChange,
  wireframe,
  onWireframeChange,
  realTime,
  onRealTimeChange,
  gravity,
  onGravityChange,
  impulseMultiplier,
  onImpulseMultiplierChange,
  tessellationSegments,
  onTessellationChange,
  constraintIterations,
  onConstraintIterationsChange,
  substeps,
  onSubstepsChange,
  sleepVelocity,
  onSleepVelocityChange,
  sleepFrames,
  onSleepFramesChange,
  warmStartPasses,
  onWarmStartPassesChange,
  cameraZoom,
  onCameraZoomChange,
  cameraZoomActual,
  onWarmStartNow,
  onPresetSelect,
  pointerColliderVisible,
  onPointerColliderVisibleChange,
  pinMode,
  onPinModeChange,
  onStep,
  onReset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  wireframe: boolean
  onWireframeChange: (value: boolean) => void
  realTime: boolean
  onRealTimeChange: (value: boolean) => void
  gravity: number
  onGravityChange: (value: number) => void
  impulseMultiplier: number
  onImpulseMultiplierChange: (value: number) => void
  tessellationSegments: number
  onTessellationChange: (value: number) => void
  constraintIterations: number
  onConstraintIterationsChange: (value: number) => void
  substeps: number
  onSubstepsChange: (value: number) => void
  sleepVelocity: number
  onSleepVelocityChange: (value: number) => void
  sleepFrames: number
  onSleepFramesChange: (value: number) => void
  warmStartPasses: number
  onWarmStartPassesChange: (value: number) => void
  cameraZoom: number
  onCameraZoomChange: (value: number) => void
  cameraZoomActual: number
  onWarmStartNow?: () => void
  onPresetSelect?: (name: string) => void
  pointerColliderVisible: boolean
  onPointerColliderVisibleChange: (value: boolean) => void
  pinMode: PinMode
  onPinModeChange: (value: PinMode) => void
  onStep: () => void
  onReset: () => void
}) {
  const pinModeLabels: Record<PinMode, string> = {
    top: "Top Edge",
    bottom: "Bottom Edge",
    corners: "Corners",
    none: "None",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm md:max-w-md border-none bg-background p-0 max-h-[85vh] overflow-y-auto"
        aria-describedby="debug-desc"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Debug Settings</DialogTitle>
          <DialogDescription id="debug-desc">Simulation and render controls</DialogDescription>
        </DialogHeader>
        <Card>
          <CardHeader>
            <CardTitle>Debug Settings</CardTitle>
            <CardDescription>Control simulation parameters</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Preset</span>
                <span className="text-muted-foreground">Quick configuration</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    Choose Preset
                    <ChevronDown className="size-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuRadioGroup value="" onValueChange={(value) => onPresetSelect?.(value)}>
                    {PRESETS.map((p) => (
                      <DropdownMenuRadioItem key={p.name} value={p.name}>
                        {p.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold leading-none">Wireframe</p>
                <p className="text-sm text-muted-foreground">Toggle mesh rendering as wireframe</p>
              </div>
              <Switch aria-label="Wireframe" checked={wireframe} onCheckedChange={onWireframeChange} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold leading-none">Real-Time</p>
                <p className="text-sm text-muted-foreground">Pause simulation to step manually</p>
              </div>
              <Switch aria-label="Real-Time" checked={realTime} onCheckedChange={onRealTimeChange} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold leading-none">Pointer Collider</p>
                <p className="text-sm text-muted-foreground">Visualize the pointer collision sphere</p>
              </div>
              <Switch aria-label="Pointer Collider" checked={pointerColliderVisible} onCheckedChange={onPointerColliderVisibleChange} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Gravity</span>
                <span className="text-muted-foreground">{gravity.toFixed(2)} m/s²</span>
              </div>
              <Slider
                aria-label="Gravity"
                value={[gravity]}
                min={0}
                max={30}
                step={0.5}
                onValueChange={(value) => onGravityChange(value[0] ?? gravity)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Impulse Multiplier</span>
                <span className="text-muted-foreground">{impulseMultiplier.toFixed(2)}</span>
              </div>
              <Slider
                aria-label="Impulse Multiplier"
                value={[impulseMultiplier]}
                min={0.1}
                max={3}
                step={0.1}
                onValueChange={(value) => onImpulseMultiplierChange(value[0] ?? impulseMultiplier)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Tessellation</span>
                <span className="text-muted-foreground">
                  {tessellationSegments} × {tessellationSegments}
                </span>
              </div>
              <Slider
                aria-label="Tessellation"
                value={[tessellationSegments]}
                min={1}
                max={32}
                step={1}
                onValueChange={(value) => onTessellationChange(Math.round(value[0] ?? tessellationSegments))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Constraint Iterations</span>
                <span className="text-muted-foreground">{constraintIterations}</span>
              </div>
              <Slider
                aria-label="Constraint Iterations"
                value={[constraintIterations]}
                min={1}
                max={12}
                step={1}
                onValueChange={(value) => onConstraintIterationsChange(Math.round(value[0] ?? constraintIterations))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Substeps</span>
                <span className="text-muted-foreground">{substeps}</span>
              </div>
              <Slider
                aria-label="Substeps"
                value={[substeps]}
                min={1}
                max={8}
                step={1}
                onValueChange={(value) => onSubstepsChange(Math.round(value[0] ?? substeps))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Sleep Velocity Threshold</span>
                <span className="text-muted-foreground">{sleepVelocity.toExponential(2)}</span>
              </div>
              <Slider
                aria-label="Sleep Velocity Threshold"
                value={[sleepVelocity]}
                min={0}
                max={0.01}
                step={0.0005}
                onValueChange={(value) => onSleepVelocityChange(Number(value[0] ?? sleepVelocity))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Sleep Frame Threshold</span>
                <span className="text-muted-foreground">{sleepFrames}f</span>
              </div>
              <Slider
                aria-label="Sleep Frame Threshold"
                value={[sleepFrames]}
                min={10}
                max={240}
                step={10}
                onValueChange={(value) => onSleepFramesChange(Math.round(value[0] ?? sleepFrames))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Warm Start Passes</span>
                <span className="text-muted-foreground">{warmStartPasses}</span>
              </div>
              <Slider
                value={[warmStartPasses]}
                min={0}
                max={6}
                step={1}
                aria-label="Warm Start Passes"
                onValueChange={(value) => onWarmStartPassesChange(Math.round(value[0] ?? warmStartPasses))}
              />
              <div>
                <Button variant="secondary" onClick={() => onWarmStartNow?.()} className="justify-self-start">
                  Warm Start Now
                </Button>
              </div>
            </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Camera Zoom</span>
              <span className="text-muted-foreground">{cameraZoom.toFixed(2)}×</span>
            </div>
          <Slider
            aria-label="Camera Zoom"
            value={[cameraZoom]}
            min={0.5}
            max={3}
            step={0.1}
            onValueChange={(value) => onCameraZoomChange(value[0] ?? cameraZoom)}
          />
        </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Camera Zoom (Actual)</span>
                <span className="text-muted-foreground">{cameraZoomActual.toFixed(2)}×</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Pin Mode</span>
                <span className="text-muted-foreground">{pinModeLabels[pinMode]}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {pinModeLabels[pinMode]}
                    <ChevronDown className="size-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuRadioGroup
                    value={pinMode}
                    onValueChange={(value) => onPinModeChange(value as PinMode)}
                  >
                    <DropdownMenuRadioItem value="top">Top Edge</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="bottom">Bottom Edge</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="corners">Corners</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {!realTime ? (
              <Button variant="secondary" onClick={onStep} className="justify-self-start">
                Step (Space)
              </Button>
            ) : null}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={onReset}>
              Reset
            </Button>
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  )
}

function Demo() {
  const controllerRef = useRef<ClothSceneController | null>(null)
  const actionsRef = useRef<EngineActions | null>(null)
  const realTimeRef = useRef(true)
  const [debugOpen, setDebugOpen] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [realTime, setRealTime] = useState(true)
  const [gravity, setGravity] = useState(2)
  const [impulseMultiplier, setImpulseMultiplier] = useState(1)
  const [tessellationSegments, setTessellationSegments] = useState(24)
  const [constraintIterations, setConstraintIterations] = useState(6)
  const [substeps, setSubsteps] = useState(2)
  const [sleepVelocity, setSleepVelocity] = useState(0.001)
  const [sleepFrames, setSleepFrames] = useState(60)
  const [warmStartPasses, setWarmStartPasses] = useState(2)
  const [cameraZoom, setCameraZoom] = useState(1)
  const [cameraZoomActual, setCameraZoomActual] = useState(1)
  const [pointerColliderVisible, setPointerColliderVisible] = useState(false)
  const [pinMode, setPinMode] = useState<PinMode>("top")

  useEffect(() => {
    if (typeof window === "undefined") return
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (prefersReducedMotion.matches) return

    const controller = new ClothSceneController()
    controllerRef.current = controller
    void controller.init().then(async () => {
      try {
        const { RenderSettingsState } = await import('./engine/render/RenderSettingsState')
        actionsRef.current = new EngineActions({
          runner: controller.getRunner(),
          world: controller.getEngine(),
          camera: controller.getCameraSystem() ?? undefined,
          simulation: controller.getSimulationSystem() ?? undefined,
          overlay: controller.getOverlayState() ?? undefined,
          renderSettings: new RenderSettingsState(),
          setTessellation: (segments: number) => controller.setTessellationSegments(segments),
          setPinMode: (mode) => controller.setPinMode(mode),
        })
        // Seed camera zoom target; inspector will poll after changes.
        actionsRef.current.setCameraTargetZoom(cameraZoom)
        // Seed inspector from snapshot if available.
        const snap = actionsRef.current.getCameraSnapshot?.()
        if (snap && typeof snap.zoom === 'number') {
          setCameraZoomActual(snap.zoom)
        }
        // Seed gravity and iterations to reflect UI defaults.
        actionsRef.current.setGravityScalar(gravity)
        actionsRef.current.setConstraintIterations(constraintIterations)
        // Seed sleep thresholds default for new activations and current bodies.
        controller.setSleepConfig({ velocityThreshold: sleepVelocity, frameThreshold: sleepFrames })
        actionsRef.current.setSleepConfig(sleepVelocity, sleepFrames)
      } catch (err) {
        // In tests or reduced-motion scenarios, controller internals may be absent.
        if (import.meta?.env?.MODE !== 'test') {
          console.warn('EngineActions init failed:', err)
        }
      }
    })

    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault()
        setDebugOpen((open) => !open)
        return
      }
      if (!realTimeRef.current && event.key === " ") {
        event.preventDefault()
        if (actionsRef.current) {
          actionsRef.current.stepOnce()
        } else {
          controller.stepOnce()
        }
      }
    }
    window.addEventListener("keydown", handler)

    return () => {
      window.removeEventListener("keydown", handler)
      controller.dispose()
      controllerRef.current = null
      actionsRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    actionsRef.current?.setWireframe(wireframe)
  }, [wireframe])

  useEffect(() => {
    realTimeRef.current = realTime
    actionsRef.current?.setRealTime(realTime)
    if (!actionsRef.current) controllerRef.current?.setRealTime(realTime)
  }, [realTime])

  // Keep the feel from the earlier xforms work: when the debug drawer is open,
  // pause the simulation (remembering prior real-time state) and hide the pointer gizmo.
  useEffect(() => {
    const actions = actionsRef.current
    if (!actions) return
    // Track whether we forced a pause so we can restore it on close
    let forcedPause = false
    if (debugOpen) {
      if (realTimeRef.current) {
        actions.setRealTime(false)
        realTimeRef.current = false
        forcedPause = true
        setRealTime(false)
      }
      actions.setPointerOverlayVisible(false)
    } else {
      actions.setPointerOverlayVisible(pointerColliderVisible)
    }
    return () => {
      // If we forced a pause due to opening the drawer within this effect run, restore it when closing/unmounting.
      if (forcedPause) {
        actions.setRealTime(true)
        realTimeRef.current = true
        setRealTime(true)
      }
    }
  }, [debugOpen, pointerColliderVisible])

  useEffect(() => {
    actionsRef.current?.setGravityScalar(gravity)
    if (!actionsRef.current) controllerRef.current?.setGravity(gravity)
  }, [gravity])

  useEffect(() => {
    controllerRef.current?.setImpulseMultiplier(impulseMultiplier)
  }, [impulseMultiplier])

  useEffect(() => {
    actionsRef.current?.setConstraintIterations(constraintIterations)
    if (!actionsRef.current) controllerRef.current?.setConstraintIterations(constraintIterations)
  }, [constraintIterations])

  useEffect(() => {
    // Update default + broadcast when sleep thresholds change
    controllerRef.current?.setSleepConfig({ velocityThreshold: sleepVelocity, frameThreshold: sleepFrames })
    actionsRef.current?.setSleepConfig(sleepVelocity, sleepFrames)
  }, [sleepVelocity, sleepFrames])

  useEffect(() => {
    actionsRef.current?.setSubsteps(substeps)
    if (!actionsRef.current) controllerRef.current?.setSubsteps(substeps)
  }, [substeps])

  useEffect(() => {
    if (!actionsRef.current) {
      setCameraZoomActual(cameraZoom)
      return
    }
    actionsRef.current.setCameraTargetZoom(cameraZoom)
    let rafId = 0
    type ActionsWithSnapshot = EngineActions & { getCameraSnapshot: () => CameraSnapshot | undefined }
    const poll = () => {
      const snap = (actionsRef.current as unknown as ActionsWithSnapshot | null)?.getCameraSnapshot?.()
      if (snap && typeof snap.zoom === 'number') {
        setCameraZoomActual(snap.zoom)
        const animating = Math.abs(snap.zoom - cameraZoom) > 0.01 || Math.abs(snap.zoomVelocity ?? 0) > 0.001
        if (animating) rafId = requestAnimationFrame(poll)
      } else {
        rafId = requestAnimationFrame(poll)
      }
    }
    rafId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafId)
  }, [cameraZoom])

  useEffect(() => {
    void actionsRef.current?.setTessellation(tessellationSegments)
  }, [tessellationSegments])

  useEffect(() => {
    actionsRef.current?.setPointerOverlayVisible(pointerColliderVisible)
  }, [pointerColliderVisible])

  useEffect(() => {
    actionsRef.current?.setPinMode(pinMode)
    if (!actionsRef.current) controllerRef.current?.setPinMode(pinMode)
  }, [pinMode])

  const modifierKey =
    typeof navigator !== "undefined" && navigator?.platform?.toLowerCase().includes("mac") ? "⌘" : "Ctrl"

  return (
    <>
      <div className="fixed right-6 top-6 z-40">
        <ModeToggle />
      </div>
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_top,#eef2ff_0%,#f8fafc_100%)] px-6 py-12 text-center text-slate-900 dark:bg-[radial-gradient(circle_at_top,#0f172a_0%,#1e293b_100%)] dark:text-slate-100">
        <h1 className="text-4xl font-bold md:text-5xl">Cloth Playground</h1>
        <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
          This minimal scene keeps the DOM simple while we tune the cloth overlay. Click the button below to peel it
          away.
        </p>
        <Button className="cloth-enabled px-8 py-6 text-base font-semibold shadow-lg" size="lg">
          Peel Back
        </Button>
      </main>
      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-2 text-sm text-slate-100 shadow-lg backdrop-blur">
        Press <Kbd>{modifierKey}</Kbd> + <Kbd>J</Kbd> to open the debug palette
      </div>
      <DebugPalette
        open={debugOpen}
        onOpenChange={setDebugOpen}
        wireframe={wireframe}
        onWireframeChange={setWireframe}
        realTime={realTime}
        onRealTimeChange={setRealTime}
        gravity={gravity}
        onGravityChange={setGravity}
        impulseMultiplier={impulseMultiplier}
        onImpulseMultiplierChange={setImpulseMultiplier}
        tessellationSegments={tessellationSegments}
        onTessellationChange={setTessellationSegments}
        constraintIterations={constraintIterations}
        onConstraintIterationsChange={setConstraintIterations}
        substeps={substeps}
        onSubstepsChange={setSubsteps}
        sleepVelocity={sleepVelocity}
        onSleepVelocityChange={setSleepVelocity}
        sleepFrames={sleepFrames}
        onSleepFramesChange={setSleepFrames}
        warmStartPasses={warmStartPasses}
        onWarmStartPassesChange={setWarmStartPasses}
        cameraZoom={cameraZoom}
        onCameraZoomChange={setCameraZoom}
        cameraZoomActual={cameraZoomActual}
        onWarmStartNow={() => actionsRef.current?.warmStartNow(warmStartPasses, constraintIterations)}
        onPresetSelect={(name: string) => {
          const p = getPreset(name)
          if (!p) return
          setGravity(p.gravity)
          setConstraintIterations(p.iterations)
          setSleepVelocity(p.sleepVelocity)
          setSleepFrames(p.sleepFrames)
          setWarmStartPasses(p.warmStartPasses)
          setCameraZoom(p.cameraZoom)
        }}
        pointerColliderVisible={pointerColliderVisible}
        onPointerColliderVisibleChange={setPointerColliderVisible}
        pinMode={pinMode}
        onPinModeChange={setPinMode}
        onStep={() => actionsRef.current?.stepOnce()}
        onReset={() => {
          setWireframe(false)
          setRealTime(true)
          setGravity(9.81)
          setImpulseMultiplier(1)
          setTessellationSegments(24)
          setConstraintIterations(4)
          setSubsteps(1)
          setCameraZoom(1)
          setPointerColliderVisible(false)
          setPinMode("top")
          // Apply seeded defaults
          controllerRef.current?.setSleepConfig({ velocityThreshold: 0.001, frameThreshold: 60 })
          actionsRef.current?.setSleepConfig(0.001, 60)
        }}
      />
    </>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Demo />
    </ThemeProvider>
  )
}

export default App
