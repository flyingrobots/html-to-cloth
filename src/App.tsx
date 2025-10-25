import { useEffect, useRef, useState } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

import {
  SimulationRuntime,
  type PinMode,
  DEFAULT_CAMERA_STIFFNESS,
  DEFAULT_CAMERA_DAMPING,
  DEFAULT_CAMERA_ZOOM_STIFFNESS,
  DEFAULT_CAMERA_ZOOM_DAMPING,
} from "./lib/simulationRuntime"

/**
 * Renders keyboard shortcut glyphs within a bordered capsule.
 *
 * @param {{ children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center rounded-md border bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
      {children}
    </span>
  )
}

/**
 * Debug palette dialog that exposes simulation and camera tuning controls.
 *
 * @param {{
 *   open: boolean;
 *   onOpenChange: (open: boolean) => void;
 *   wireframe: boolean;
 *   onWireframeChange: (value: boolean) => void;
 *   realTime: boolean;
 *   onRealTimeChange: (value: boolean) => void;
 *   gravity: number;
 *   onGravityChange: (value: number) => void;
 *   impulseMultiplier: number;
 *   onImpulseMultiplierChange: (value: number) => void;
 *   tessellationSegments: number;
 *   onTessellationChange: (value: number) => void;
 *   constraintIterations: number;
 *   onConstraintIterationsChange: (value: number) => void;
 *   substeps: number;
 *   onSubstepsChange: (value: number) => void;
 *   pointerColliderVisible: boolean;
 *   onPointerColliderVisibleChange: (value: boolean) => void;
 *   pinMode: PinMode;
 *   onPinModeChange: (value: PinMode) => void;
 *   cameraStiffness: number;
 *   onCameraStiffnessChange: (value: number) => void;
 *   cameraDamping: number;
 *   onCameraDampingChange: (value: number) => void;
 *   cameraZoomStiffness: number;
 *   onCameraZoomStiffnessChange: (value: number) => void;
 *   cameraZoomDamping: number;
 *   onCameraZoomDampingChange: (value: number) => void;
 *   onStep: () => void;
 *   onReset: () => void;
 * }} props
 * @returns {JSX.Element}
 */
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
  pointerColliderVisible,
  onPointerColliderVisibleChange,
  pinMode,
  onPinModeChange,
  cameraStiffness,
  onCameraStiffnessChange,
  cameraDamping,
  onCameraDampingChange,
  cameraZoomStiffness,
  onCameraZoomStiffnessChange,
  cameraZoomDamping,
  onCameraZoomDampingChange,
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
  pointerColliderVisible: boolean
  onPointerColliderVisibleChange: (value: boolean) => void
  pinMode: PinMode
  onPinModeChange: (value: PinMode) => void
  cameraStiffness: number
  onCameraStiffnessChange: (value: number) => void
  cameraDamping: number
  onCameraDampingChange: (value: number) => void
  cameraZoomStiffness: number
  onCameraZoomStiffnessChange: (value: number) => void
  cameraZoomDamping: number
  onCameraZoomDampingChange: (value: number) => void
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
      <DialogContent className="max-w-md border-none bg-background p-0">
        <Card>
          <CardHeader>
            <CardTitle>Debug Settings</CardTitle>
            <CardDescription>Control simulation parameters</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold leading-none">Wireframe</p>
                <p className="text-sm text-muted-foreground">Toggle mesh rendering as wireframe</p>
              </div>
              <Switch checked={wireframe} onCheckedChange={onWireframeChange} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold leading-none">Real-Time</p>
                <p className="text-sm text-muted-foreground">Pause simulation to step manually</p>
              </div>
              <Switch checked={realTime} onCheckedChange={onRealTimeChange} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold leading-none">Pointer Collider</p>
                <p className="text-sm text-muted-foreground">Visualize the pointer collision sphere</p>
              </div>
              <Switch checked={pointerColliderVisible} onCheckedChange={onPointerColliderVisibleChange} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Gravity</span>
                <span className="text-muted-foreground">{gravity.toFixed(2)} m/s²</span>
              </div>
              <Slider
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
                value={[substeps]}
                min={1}
                max={8}
                step={1}
                onValueChange={(value) => onSubstepsChange(Math.round(value[0] ?? substeps))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Camera Stiffness</span>
                <span className="text-muted-foreground">{cameraStiffness.toFixed(0)}</span>
              </div>
              <Slider
                value={[cameraStiffness]}
                min={0}
                max={400}
                step={5}
                onValueChange={(value) => onCameraStiffnessChange(Math.round(value[0] ?? cameraStiffness))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Camera Damping</span>
                <span className="text-muted-foreground">{cameraDamping.toFixed(1)}</span>
              </div>
              <Slider
                value={[cameraDamping]}
                min={0}
                max={60}
                step={0.5}
                onValueChange={(value) => onCameraDampingChange(value[0] ?? cameraDamping)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Zoom Stiffness</span>
                <span className="text-muted-foreground">{cameraZoomStiffness.toFixed(0)}</span>
              </div>
              <Slider
                value={[cameraZoomStiffness]}
                min={0}
                max={400}
                step={5}
                onValueChange={(value) =>
                  onCameraZoomStiffnessChange(Math.round(value[0] ?? cameraZoomStiffness))
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Zoom Damping</span>
                <span className="text-muted-foreground">{cameraZoomDamping.toFixed(1)}</span>
              </div>
              <Slider
                value={[cameraZoomDamping]}
                min={0}
                max={60}
                step={0.5}
                onValueChange={(value) => onCameraZoomDampingChange(value[0] ?? cameraZoomDamping)}
              />
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

/**
 * Root interactive demo component that coordinates the WebGL controller and debug palette.
 *
 * @returns {JSX.Element}
 */
function Demo() {
  const controllerRef = useRef<SimulationRuntime | null>(null)
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
  const [pinMode, setPinMode] = useState<PinMode>("top")
  const [cameraStiffness, setCameraStiffness] = useState(DEFAULT_CAMERA_STIFFNESS)
  const [cameraDamping, setCameraDamping] = useState(DEFAULT_CAMERA_DAMPING)
  const [cameraZoomStiffness, setCameraZoomStiffness] = useState(DEFAULT_CAMERA_ZOOM_STIFFNESS)
  const [cameraZoomDamping, setCameraZoomDamping] = useState(DEFAULT_CAMERA_ZOOM_DAMPING)

  useEffect(() => {
    if (typeof window === "undefined") return
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (prefersReducedMotion.matches) return

    const controller = new SimulationRuntime()
    controllerRef.current = controller
    void controller.init()

    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault()
        setDebugOpen((open) => !open)
        return
      }
      if (!realTimeRef.current && event.key === " ") {
        event.preventDefault()
        controller.stepOnce()
      }
    }
    window.addEventListener("keydown", handler)

    return () => {
      window.removeEventListener("keydown", handler)
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

  useEffect(() => {
    controllerRef.current?.setCameraStiffness(cameraStiffness)
  }, [cameraStiffness])

  useEffect(() => {
    controllerRef.current?.setCameraDamping(cameraDamping)
  }, [cameraDamping])

  useEffect(() => {
    controllerRef.current?.setCameraZoomStiffness(cameraZoomStiffness)
  }, [cameraZoomStiffness])

  useEffect(() => {
    controllerRef.current?.setCameraZoomDamping(cameraZoomDamping)
  }, [cameraZoomDamping])

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
        pointerColliderVisible={pointerColliderVisible}
        onPointerColliderVisibleChange={setPointerColliderVisible}
        pinMode={pinMode}
        onPinModeChange={setPinMode}
        cameraStiffness={cameraStiffness}
        onCameraStiffnessChange={setCameraStiffness}
        cameraDamping={cameraDamping}
        onCameraDampingChange={setCameraDamping}
        cameraZoomStiffness={cameraZoomStiffness}
        onCameraZoomStiffnessChange={setCameraZoomStiffness}
        cameraZoomDamping={cameraZoomDamping}
        onCameraZoomDampingChange={setCameraZoomDamping}
        onStep={() => controllerRef.current?.stepOnce()}
        onReset={() => {
          setWireframe(false)
          setRealTime(true)
          setGravity(9.81)
          setImpulseMultiplier(1)
          setTessellationSegments(24)
          setConstraintIterations(4)
          setSubsteps(1)
          setPointerColliderVisible(false)
          setPinMode("top")
          setCameraStiffness(DEFAULT_CAMERA_STIFFNESS)
          setCameraDamping(DEFAULT_CAMERA_DAMPING)
          setCameraZoomStiffness(DEFAULT_CAMERA_ZOOM_STIFFNESS)
          setCameraZoomDamping(DEFAULT_CAMERA_ZOOM_DAMPING)
        }}
      />
    </>
  )
}

/**
 * Application entry that wires the theme provider around the demo.
 *
 * @returns {JSX.Element}
 */
function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Demo />
    </ThemeProvider>
  )
}

export default App
