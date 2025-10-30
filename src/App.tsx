import { useEffect, useRef, useState } from "react"
import {
  MantineProvider,
  Button,
  Drawer,
  Card,
  Text,
  Group,
  Stack,
  Switch,
  Slider,
  Menu,
  Paper,
  Affix,
  Title,
  Divider,
} from "@mantine/core"
import { IconChevronDown } from "@tabler/icons-react"

import { ClothSceneController, type PinMode } from "./lib/clothSceneController"
import { EngineActions } from "./engine/debug/engineActions"
import type { CameraSnapshot } from './engine/camera/CameraSystem'
import { PRESETS, getPreset } from "./app/presets"

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <Paper withBorder radius="sm" px={6} py={2} component="span" style={{ fontFamily: 'monospace', fontSize: 12 }}>
      {children}
    </Paper>
  )
}

type DebugProps = {
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
}

function DebugPalette(props: DebugProps) {
  const {
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
  } = props

  const pinModeLabels: Record<PinMode, string> = {
    top: "Top Edge",
    bottom: "Bottom Edge",
    corners: "Corners",
    none: "None",
  }

  return (
    <Drawer opened={open} onClose={() => onOpenChange(false)} position="right" size={380} withCloseButton zIndex={2100}>
      <Card withBorder shadow="sm">
        <Stack gap="md">
          <Stack gap={0}
          >
            <Title order={3}>Debug Settings</Title>
            <Text c="dimmed" size="sm">Control simulation parameters</Text>
          </Stack>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={0}
              >
                <Text fw={600}>Presets</Text>
                <Text size="sm" c="dimmed">Quick configuration</Text>
              </Stack>
              <Menu withinPortal>
                <Menu.Target>
                  <Button variant="default" rightSection={<IconChevronDown size={16} />}>Choose Preset</Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {PRESETS.map((p) => (
                    <Menu.Item key={p.name} onClick={() => onPresetSelect?.(p.name)}>{p.name}</Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            </Group>
            <Group justify="space-between">
              <Stack gap={0}
              >
                <Text fw={600}>Wireframe</Text>
                <Text size="sm" c="dimmed">Toggle mesh rendering as wireframe</Text>
              </Stack>
              <Switch aria-label="Wireframe" checked={wireframe} onChange={(e) => onWireframeChange(e.currentTarget.checked)} />
            </Group>
            <Group justify="space-between">
              <Stack gap={0}
              >
                <Text fw={600}>Real-Time</Text>
                <Text size="sm" c="dimmed">Pause simulation to step manually</Text>
              </Stack>
              <Switch aria-label="Real-Time" checked={realTime} onChange={(e) => onRealTimeChange(e.currentTarget.checked)} />
            </Group>
            <Group justify="space-between">
              <Stack gap={0}
              >
                <Text fw={600}>Pointer Collider</Text>
                <Text size="sm" c="dimmed">Visualize the pointer collision sphere</Text>
              </Stack>
              <Switch aria-label="Pointer Collider" checked={pointerColliderVisible} onChange={(e) => onPointerColliderVisibleChange(e.currentTarget.checked)} />
            </Group>
            <Stack gap={4}
            >
              <Group justify="space-between">
                <Text fw={500}>Gravity</Text>
                <Text c="dimmed">{gravity.toFixed(2)} m/s²</Text>
              </Group>
              <Slider aria-label="Gravity" value={gravity} min={0} max={30} step={0.5} onChange={onGravityChange} />
            </Stack>
            <Stack gap={4}
            >
              <Group justify="space-between">
                <Text fw={500}>Impulse Multiplier</Text>
                <Text c="dimmed">{impulseMultiplier.toFixed(2)}</Text>
              </Group>
              <Slider aria-label="Impulse Multiplier" value={impulseMultiplier} min={0.1} max={3} step={0.1} onChange={onImpulseMultiplierChange} />
            </Stack>
            <Stack gap={4}
            >
              <Group justify="space-between">
                <Text fw={500}>Tessellation</Text>
                <Text c="dimmed">{tessellationSegments} × {tessellationSegments}</Text>
              </Group>
              <Slider aria-label="Tessellation" value={tessellationSegments} min={1} max={32} step={1} onChange={(v) => onTessellationChange(Math.round(v))} />
            </Stack>
            <Stack gap={4}
            >
              <Group justify="space-between">
                <Text fw={500}>Constraint Iterations</Text>
                <Text c="dimmed">{constraintIterations}</Text>
              </Group>
              <Slider aria-label="Constraint Iterations" value={constraintIterations} min={1} max={12} step={1} onChange={(v) => onConstraintIterationsChange(Math.round(v))} />
            </Stack>
            <Stack gap={4}
            >
              <Group justify="space-between">
                <Text fw={500}>Substeps</Text>
                <Text c="dimmed">{substeps}</Text>
              </Group>
              <Slider aria-label="Substeps" value={substeps} min={1} max={8} step={1} onChange={(v) => onSubstepsChange(Math.round(v))} />
            </Stack>
            <Stack gap={4}
            >
              <Group justify="space-between">
                <Text fw={500}>Sleep Velocity Threshold</Text>
                <Text c="dimmed">{sleepVelocity.toExponential(2)}</Text>
              </Group>
              <Slider aria-label="Sleep Velocity Threshold" value={sleepVelocity} min={0} max={0.01} step={0.0005} onChange={(v) => onSleepVelocityChange(Number(v))} />
            </Stack>
            <Stack gap={4}
            >
              <Group justify="space-between">
                <Text fw={500}>Sleep Frame Threshold</Text>
                <Text c="dimmed">{sleepFrames}f</Text>
              </Group>
              <Slider aria-label="Sleep Frame Threshold" value={sleepFrames} min={10} max={240} step={10} onChange={(v) => onSleepFramesChange(Math.round(v))} />
            </Stack>
            <Stack gap={4}
            >
              <Group justify="space-between">
                <Text fw={500}>Warm Start Passes</Text>
                <Text c="dimmed">{warmStartPasses}</Text>
              </Group>
              <Slider aria-label="Warm Start Passes" value={warmStartPasses} min={0} max={6} step={1} onChange={(v) => onWarmStartPassesChange(Math.round(v))} />
              <Button variant="default" onClick={() => onWarmStartNow?.()}>Warm Start Now</Button>
            </Stack>
            <Stack gap={4}
            >
              <Group justify="space-between">
                <Text fw={500}>Camera Zoom</Text>
                <Text c="dimmed">{cameraZoom.toFixed(2)}×</Text>
              </Group>
              <Slider aria-label="Camera Zoom" value={cameraZoom} min={0.5} max={3} step={0.1} onChange={onCameraZoomChange} />
            </Stack>
            <Group justify="space-between">
              <Text fw={500}>Camera Zoom (Actual)</Text>
              <Text c="dimmed">{cameraZoomActual.toFixed(2)}×</Text>
            </Group>
            <Stack gap={4}
            >
              <Group justify="space-between">
                <Text fw={500}>Pin Mode</Text>
                <Text c="dimmed">{pinModeLabels[pinMode]}</Text>
              </Group>
              <Menu withinPortal>
                <Menu.Target>
                  <Button variant="default" rightSection={<IconChevronDown size={16} />}>{pinModeLabels[pinMode]}</Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => onPinModeChange('top')}>Top Edge</Menu.Item>
                  <Menu.Item onClick={() => onPinModeChange('bottom')}>Bottom Edge</Menu.Item>
                  <Menu.Item onClick={() => onPinModeChange('corners')}>Corners</Menu.Item>
                  <Menu.Item onClick={() => onPinModeChange('none')}>None</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Stack>
            {!realTime ? <Button variant="default" onClick={onStep}>Step (Space)</Button> : null}
          </Stack>
          <Divider />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => onOpenChange(false)}>Close</Button>
            <Button variant="outline" onClick={onReset}>Reset</Button>
          </Group>
        </Stack>
      </Card>
    </Drawer>
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
  const [pinMode, setPinMode] = useState<PinMode>('top')

  useEffect(() => {
    const controller = new ClothSceneController()
    controllerRef.current = controller
    controller.init().then(() => {
      try {
        const getRS = (controller as any).getRenderSettingsState?.bind(controller)
        const actions = new EngineActions({
          runner: controller.getRunner(),
          world: controller.getEngine(),
          camera: controller.getCameraSystem() ?? undefined,
          simulation: controller.getSimulationSystem() ?? undefined,
          overlay: controller.getOverlayState() ?? undefined,
          renderSettings: (typeof getRS === 'function' ? getRS() : undefined) ?? undefined,
          setTessellation: (segments: number) => controller.setTessellationSegments(segments),
          setPinMode: (mode) => controller.setPinMode(mode),
        })
        actionsRef.current = actions
        actionsRef.current.setCameraTargetZoom(cameraZoom)
        const snap = actionsRef.current.getCameraSnapshot?.()
        if (snap && typeof snap.zoom === 'number') {
          setCameraZoomActual(snap.zoom)
        }
        actionsRef.current.setGravityScalar(gravity)
        actionsRef.current.setConstraintIterations(constraintIterations)
        controller.setSleepConfig({ velocityThreshold: sleepVelocity, frameThreshold: sleepFrames })
        actionsRef.current.setSleepConfig(sleepVelocity, sleepFrames)
      } catch (err) {
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

  useEffect(() => {
    const actions = actionsRef.current
    if (!actions) return
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
      if (forcedPause) {
        actions.setRealTime(true)
        realTimeRef.current = true
        setRealTime(true)
      }
    }
  }, [debugOpen])

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

  const modifierKey = typeof navigator !== "undefined" && navigator?.platform?.toLowerCase().includes("mac") ? "⌘" : "Ctrl"

  return (
    <>
      <Group justify="center" style={{ minHeight: '100vh' }}>
        <Stack align="center" gap="md">
          <Title order={1}>Cloth Playground</Title>
          <Text size="sm" maw={560} ta="center">
            This minimal scene keeps the DOM simple while we tune the cloth overlay. Click the button below to peel it away.
          </Text>
          <Button className="cloth-enabled" size="lg">Peel Back</Button>
        </Stack>
      </Group>
      <Affix position={{ bottom: 24, left: '50%' as any }}>
        <Paper radius="xl" px="md" py={8} withBorder>
          <Group gap={6} align="center">
            <Text size="sm">Press</Text>
            <Kbd>{modifierKey}</Kbd>
            <Text size="sm">+</Text>
            <Kbd>J</Kbd>
            <Text size="sm">to open the debug palette</Text>
          </Group>
        </Paper>
      </Affix>
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
          controllerRef.current?.setSleepConfig({ velocityThreshold: 0.001, frameThreshold: 60 })
          actionsRef.current?.setSleepConfig(0.001, 60)
        }}
      />
    </>
  )
}

function App() {
  return (
    <MantineProvider defaultColorScheme="dark">
      <Demo />
    </MantineProvider>
  )
}

export default App
