import { useEffect, useRef, useState } from "react"
import {
  MantineProvider,
  Button,
  Text,
  Group,
  Stack,
  Switch,
  Slider,
  Paper,
  Affix,
  Title,
  Divider,
  Select,
  Kbd,
  Accordion,
  Menu,
} from "@mantine/core"
import type { DebugOverlayState } from './engine/render/DebugOverlayState'

import { ClothSceneController, type PinMode } from "./lib/clothSceneController"
import { EngineActions } from "./engine/debug/engineActions"
import type { CameraSnapshot } from './engine/camera/CameraSystem'
import { PRESETS, getPreset } from "./app/presets"

// Use Mantine's native Kbd component (no inline styles)

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
  autoTessellation?: boolean
  onAutoTessellationChange?: (value: boolean) => void
  tessellationMin?: number
  tessellationMax?: number
  onTessellationMinChange?: (value: number) => void
  onTessellationMaxChange?: (value: number) => void
  constraintIterations: number
  onConstraintIterationsChange: (value: number) => void
  substeps: number
  onSubstepsChange: (value: number) => void
  sleepVelocity: number
  onSleepVelocityChange: (value: number) => void
  sleepFrames: number
  onSleepFramesChange: (value: number) => void
  worldSleepGuard?: boolean
  onWorldSleepGuardChange?: (value: boolean) => void
  warmStartPasses: number
  onWarmStartPassesChange: (value: number) => void
  cameraZoom: number
  onCameraZoomChange: (value: number) => void
  cameraZoomActual: number
  onWarmStartNow?: () => void
  onPresetSelect?: (name: string) => void
  presetValue?: string | null
  pointerColliderVisible: boolean
  onPointerColliderVisibleChange: (value: boolean) => void
  drawAABBs: boolean
  onDrawAABBsChange: (value: boolean) => void
  drawSleep: boolean
  onDrawSleepChange: (value: boolean) => void
  drawPins: boolean
  onDrawPinsChange: (value: boolean) => void
  drawSpheres?: boolean
  onDrawSpheresChange?: (value: boolean) => void
  showPanelBounds?: boolean
  onShowPanelBoundsChange?: (value: boolean) => void
  broadphaseMode?: 'sphere' | 'fatAABB'
  onBroadphaseModeChange?: (m: 'sphere' | 'fatAABB') => void
  drawFatAABBs?: boolean
  onDrawFatAABBsChange?: (v: boolean) => void
  pinMode: PinMode
  onPinModeChange: (value: PinMode) => void
  onStep: () => void
  onReset: () => void
  // Optional helper passed by parent to clothify the panel element
  clothifyElement?: (el: HTMLElement) => Promise<void>
  restoreElement?: (el: HTMLElement) => Promise<void>
  addOverlayElement?: (el: HTMLElement) => void
  removeOverlayElement?: (el: HTMLElement) => void
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
    autoTessellation,
    onAutoTessellationChange,
    tessellationMin,
    tessellationMax,
    onTessellationMinChange,
    onTessellationMaxChange,
    constraintIterations,
    onConstraintIterationsChange,
    substeps,
    onSubstepsChange,
    sleepVelocity,
    onSleepVelocityChange,
    sleepFrames,
    onSleepFramesChange,
    worldSleepGuard,
    onWorldSleepGuardChange,
    warmStartPasses,
    onWarmStartPassesChange,
    cameraZoom,
    onCameraZoomChange,
    cameraZoomActual,
    onWarmStartNow,
    onPresetSelect,
    presetValue,
    pointerColliderVisible,
    onPointerColliderVisibleChange,
    pinMode,
    onPinModeChange,
    onStep,
    onReset,
  } = props

  // (labels kept close to Select entries)

  const panelRef = useRef<HTMLDivElement | null>(null)

  // If the panel is reopened after being clothified, restore it to static DOM to avoid
  // double images and transparency blending with the cloth copy.
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    if (open && props.restoreElement) {
      // Ensure any previously clothified panel is restored to DOM for interactivity
      Promise.resolve(props.restoreElement(el)).catch(() => {})
    }
    // Register/unregister the panel as a static collider so its AABB/sphere draw in the overlay
    if (open && props.showPanelBounds) props.addOverlayElement?.(el)
    else props.removeOverlayElement?.(el)
  }, [open, props, props.showPanelBounds])

  return (
    <Affix position={{ top: 16, right: 16 }} zIndex={2100}>
      <Paper
        ref={panelRef}
        // Do NOT mark as 'cloth-enabled' at init; we clothify on demand via Hide.
        withBorder
        shadow="lg"
        p="md"
        w={380}
        style={{
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          // Hide via visual opacity to keep element capturable by html2canvas when needed
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <Stack gap="md">
          <Stack gap={0}>
            <Title order={3}>Debug Settings</Title>
            <Text c="dimmed" size="sm">Control simulation parameters</Text>
          </Stack>
          {/* Compact status row */}
          <Paper withBorder radius="sm" p="xs">
            <Group gap="xs" justify="space-between" wrap="wrap">
              <Text size="xs">Real-Time: {realTime ? 'ON' : 'OFF'}</Text>
              <Text size="xs">g: {gravity.toFixed(2)} m/s²</Text>
              <Text size="xs">Substeps: {substeps}</Text>
              <Text size="xs">Iterations: {constraintIterations}</Text>
            </Group>
          </Paper>
          <Accordion multiple chevronPosition="right" defaultValue={["presets", "physics", "sleep", "view"]} variant="contained">
            <Accordion.Item value="presets">
              <Accordion.Control>Presets</Accordion.Control>
              <Accordion.Panel>
                <Select
                  aria-label="Presets"
                  placeholder="Choose preset"
                  data={PRESETS.map((p) => ({ value: p.name, label: p.name }))}
                  comboboxProps={{ withinPortal: true, zIndex: 2300 }}
                  value={presetValue ?? null}
                  onChange={(v) => { if (v) onPresetSelect?.(v) }}
                />
                <Group justify="space-between" mt="sm">
                  <Stack gap={0}>
                    <Text fw={600}>Wireframe</Text>
                    <Text size="sm" c="dimmed">Toggle mesh rendering as wireframe</Text>
                  </Stack>
                  <Switch aria-label="Wireframe" checked={wireframe} onChange={(e) => onWireframeChange(e.currentTarget.checked)} />
                </Group>
                <Group justify="space-between" mt="sm">
                  <Stack gap={0}>
                    <Text fw={600}>Pin Mode</Text>
                    <Text size="sm" c="dimmed">Choose pinned vertices</Text>
                  </Stack>
                  <Menu withinPortal position="bottom-end" shadow="sm" zIndex={2300}>
                    <Menu.Target>
                      <Button variant="default">{pinMode.charAt(0).toUpperCase() + pinMode.slice(1)}</Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item onClick={() => onPinModeChange('none')}>None</Menu.Item>
                      <Menu.Item onClick={() => onPinModeChange('top')}>Top</Menu.Item>
                      <Menu.Item onClick={() => onPinModeChange('bottom')}>Bottom</Menu.Item>
                      <Menu.Item onClick={() => onPinModeChange('corners')}>Corners</Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="physics">
              <Accordion.Control>Physics</Accordion.Control>
              <Accordion.Panel>
                <Group justify="space-between">
                  <Stack gap={0}>
                    <Text fw={600}>Real-Time</Text>
                    <Text size="sm" c="dimmed">Pause simulation to step manually</Text>
                  </Stack>
                  <Switch aria-label="Real-Time" checked={realTime} onChange={(e) => onRealTimeChange(e.currentTarget.checked)} />
                </Group>
                <Stack gap={4} mt="sm">
                  <Group justify="space-between">
                    <Text fw={500}>Gravity</Text>
                    <Text c="dimmed">{gravity.toFixed(2)} m/s²</Text>
                  </Group>
                  <Slider aria-label="Gravity" value={gravity} min={0} max={30} step={0.5} onChange={onGravityChange} />
                </Stack>
                <Stack gap={4} mt="sm">
                  <Group justify="space-between">
                    <Text fw={500}>Impulse Multiplier</Text>
                    <Text c="dimmed">{impulseMultiplier.toFixed(2)}</Text>
                  </Group>
                  <Slider aria-label="Impulse Multiplier" value={impulseMultiplier} min={0.1} max={3} step={0.1} onChange={onImpulseMultiplierChange} />
                </Stack>
                <Stack gap={4} mt="sm">
                  <Group justify="space-between">
                    <Text fw={500}>Constraint Iterations</Text>
                    <Text c="dimmed">{constraintIterations}</Text>
                  </Group>
                  <Slider aria-label="Constraint Iterations" value={constraintIterations} min={1} max={12} step={1} onChange={(v) => onConstraintIterationsChange(Math.round(v))} />
                </Stack>
                <Stack gap={4} mt="sm">
                  <Group justify="space-between">
                    <Text fw={500}>Substeps</Text>
                    <Text c="dimmed">{substeps}</Text>
                  </Group>
                  <Slider aria-label="Substeps" value={substeps} min={1} max={8} step={1} onChange={(v) => onSubstepsChange(Math.round(v))} />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="tessellation">
              <Accordion.Control>Tessellation</Accordion.Control>
              <Accordion.Panel>
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Text fw={500}>Tessellation</Text>
                    <Text c="dimmed">{tessellationSegments} × {tessellationSegments}</Text>
                  </Group>
                  <Slider aria-label="Tessellation" value={tessellationSegments} min={1} max={32} step={1} onChange={(v) => onTessellationChange(Math.round(v))} />
                  <Group justify="space-between">
                    <Stack gap={0}>
                      <Text fw={600}>Auto Tessellation</Text>
                      <Text size="sm" c="dimmed">Scale segments by on-screen size</Text>
                    </Stack>
                    <Switch aria-label="Auto Tessellation" checked={!!autoTessellation} onChange={(e) => onAutoTessellationChange?.(e.currentTarget.checked)} />
                  </Group>
                  {autoTessellation ? (
                    <>
                      <Group justify="space-between">
                        <Text fw={500}>Min Segments</Text>
                        <Text c="dimmed">{tessellationMin}</Text>
                      </Group>
                      <Slider aria-label="Tessellation Min" value={tessellationMin ?? 6} min={1} max={46} step={1} onChange={(v) => onTessellationMinChange?.(Math.round(v))} />
                      <Group justify="space-between">
                        <Text fw={500}>Max Segments</Text>
                        <Text c="dimmed">{tessellationMax}</Text>
                      </Group>
                      <Slider aria-label="Tessellation Max" value={tessellationMax ?? 24} min={(tessellationMin ?? 6) + 2} max={48} step={1} onChange={(v) => onTessellationMaxChange?.(Math.round(v))} />
                    </>
                  ) : null}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="sleep">
              <Accordion.Control>Sleep & Warm Start</Accordion.Control>
              <Accordion.Panel>
                <Stack gap={6}>
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text fw={500}>Sleep Velocity Threshold</Text>
                      <Text c="dimmed">{sleepVelocity.toExponential(2)}</Text>
                    </Group>
                    <Slider aria-label="Sleep Velocity Threshold" value={sleepVelocity} min={0} max={0.01} step={0.0005} onChange={(v) => onSleepVelocityChange(Number(v))} />
                  </Stack>
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text fw={500}>Sleep Frame Threshold</Text>
                      <Text c="dimmed">{sleepFrames}f</Text>
                    </Group>
                    <Slider aria-label="Sleep Frame Threshold" value={sleepFrames} min={10} max={240} step={10} onChange={(v) => onSleepFramesChange(Math.round(v))} />
                  </Stack>
                  <Group justify="space-between">
                    <Stack gap={0}>
                      <Text fw={600}>World Sleep Guard</Text>
                      <Text size="sm" c="dimmed">Delay sleep until world-space still</Text>
                    </Stack>
                    <Switch aria-label="World Sleep Guard" checked={!!worldSleepGuard} onChange={(e) => onWorldSleepGuardChange?.(e.currentTarget.checked)} />
                  </Group>
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text fw={500}>Warm Start Passes</Text>
                      <Text c="dimmed">{warmStartPasses}</Text>
                    </Group>
                    <Slider aria-label="Warm Start Passes" value={warmStartPasses} min={0} max={6} step={1} onChange={(v) => onWarmStartPassesChange(Math.round(v))} />
                    <Button variant="default" onClick={() => onWarmStartNow?.()}>Warm Start Now</Button>
                  </Stack>
                  <Divider my="sm" />
                  <Group justify="space-between" align="center">
                    <Stack gap={0}>
                      <Text fw={600}>Broad-phase</Text>
                      <Text size="sm" c="dimmed">Choose wake strategy for sleeping bodies</Text>
                    </Stack>
                  <Select
                      aria-label="Broad-phase Mode"
                      data={[{ value: 'fatAABB', label: 'Fat AABB' }, { value: 'sphere', label: 'Sphere' }]}
                      value={props.broadphaseMode ?? 'fatAABB'}
                      onChange={(v) => v && props.onBroadphaseModeChange?.(v as 'sphere' | 'fatAABB')}
                      comboboxProps={{ withinPortal: true, zIndex: 2300 }}
                      w={160}
                    />
                  </Group>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="overlays">
              <Accordion.Control>Overlays</Accordion.Control>
              <Accordion.Panel>
                <Group justify="space-between">
                  <Stack gap={0}>
                    <Text fw={600}>Pointer Collider</Text>
                    <Text size="sm" c="dimmed">Visualize the pointer collision sphere</Text>
                  </Stack>
                  <Switch aria-label="Pointer Collider" checked={pointerColliderVisible} onChange={(e) => onPointerColliderVisibleChange(e.currentTarget.checked)} />
                </Group>
                <Group justify="space-between" mt="sm">
                  <Stack gap={0}>
                    <Text fw={600}>Debug AABBs</Text>
                    <Text size="sm" c="dimmed">Draw static collision bounds</Text>
                  </Stack>
                  <Switch aria-label="Debug AABBs" checked={props.drawAABBs} onChange={(e) => props.onDrawAABBsChange(e.currentTarget.checked)} />
                </Group>
                <Group justify="space-between" mt="sm">
                  <Stack gap={0}>
                    <Text fw={600}>Sleep State</Text>
                    <Text size="sm" c="dimmed">Color centers (awake vs sleeping)</Text>
                  </Stack>
                  <Switch aria-label="Sleep State" checked={props.drawSleep} onChange={(e) => props.onDrawSleepChange(e.currentTarget.checked)} />
                </Group>
                <Group justify="space-between" mt="sm">
                  <Stack gap={0}>
                    <Text fw={600}>Pin Markers</Text>
                    <Text size="sm" c="dimmed">Draw markers on pinned vertices</Text>
                  </Stack>
                  <Switch aria-label="Pin Markers" checked={props.drawPins} onChange={(e) => props.onDrawPinsChange(e.currentTarget.checked)} />
                </Group>
                <Group justify="space-between" mt="sm">
                  <Stack gap={0}>
                    <Text fw={600}>Bounding Spheres</Text>
                    <Text size="sm" c="dimmed">Draw world-space bounding spheres</Text>
                  </Stack>
                  <Switch aria-label="Bounding Spheres" checked={!!props.drawSpheres} onChange={(e) => props.onDrawSpheresChange?.(e.currentTarget.checked)} />
                </Group>
                <Group justify="space-between" mt="sm">
                  <Stack gap={0}>
                    <Text fw={600}>Show Panel Bounds</Text>
                    <Text size="sm" c="dimmed">Draw AABB/sphere for the debug panel while open</Text>
                  </Stack>
                  <Switch aria-label="Show Panel Bounds" checked={!!props.showPanelBounds} onChange={(e) => props.onShowPanelBoundsChange?.(e.currentTarget.checked)} />
                </Group>
                <Group justify="space-between" mt="sm">
                  <Stack gap={0}>
                    <Text fw={600}>Draw Fat AABBs</Text>
                    <Text size="sm" c="dimmed">Visualize inflated bounds used for waking</Text>
                  </Stack>
                  <Switch aria-label="Draw Fat AABBs" checked={!!props.drawFatAABBs} onChange={(e) => props.onDrawFatAABBsChange?.(e.currentTarget.checked)} />
                </Group>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="view">
              <Accordion.Control>View</Accordion.Control>
              <Accordion.Panel>
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Text fw={500}>Camera Zoom</Text>
                    <Text c="dimmed">{cameraZoom.toFixed(2)}×</Text>
                  </Group>
                  <Slider aria-label="Camera Zoom" value={cameraZoom} min={0.5} max={3} step={0.1} onChange={onCameraZoomChange} />
                  <Group justify="space-between">
                    <Text fw={500}>Camera Zoom (Actual)</Text>
                    <Text c="dimmed">{cameraZoomActual.toFixed(2)}×</Text>
                  </Group>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          <Divider />
          <Group justify="flex-end">
            {!realTime ? <Button variant="default" onClick={onStep}>Step (Space)</Button> : null}
            <Button
              variant="default"
              onClick={async () => {
                // Clothify the panel and drop it; keep clicks confined to this action
                try {
                  const el = panelRef.current
                  // Delegate to parent to avoid referencing controllerRef here
                  if (el && props.clothifyElement) {
                    await props.clothifyElement(el)
                  }
                } catch (err) {
                  console.warn('Debug panel clothify failed', err)
                } finally {
                  onOpenChange(false)
                }
              }}
            >
              Hide
            </Button>
            <Button variant="outline" onClick={onReset}>Reset</Button>
          </Group>
        </Stack>
      </Paper>
    </Affix>
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
  const [autoTessellation, setAutoTessellation] = useState(true)
  const [tessellationMin, setTessellationMin] = useState(6)
  const [tessellationMax, setTessellationMax] = useState(24)
  const [constraintIterations, setConstraintIterations] = useState(6)
  const [substeps, setSubsteps] = useState(2)
  const [sleepVelocity, setSleepVelocity] = useState(0.001)
  const [sleepFrames, setSleepFrames] = useState(60)
  const [worldSleepGuard, setWorldSleepGuard] = useState(true)
  const [warmStartPasses, setWarmStartPasses] = useState(2)
  const [cameraZoom, setCameraZoom] = useState(1)
  const [cameraZoomActual, setCameraZoomActual] = useState(1)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [pointerColliderVisible, setPointerColliderVisible] = useState(false)
  const [drawAABBs, setDrawAABBs] = useState(false)
  const [drawSleep, setDrawSleep] = useState(false)
  const [drawPins, setDrawPins] = useState(false)
  const [drawSpheres, setDrawSpheres] = useState(false)
  const [showPanelBounds, setShowPanelBounds] = useState(true)
  const [broadphaseMode, setBroadphaseMode] = useState<'sphere' | 'fatAABB'>('fatAABB')
  const [drawFatAABBs, setDrawFatAABBs] = useState(false)
  const [pinMode, setPinMode] = useState<PinMode>('none')

  useEffect(() => {
    let reduced = false
    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
      reduced = !!mql.matches
    }

    const controller = new ClothSceneController()
    controllerRef.current = controller
    controller.init().then(() => {
      try {
        const rs = controller.getRenderSettingsState?.()
        const actions = new EngineActions({
          runner: controller.getRunner(),
          world: controller.getEngine(),
          camera: controller.getCameraSystem() ?? undefined,
          simulation: controller.getSimulationSystem() ?? undefined,
          overlay: controller.getOverlayState() ?? undefined,
          renderSettings: rs ?? undefined,
          setTessellation: (segments: number) => controller.setTessellationSegments(segments),
          setPinMode: (mode) => controller.setPinMode(mode),
        })
        actionsRef.current = actions
        // Preview wireframe on static meshes too in the playground for clarity
        if (rs) rs.applyToStatic = true
        actionsRef.current.setCameraTargetZoom(cameraZoom)
        const snap = actionsRef.current.getCameraSnapshot?.()
        if (snap && typeof snap.zoom === 'number') {
          setCameraZoomActual(snap.zoom)
        }
        actionsRef.current.setGravityScalar(gravity)
        actionsRef.current.setConstraintIterations(constraintIterations)
        controller.setSleepConfig({ velocityThreshold: sleepVelocity, frameThreshold: sleepFrames })
        actionsRef.current.setSleepConfig(sleepVelocity, sleepFrames)
        if (reduced) {
          actionsRef.current.setRealTime(false)
          setRealTime(false)
        }
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
    // Also update controller-side debug flag so newly activated cloth picks up the value immediately
    controllerRef.current?.setWireframe?.(wireframe)
  }, [wireframe])

  useEffect(() => {
    realTimeRef.current = realTime
    actionsRef.current?.setRealTime(realTime)
    if (!actionsRef.current) controllerRef.current?.setRealTime(realTime)
  }, [realTime])

  useEffect(() => {
    const actions = actionsRef.current
    if (!actions) return
    // Non-modal debug: keep overlay visibility tied to the toggle regardless of Drawer state.
    actions.setPointerOverlayVisible(pointerColliderVisible)
  }, [pointerColliderVisible])

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
    controllerRef.current?.setTessellationAutoEnabled?.(autoTessellation)
  }, [autoTessellation])

  useEffect(() => {
    controllerRef.current?.setTessellationMinMax?.(tessellationMin, tessellationMax)
  }, [tessellationMin, tessellationMax])

  useEffect(() => {
    controllerRef.current?.setWorldSleepGuardEnabled?.(worldSleepGuard)
  }, [worldSleepGuard])

  useEffect(() => {
    // Wire broad-phase mode
    actionsRef.current?.setBroadphaseMode?.(broadphaseMode)
    controllerRef.current?.setBroadphaseMode?.(broadphaseMode)
  }, [broadphaseMode])

  useEffect(() => {
    actionsRef.current?.setPointerOverlayVisible(pointerColliderVisible)
  }, [pointerColliderVisible])

  useEffect(() => {
    const overlay = controllerRef.current?.getOverlayState?.() as DebugOverlayState | null
    if (overlay) overlay.drawAABBs = drawAABBs
  }, [drawAABBs])

  useEffect(() => {
    const overlay = controllerRef.current?.getOverlayState?.() as DebugOverlayState | null
    if (overlay) overlay.drawSleep = drawSleep
  }, [drawSleep])

  useEffect(() => {
    const overlay = controllerRef.current?.getOverlayState?.() as DebugOverlayState | null
    if (overlay) overlay.drawPins = drawPins
  }, [drawPins])

  useEffect(() => {
    const overlay = controllerRef.current?.getOverlayState?.() as DebugOverlayState | null
    if (overlay) overlay.drawFatAABBs = drawFatAABBs
  }, [drawFatAABBs])

  useEffect(() => {
    const overlay = controllerRef.current?.getOverlayState?.() as DebugOverlayState | null
    if (overlay) overlay.drawSpheres = drawSpheres
  }, [drawSpheres])

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
      <Affix position={{ bottom: 24, left: 0, right: 0 }}>
        <Paper radius="xl" px="md" py={8} withBorder mx="auto" w="max-content">
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
        autoTessellation={autoTessellation}
        onAutoTessellationChange={setAutoTessellation}
        tessellationMin={tessellationMin}
        tessellationMax={tessellationMax}
        onTessellationMinChange={setTessellationMin}
        onTessellationMaxChange={setTessellationMax}
        constraintIterations={constraintIterations}
        onConstraintIterationsChange={setConstraintIterations}
        substeps={substeps}
        onSubstepsChange={setSubsteps}
        sleepVelocity={sleepVelocity}
        onSleepVelocityChange={setSleepVelocity}
        sleepFrames={sleepFrames}
        onSleepFramesChange={setSleepFrames}
        worldSleepGuard={worldSleepGuard}
        onWorldSleepGuardChange={setWorldSleepGuard}
        warmStartPasses={warmStartPasses}
        onWarmStartPassesChange={setWarmStartPasses}
        cameraZoom={cameraZoom}
        onCameraZoomChange={setCameraZoom}
        cameraZoomActual={cameraZoomActual}
        onWarmStartNow={() => actionsRef.current?.warmStartNow(warmStartPasses, constraintIterations)}
        onPresetSelect={(name: string) => {
          const p = getPreset(name)
          if (!p) return
          setSelectedPreset(name)
          setConstraintIterations(p.iterations)
          setSleepVelocity(p.sleepVelocity)
          setSleepFrames(p.sleepFrames)
          setWarmStartPasses(p.warmStartPasses)
        }}
        presetValue={selectedPreset}
        pointerColliderVisible={pointerColliderVisible}
        onPointerColliderVisibleChange={setPointerColliderVisible}
        drawAABBs={drawAABBs}
        onDrawAABBsChange={setDrawAABBs}
        drawSleep={drawSleep}
        onDrawSleepChange={setDrawSleep}
        drawPins={drawPins}
        onDrawPinsChange={setDrawPins}
        drawSpheres={drawSpheres}
        onDrawSpheresChange={setDrawSpheres}
        showPanelBounds={showPanelBounds}
        onShowPanelBoundsChange={setShowPanelBounds}
        broadphaseMode={broadphaseMode}
        onBroadphaseModeChange={setBroadphaseMode}
        drawFatAABBs={drawFatAABBs}
        onDrawFatAABBsChange={setDrawFatAABBs}
        pinMode={pinMode}
        onPinModeChange={setPinMode}
        onStep={() => actionsRef.current?.stepOnce()}
        onReset={() => {
          setWireframe(false)
          setRealTime(true)
          setGravity(9.81)
          setImpulseMultiplier(1)
          setTessellationSegments(24)
          setAutoTessellation(true)
          setTessellationMin(6)
          setTessellationMax(24)
          setConstraintIterations(4)
          setSubsteps(1)
          setCameraZoom(1)
          setPointerColliderVisible(false)
          setPinMode("none")
          setWorldSleepGuard(true)
          controllerRef.current?.setSleepConfig({ velocityThreshold: 0.001, frameThreshold: 60 })
          actionsRef.current?.setSleepConfig(0.001, 60)
        }}
        clothifyElement={async (el: HTMLElement) => {
          try {
            await controllerRef.current?.clothify?.(el, { activate: true, addClickHandler: false })
            if (!realTimeRef.current) {
              // Give it a nudge when paused so it separates from the DOM panel
              controllerRef.current?.stepOnce()
              controllerRef.current?.stepOnce()
            }
          } catch (err) {
            console.warn('clothifyElement failed', err)
          }
        }}
        restoreElement={async (el: HTMLElement) => {
          try {
            await controllerRef.current?.restoreElement?.(el)
          } catch (err) {
            console.warn('restoreElement failed', err)
          }
        }}
        addOverlayElement={(el) => controllerRef.current?.addStaticOverlayElement?.(el)}
        removeOverlayElement={(el) => controllerRef.current?.removeStaticOverlayElement?.(el)}
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
