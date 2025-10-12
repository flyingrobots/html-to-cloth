import { useEffect, useRef, useState } from "react"
import { Moon, Sun } from "lucide-react"

import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter as CardFooterBase,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"

import { PortfolioWebGL } from "./lib/portfolioWebGL"

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
  onStep: () => void
  onReset: () => void
}) {
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
            {!realTime ? (
              <Button variant="secondary" onClick={onStep} className="justify-self-start">
                Step (Space)
              </Button>
            ) : null}
          </CardContent>
          <CardFooterBase className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={onReset}>
              Reset
            </Button>
          </CardFooterBase>
        </Card>
      </DialogContent>
    </Dialog>
  )
}

function Demo() {
  const controllerRef = useRef<PortfolioWebGL | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [realTime, setRealTime] = useState(true)
  const [gravity, setGravity] = useState(9.81)
  const [impulseMultiplier, setImpulseMultiplier] = useState(1)

  useEffect(() => {
    if (typeof window === "undefined") return
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (prefersReducedMotion.matches) return

    const controller = new PortfolioWebGL()
    controllerRef.current = controller
    void controller.init()

    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault()
        setDebugOpen((open) => !open)
        return
      }
      if (!realTime && event.key === " ") {
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
        onStep={() => controllerRef.current?.stepOnce()}
        onReset={() => {
          setWireframe(false)
          setRealTime(true)
          setGravity(9.81)
          setImpulseMultiplier(1)
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
