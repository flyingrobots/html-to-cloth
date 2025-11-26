import { useEffect, useMemo, useRef, useState } from "react"
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
  Paper,
  Affix,
  Title,
  Divider,
  Select,
  NativeSelect,
  Kbd,
  Menu,
  Textarea,
  Tooltip,
  ActionIcon,
} from "@mantine/core"
import type { DebugOverlayState } from './engine/render/DebugOverlayState'
import { ClothSceneController, type PinMode } from "./lib/clothSceneController"
import { IconPlayerPause, IconPlayerPlay, IconPlayerTrackNext, IconListDetails, IconSettings } from '@tabler/icons-react'
import { EngineActions } from "./engine/debug/engineActions"
import type { CameraSnapshot } from './engine/camera/CameraSystem'
import { PRESETS, getPreset } from "./app/presets"
import { Notifications, notifications } from '@mantine/notifications'
import { EventsPanel } from './app/EventsPanel'
import { loadSandboxScene, type SandboxSceneId } from './app/sandboxScenes'
import { scenarioPresets as scenarioDefaults, type ScenarioPreset } from './engine/scenarios/physicsScenarios'

// Use Mantine's native Kbd component (no inline styles)

// Local Storage helpers for persistent debug settings
const LS_PREFIX = 'cloth.debug.'
function lsGetRaw(key: string) {
  if (typeof window === 'undefined' || !('localStorage' in window)) return null
  try { return window.localStorage.getItem(LS_PREFIX + key) } catch { return null }
}
function lsSetRaw(key: string, value: string) {
  if (typeof window === 'undefined' || !('localStorage' in window)) return
  try { window.localStorage.setItem(LS_PREFIX + key, value) } catch { /* ignore quota */ }
}
function lsGetBoolean(key: string, fallback: boolean) {
  const v = lsGetRaw(key)
  if (v === null) return fallback
  return v === '1' || v === 'true'
}
function lsSetBoolean(key: string, value: boolean) { lsSetRaw(key, value ? '1' : '0') }
function lsGetNumber(key: string, fallback: number) {
  const v = lsGetRaw(key)
  if (v === null) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
function lsSetNumber(key: string, value: number) { lsSetRaw(key, String(value)) }
function lsGetString<T extends string>(key: string, fallback: T): T {
  const v = lsGetRaw(key)
  return (v as T | null) ?? fallback
}
function lsSetString(key: string, value: string) { lsSetRaw(key, value) }

type DemoMode = 'playground' | 'sandbox' | 'playwright'

function resolveDemoMode(): DemoMode {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') return 'playground'
  const path = window.location.pathname || ''
  if (path === '/sandbox') return 'sandbox'
  if (path.startsWith('/playwright-tests')) return 'playwright'
  return 'playground'
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
  drawAABBs: boolean
  onDrawAABBsChange: (value: boolean) => void
  drawDomRects: boolean
  onDrawDomRectsChange: (value: boolean) => void
  drawSleep: boolean
  onDrawSleepChange: (value: boolean) => void
  drawPins: boolean
  onDrawPinsChange: (value: boolean) => void
  drawWake: boolean
  onDrawWakeChange: (value: boolean) => void
  pinMode: PinMode
  onPinModeChange: (value: PinMode) => void
  onStep: () => void
  onReset: () => void
  onResetBasics: () => void
  onSpawnRigid: () => void
  // CCD controls
  ccdEnabled: boolean
  onCcdEnabledChange: (value: boolean) => void
  ccdProbeSpeed: number
  onCcdProbeSpeedChange: (value: number) => void
  ccdSpeedThreshold: number
  onCcdSpeedThresholdChange: (value: number) => void
  ccdEpsilon: number
  onCcdEpsilonChange: (value: number) => void
  ccdToastEnabled: boolean
  onCcdToastEnabledChange: (value: boolean) => void
  onResetCcd: () => void
  registrySummary: { cloth: number; rigidDynamic: number; rigidStatic: number } | null
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
    drawAABBs,
    onDrawAABBsChange,
    drawDomRects,
    onDrawDomRectsChange,
    drawSleep,
    onDrawSleepChange,
    drawPins,
    onDrawPinsChange,
    drawWake,
    onDrawWakeChange,
    pinMode,
    onPinModeChange,
    onStep,
    onReset,
    onResetBasics,
    onSpawnRigid,
    ccdEnabled,
    onCcdEnabledChange,
    ccdProbeSpeed,
    onCcdProbeSpeedChange,
    ccdSpeedThreshold,
    onCcdSpeedThresholdChange,
    ccdEpsilon,
    onCcdEpsilonChange,
    ccdToastEnabled,
    onCcdToastEnabledChange,
    onResetCcd,
    registrySummary,
  } = props

  // (labels kept close to Select entries)

  return (
    <Drawer
      opened={open}
      onClose={() => onOpenChange(false)}
      position="right"
      size={380}
      withCloseButton
      // Keep dropdowns and overlay content inside the drawer layer
      withinPortal
      zIndex={2100}
    >
      <Card withBorder shadow="sm">
        <Stack gap="md">
          <Stack gap={0}
          >
            <Title order={3}>Debug Settings</Title>
            <Text c="dimmed" size="sm">Control simulation parameters</Text>
          </Stack>
          <Stack gap="md">
            <Stack gap={6}>
              <Text fw={600}>Presets</Text>
              <NativeSelect
                aria-label="Presets"
                data={[
                  { value: '', label: 'Choose preset', disabled: true },
                  ...PRESETS.map((p) => ({ value: p.name, label: p.name })),
                ]}
                defaultValue=""
                onChange={(event) => {
                  const v = event.currentTarget.value
                  if (v) onPresetSelect?.(v)
                }}
              />
            </Stack>
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
              <Switch
                data-testid="real-time-toggle"
                wrapperProps={{ 'data-testid': 'real-time-toggle-wrapper' }}
                aria-label="Real-Time"
                checked={realTime}
                onChange={(e) => onRealTimeChange(e.currentTarget.checked)}
              />
            </Group>
            <Group justify="space-between">
              <Stack gap={0}
              >
                <Text fw={600}>Pointer Collider</Text>
                <Text size="sm" c="dimmed">Visualize the pointer collision sphere</Text>
              </Stack>
              <Switch aria-label="Pointer Collider" checked={pointerColliderVisible} onChange={(e) => onPointerColliderVisibleChange(e.currentTarget.checked)} />
            </Group>
            <Group justify="space-between">
              <Stack gap={0}
              >
                <Text fw={600}>Debug AABBs</Text>
                <Text size="sm" c="dimmed">Draw static collision bounds</Text>
              </Stack>
              <Switch aria-label="Debug AABBs" checked={drawAABBs} onChange={(e) => onDrawAABBsChange(e.currentTarget.checked)} />
            </Group>
            <Group justify="space-between">
              <Stack gap={0}
              >
                <Text fw={600}>DOM Rects (debug)</Text>
                <Text size="sm" c="dimmed">Show sampled DOM rects used for physics</Text>
              </Stack>
              <Switch aria-label="DOM rects" checked={drawDomRects} onChange={(e) => onDrawDomRectsChange(e.currentTarget.checked)} />
            </Group>
            <Group justify="space-between">
              <Stack gap={0}
              >
                <Text fw={600}>Sleep State</Text>
                <Text size="sm" c="dimmed">Color centers (awake vs sleeping)</Text>
              </Stack>
              <Switch aria-label="Sleep State" checked={drawSleep} onChange={(e) => onDrawSleepChange(e.currentTarget.checked)} />
            </Group>
            <Group justify="space-between">
              <Stack gap={0}
              >
                <Text fw={600}>Pin Markers</Text>
                <Text size="sm" c="dimmed">Draw markers on pinned vertices</Text>
              </Stack>
              <Switch aria-label="Pin Markers" checked={drawPins} onChange={(e) => onDrawPinsChange(e.currentTarget.checked)} />
            </Group>
            <Group justify="space-between">
              <Stack gap={0}
              >
                <Text fw={600}>Wake Markers</Text>
                <Text size="sm" c="dimmed">Highlight recently woken bodies</Text>
              </Stack>
              <Switch aria-label="Wake Markers" checked={drawWake} onChange={(e) => onDrawWakeChange(e.currentTarget.checked)} />
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
            <Stack gap={6}>
              <Text fw={500}>Pin Mode</Text>
              <Select
                aria-label="Pin Mode"
                placeholder="Choose pin"
                data={[
                  { value: 'top', label: 'Top Edge' },
                  { value: 'bottom', label: 'Bottom Edge' },
                  { value: 'corners', label: 'Corners' },
                  { value: 'none', label: 'None' },
                ]}
                value={pinMode}
                comboboxProps={{ withinPortal: true, zIndex: 2300 }}
                onChange={(v) => v && onPinModeChange(v as PinMode)}
              />
            </Stack>
            {!realTime ? <Button variant="default" onClick={onStep}>Step (Space)</Button> : null}
          </Stack>
          <Group justify="flex-end">
            <Button variant="default" onClick={onResetBasics}>Reset to Defaults</Button>
          </Group>
          <Divider />
          <Stack gap={6}>
            <Title order={4}>CCD (Experimental)</Title>
            <Group justify="space-between">
              <Text>Enabled</Text>
              <Switch checked={ccdEnabled} onChange={(e) => onCcdEnabledChange(e.currentTarget.checked)} />
            </Group>
            <Group justify="space-between">
              <Text>Collision Toasts</Text>
              <Switch checked={ccdToastEnabled} onChange={(e) => onCcdToastEnabledChange(e.currentTarget.checked)} />
            </Group>
            <Stack gap={4}>
              <Text size="sm">Probe Speed (m/s): {ccdProbeSpeed.toFixed(1)}</Text>
              <Slider min={0} max={20} step={0.5} value={ccdProbeSpeed} onChange={onCcdProbeSpeedChange} />
            </Stack>
            <Stack gap={4}>
              <Text size="sm">CCD Speed Threshold (m/s): {ccdSpeedThreshold.toFixed(1)}</Text>
              <Slider min={0} max={20} step={0.5} value={ccdSpeedThreshold} onChange={onCcdSpeedThresholdChange} />
            </Stack>
            <Stack gap={4}>
              <Text size="sm">Surface Epsilon (m): {ccdEpsilon.toExponential(1)}</Text>
              <Slider min={1e-6} max={1e-2} step={1e-6} value={ccdEpsilon} onChange={onCcdEpsilonChange} />
            </Stack>
            <Group justify="flex-end">
              <Button variant="default" onClick={onResetCcd}>Reset CCD</Button>
            </Group>
          </Stack>
          <Divider />
          {registrySummary ? (
            <Stack gap={4}>
              <Text fw={600}>Physics Registry</Text>
              <Text size="sm" c="dimmed">
                cloth={registrySummary.cloth} rigidDynamic={registrySummary.rigidDynamic} rigidStatic={registrySummary.rigidStatic}
              </Text>
            </Stack>
          ) : null}
      <Group justify="flex-end">
            <Button variant="outline" onClick={onSpawnRigid}>Spawn Rigid Box</Button>
            <Button variant="default" onClick={() => onOpenChange(false)}>Close</Button>
            <Button variant="outline" onClick={onReset}>Reset</Button>
          </Group>
        </Stack>
      </Card>
    </Drawer>
  )
}

function PlaygroundHero() {
  return (
    <>
      <Group justify="center" style={{ minHeight: '100vh' }}>
        <Stack align="center" gap="md">
          <Title order={1}>Cloth Playground</Title>
          <Text size="sm" maw={560} ta="center">
            This minimal scene keeps the DOM simple while we tune the cloth overlay. Click the button below to peel it away.
          </Text>
          <Group gap="md">
            <Button className="cloth-enabled" size="lg">Peel Back</Button>
            <a href="/sandbox">
              <Button variant="outline" size="lg">Sandbox</Button>
            </a>
          </Group>
        </Stack>
      </Group>
      <Affix position={{ bottom: 24, left: 0, right: 0 }}>
        <Paper radius="xl" px="md" py={8} withBorder mx="auto" w="max-content">
          <Group gap={6} align="center">
            <Text size="sm">Press</Text>
            <Kbd>~</Kbd>
            <Text size="sm">to open the debug palette</Text>
          </Group>
        </Paper>
      </Affix>
    </>
  )
}

function SandboxHero({
  realTime,
  onRealTimeToggle,
  onStep,
  onOpenEvents,
  onOpenDebug,
  onDropBoxClick,
  onSelectScene,
}: {
  realTime: boolean
  onRealTimeToggle: (value: boolean) => void
  onStep: () => void
  onOpenEvents: () => void
  onOpenDebug: () => void
  onDropBoxClick?: () => void
  onSelectScene?: (id: SandboxSceneId) => void
}) {
  const playPauseLabel = realTime ? 'Pause (toggle real-time)' : 'Play (toggle real-time)'
  return (
    <>
      <Group justify="center" gap="sm" mt="md">
        <Switch
          data-testid="sandbox-play-pause"
          onLabel={<IconPlayerPlay size={14} />}
          offLabel={<IconPlayerPause size={14} />}
          checked={realTime}
          aria-label={playPauseLabel}
          onChange={(e) => onRealTimeToggle(e.currentTarget.checked)}
        />
        <Tooltip label="Step once (when paused)">
          <ActionIcon
            variant="outline"
            aria-label="Step once"
            disabled={realTime}
            onClick={onStep}
          >
            <IconPlayerTrackNext size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Open events log">
          <ActionIcon variant="outline" aria-label="Open events" onClick={onOpenEvents}>
            <IconListDetails size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Open debug settings">
          <ActionIcon variant="outline" aria-label="Open debug settings" onClick={onOpenDebug}>
            <IconSettings size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Group justify="space-between" align="flex-start" style={{ minHeight: '100vh', padding: '2rem' }}>
        <Stack gap="xl" style={{ flex: 1 }}>
          <Group gap="md">
            <Menu>
              <Menu.Target>
                <Button variant="outline">Tests</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  className="cloth-enabled"
                  onClick={() => onSelectScene?.('cloth-c1-settling')}
                >
                  Cloth: C1 – Settling
                </Menu.Item>
                <Menu.Item
                  className="cloth-enabled"
                  onClick={() => onSelectScene?.('cloth-c2-sleep-wake')}
                >
                  Cloth: C2 – Sleep/Wake
                </Menu.Item>
                <Menu.Item
                  className="cloth-enabled"
                  onClick={() => onSelectScene?.('cloth-cr1-over-box')}
                >
                  Cloth: CR1 – Drape Over Box
                </Menu.Item>
                <Menu.Item
                  className="cloth-enabled"
                  onClick={() => onSelectScene?.('cloth-cr2-rigid-hit')}
                >
                  Cloth+Rigid: CR2 – Projectile Into Cloth
                </Menu.Item>
                <Menu.Item
                  onClick={() => onSelectScene?.('rigid-stack-rest')}
                >
                  Rigid: Stack Rest
                </Menu.Item>
                <Menu.Item
                  onClick={() => onSelectScene?.('rigid-drop-onto-static')}
                >
                  Rigid: Drop Onto Static
                </Menu.Item>
                <Menu.Item
                  onClick={() => onSelectScene?.('rigid-thin-wall-ccd')}
                >
                  Rigid: Thin Wall CCD
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Menu>
              <Menu.Target>
                <Button variant="outline">Demos</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item disabled>Coming soon</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
          <Title
            order={1}
            style={{ fontSize: 'min(14vw, 200px)' }}
          >
            SANDBOX
          </Title>
          <Divider my="md" />
          <Stack gap="sm" maw={420}>
            <Text fw={600}>Default Scene</Text>
            <Text size="sm" c="dimmed">
              A simple setup with a rigid box above a static text area. Future iterations will wire this into the physics system.
            </Text>
            <Group gap="sm" align="flex-start">
              <Button className="rigid-dynamic" onClick={onDropBoxClick}>Drop Box</Button>
              <Textarea
                aria-label="Collision target"
                className="rigid-static"
                id="sandbox-floor"
                name="sandbox-floor"
                placeholder="Rigid floor (static AABB)"
                autosize
                minRows={2}
                style={{ flex: 1 }}
              />
            </Group>
          </Stack>
        </Stack>
        <Stack gap={4} align="flex-end">
          <Text fw={700}>Welcome to the Sandbox</Text>
          <Text size="sm" c="dimmed">Choose a scene to test</Text>
          <Text size="sm" c="dimmed">cmd + j -&gt; Inspector</Text>
          <Text size="sm" c="dimmed">cmd + e -&gt; Event Log</Text>
        </Stack>
      </Group>
    </>
  )
}

function Demo({ mode, initialSceneId }: { mode: DemoMode; initialSceneId?: SandboxSceneId | null }) {
  const controllerRef = useRef<ClothSceneController | null>(null)
  const actionsRef = useRef<EngineActions | null>(null)
  const readyResolveRef = useRef<(() => void) | null>(null)
  const readyPromiseRef = useRef<Promise<void> | null>(null)
  const rigidIdRef = useRef(100)
  const realTimeRef = useRef(true)
  const [debugOpen, setDebugOpen] = useState(() => {
    const fromLS = lsGetBoolean('debugOpen', false)
    const isTest = (import.meta as any)?.env?.MODE === 'test'
    return fromLS || !!isTest
  })
  const [wireframe, setWireframe] = useState(() => lsGetBoolean('wireframe', false))
  const [realTime, setRealTime] = useState(() => lsGetBoolean('realTime', true))
  const [gravity, setGravity] = useState(() => lsGetNumber('gravity', 2))
  const [impulseMultiplier, setImpulseMultiplier] = useState(() => lsGetNumber('impulseMultiplier', 1))
  const [tessellationSegments, setTessellationSegments] = useState(() => lsGetNumber('tessellationSegments', 24))
  const [constraintIterations, setConstraintIterations] = useState(() => lsGetNumber('constraintIterations', 6))
  const [substeps, setSubsteps] = useState(() => lsGetNumber('substeps', 2))
  const [sleepVelocity, setSleepVelocity] = useState(() => lsGetNumber('sleepVelocity', 0.001))
  const [sleepFrames, setSleepFrames] = useState(() => lsGetNumber('sleepFrames', 60))
  const [warmStartPasses, setWarmStartPasses] = useState(() => lsGetNumber('warmStartPasses', 2))
  const [cameraZoom, setCameraZoom] = useState(() => lsGetNumber('cameraZoom', 1))
  const [cameraZoomActual, setCameraZoomActual] = useState(1)
  const [pointerColliderVisible, setPointerColliderVisible] = useState(() => lsGetBoolean('pointerColliderVisible', false))
  const [drawAABBs, setDrawAABBs] = useState(() => lsGetBoolean('drawAABBs', false))
  const [drawDomRects, setDrawDomRects] = useState(() => lsGetBoolean('drawDomRects', false))
  const [drawSleep, setDrawSleep] = useState(() => lsGetBoolean('drawSleep', false))
  const [drawPins, setDrawPins] = useState(() => lsGetBoolean('drawPins', false))
  const [drawWake, setDrawWake] = useState(false)
  // Events panel (non-modal) state
  const [eventsOpen, setEventsOpen] = useState(false)
  const [pinMode, setPinMode] = useState<PinMode>(() => lsGetString('pinMode', 'top' as PinMode))
  // CCD debug controls
  const [ccdEnabled, setCcdEnabled] = useState(() => lsGetBoolean('ccd.enabled', false))
  const [ccdProbeSpeed, setCcdProbeSpeed] = useState(() => lsGetNumber('ccd.probeSpeed', 6))
  const [ccdSpeedThreshold, setCcdSpeedThreshold] = useState(() => lsGetNumber('ccd.speedThreshold', 5))
  const [ccdEpsilon, setCcdEpsilon] = useState(() => lsGetNumber('ccd.epsilon', 1e-4))
  const [registrySummary, setRegistrySummary] = useState<{ cloth: number; rigidDynamic: number; rigidStatic: number } | null>(null)
  // One-time toast when user first changes a setting
  const initialSnapshotRef = useRef({
    wireframe, realTime, gravity, impulseMultiplier, tessellationSegments,
    constraintIterations, substeps, sleepVelocity, sleepFrames, warmStartPasses,
    cameraZoom, pointerColliderVisible, drawAABBs, drawDomRects, drawSleep, drawPins, pinMode,
    ccdEnabled, ccdProbeSpeed, ccdSpeedThreshold, ccdEpsilon,
  })
  const savedToastShownRef = useRef(lsGetBoolean('savedToastShown', false))
  const savedToastArmedRef = useRef(false)
  useEffect(() => {
    const id = window.setTimeout(() => { savedToastArmedRef.current = true }, 1200)
    return () => window.clearTimeout(id)
  }, [])

  const scenePresets = scenarioDefaults as Partial<Record<SandboxSceneId, ScenarioPreset>>

  const applySceneDefaults = (id: SandboxSceneId) => {
    const preset = scenePresets[id] ?? {}
    const overlayPreset = preset.overlay ?? {}
    setWireframe(true)
    setDrawAABBs(overlayPreset.drawAABBs ?? true)
    setDrawDomRects(overlayPreset.drawDomRects ?? overlayPreset.drawAABBs ?? false)
    setDrawSleep(overlayPreset.drawSleep ?? false)
    setDrawPins(overlayPreset.drawPins ?? false)
    setDrawWake(overlayPreset.drawWake ?? false)
    setEventsOpen(true)
    if (typeof preset.cameraZoom === 'number') {
      setCameraZoom(preset.cameraZoom)
    }
  }

  const runScene = (id: SandboxSceneId) => {
    applySceneDefaults(id)
    loadSandboxScene(id, {
      controller: controllerRef.current,
      actions: actionsRef.current,
    })
  }

  const handleSelectScene = (id: SandboxSceneId) => {
    runScene(id)
  }

  useEffect(() => {
    const pendingScenes: SandboxSceneId[] = []
    readyPromiseRef.current = new Promise<void>((resolve) => {
      readyResolveRef.current = resolve
    })
    let overlayReadyResolve: (() => void) | null = null
    let overlayReadyPromise: Promise<void> | null = new Promise<void>((resolve) => { overlayReadyResolve = resolve })
    const getHudSnapshot = () => {
      const vv = (window as any).visualViewport
      const aabb = (window as any).__playwrightHarness?.overlay?.aabbs?.[0] ?? null
      const el = document.querySelector('.rigid-static') as HTMLElement | null
      const rect = el?.getBoundingClientRect()
      return {
        dpr: window.devicePixelRatio ?? 1,
        inner: { w: window.innerWidth, h: window.innerHeight },
        vv: vv ? { w: vv.width ?? 0, h: vv.height ?? 0, x: vv.offsetLeft ?? 0, y: vv.offsetTop ?? 0 } : null,
        domRect: rect
          ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
          : null,
        aabb,
      }
    }
    ;(window as any).__playwrightHarness = {
      controller: null,
      overlay: null,
      actions: null,
      ready: readyPromiseRef.current,
      readyResolved: false,
      loadScene: async (sceneId: SandboxSceneId) => {
        const controller = controllerRef.current
        if (controller) {
          await readyPromiseRef.current
          runScene(sceneId)
        } else {
          pendingScenes.push(sceneId)
        }
      },
      getHudSnapshot,
      overlayReady: overlayReadyPromise,
      waitForOverlayReady: async () => {
        if (overlayReadyPromise) await overlayReadyPromise
      },
    }

    const onSandboxLoad = (event: Event) => {
      const custom = event as CustomEvent<SandboxSceneId>
      const sceneId = custom.detail
      const controller = controllerRef.current
      if (!controller || !sceneId) return
      loadSandboxScene(sceneId, { controller, actions: actionsRef.current })
    }
    window.addEventListener('sandbox-load', onSandboxLoad)

    if (mode !== 'playwright' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
      if (mql.matches) {
        // In reduced-motion environments (including some headless runs), expose a resolved sandbox helper and bail early.
        const harness = (window as any).__playwrightHarness
        if (harness) {
          harness.readyResolved = true
          harness.ready = Promise.resolve()
        }
        return
      }
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
          setCcdEnabled: (enabled) => controller.setCcdEnabled(enabled),
          setCcdProbeSpeed: (speed) => controller.setCcdProbeSpeed(speed),
          configureCcd: (opts) => controller.configureCcd(opts),
          addRigidBody: (body) => controller.getPhysicsSystem()?.addRigidBody(body as any),
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

        const registry = controller.getPhysicsRegistry?.()
        if (registry) {
          const entries = registry.entries()
          const summary = entries.reduce(
            (acc, cur) => {
              if (cur.type === 'cloth') acc.cloth += 1
              else if (cur.type === 'rigid-dynamic') acc.rigidDynamic += 1
              else if (cur.type === 'rigid-static') acc.rigidStatic += 1
              return acc
            },
            { cloth: 0, rigidDynamic: 0, rigidStatic: 0 }
          )
          setRegistrySummary(summary)
        }

        // Expose sandbox debug handles in test mode for Playwright assertions.
        const overlayRef = controller.getOverlayState?.()
        const bus = controller.getEventBus?.()
        if (bus) {
          bus.subscribe('playwright-overlay-ready', [{ channel: 'frameEnd', ids: [(EventIds as any).OverlayReady ?? 12] }], (_h, reader) => {
            if (reader && overlayReadyResolve) {
              overlayReadyResolve()
              overlayReadyResolve = null
              overlayReadyPromise = Promise.resolve()
            }
          })
        }
        const harnessPayload = {
          controller,
          overlay: overlayRef,
          actions: actionsRef.current,
          ready: readyPromiseRef.current,
          readyResolved: true,
          loadScene: (sceneId: SandboxSceneId) => runScene(sceneId),
          getHudSnapshot,
          overlayReady: overlayReadyPromise,
          waitForOverlayReady: async () => {
            if (overlayReadyPromise) await overlayReadyPromise
          },
        }
        ;(window as any).__playwrightHarness = harnessPayload
        readyResolveRef.current?.()

        // Drain any queued scene requests from early loadScene calls.
        if (pendingScenes.length > 0) {
          for (const sceneId of pendingScenes.splice(0, pendingScenes.length)) {
            runScene(sceneId)
          }
        }

        if (mode === 'playwright' && initialSceneId) {
          runScene(initialSceneId)
        }
      } catch (err) {
        if (import.meta?.env?.MODE !== 'test') {
          console.warn('EngineActions init failed:', err)
        }
      }
    })

    const handler = (event: KeyboardEvent) => {
      const key = event.key
      const code = (event as any).code as string | undefined
      const isBackquote =
        key === '`' ||
        key === '~' ||
        code === 'Backquote'
      if (isBackquote && !event.metaKey && !event.ctrlKey && !event.altKey) {
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
      window.removeEventListener('sandbox-load', onSandboxLoad)
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
    // Toggle overlay visibility; hide while the drawer is open to avoid overlap.
    actions.setPointerOverlayVisible(debugOpen ? false : pointerColliderVisible)
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
    const overlay = controllerRef.current?.getOverlayState?.() as DebugOverlayState | null
    if (overlay) overlay.drawAABBs = drawAABBs
  }, [drawAABBs])

  useEffect(() => {
    const overlay = controllerRef.current?.getOverlayState?.() as DebugOverlayState | null
    if (overlay) overlay.drawDomRects = drawDomRects
  }, [drawDomRects])

  // Keyboard shortcut: Ctrl+Shift+D toggles DOM rect overlay (avoids macOS Alt+D bookmark).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && !event.metaKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setDrawDomRects((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
    if (overlay) overlay.drawWake = drawWake
  }, [drawWake])

  useEffect(() => {
    actionsRef.current?.setPinMode(pinMode)
    if (!actionsRef.current) controllerRef.current?.setPinMode(pinMode)
  }, [pinMode])

  // Persist settings to localStorage when they change
  useEffect(() => {
    lsSetBoolean('wireframe', wireframe)
    lsSetBoolean('realTime', realTime)
    lsSetNumber('gravity', gravity)
    lsSetNumber('impulseMultiplier', impulseMultiplier)
    lsSetNumber('tessellationSegments', tessellationSegments)
    lsSetNumber('constraintIterations', constraintIterations)
    lsSetNumber('substeps', substeps)
    lsSetNumber('sleepVelocity', sleepVelocity)
    lsSetNumber('sleepFrames', sleepFrames)
    lsSetNumber('warmStartPasses', warmStartPasses)
    lsSetNumber('cameraZoom', cameraZoom)
    lsSetBoolean('pointerColliderVisible', pointerColliderVisible)
    lsSetBoolean('drawAABBs', drawAABBs)
    lsSetBoolean('drawDomRects', drawDomRects)
    lsSetBoolean('drawSleep', drawSleep)
    lsSetBoolean('drawPins', drawPins)
    lsSetString('pinMode', pinMode)
    // CCD
    lsSetBoolean('ccd.enabled', ccdEnabled)
    lsSetNumber('ccd.probeSpeed', ccdProbeSpeed)
    lsSetNumber('ccd.speedThreshold', ccdSpeedThreshold)
    lsSetNumber('ccd.epsilon', ccdEpsilon)
  }, [
    wireframe, realTime, gravity, impulseMultiplier, tessellationSegments,
    constraintIterations, substeps, sleepVelocity, sleepFrames, warmStartPasses,
    cameraZoom, pointerColliderVisible, drawAABBs, drawSleep, drawPins, pinMode,
    ccdEnabled, ccdProbeSpeed, ccdSpeedThreshold, ccdEpsilon,
  ])

  // One-time "Settings saved" toast on first user change
  useEffect(() => {
    if (savedToastShownRef.current || !savedToastArmedRef.current) return
    const initial = initialSnapshotRef.current
    const changed = (
      wireframe !== initial.wireframe ||
      realTime !== initial.realTime ||
      gravity !== initial.gravity ||
      impulseMultiplier !== initial.impulseMultiplier ||
      tessellationSegments !== initial.tessellationSegments ||
      constraintIterations !== initial.constraintIterations ||
      substeps !== initial.substeps ||
      sleepVelocity !== initial.sleepVelocity ||
      sleepFrames !== initial.sleepFrames ||
      warmStartPasses !== initial.warmStartPasses ||
      cameraZoom !== initial.cameraZoom ||
      pointerColliderVisible !== initial.pointerColliderVisible ||
      drawAABBs !== initial.drawAABBs ||
      drawDomRects !== initial.drawDomRects ||
      drawSleep !== initial.drawSleep ||
      drawPins !== initial.drawPins ||
      pinMode !== initial.pinMode ||
      ccdEnabled !== initial.ccdEnabled ||
      ccdProbeSpeed !== initial.ccdProbeSpeed ||
      ccdSpeedThreshold !== initial.ccdSpeedThreshold ||
      ccdEpsilon !== initial.ccdEpsilon
    )
    if (changed) {
      savedToastShownRef.current = true
      lsSetBoolean('savedToastShown', true)
      try {
        notifications.show({ position: 'top-right', title: 'Settings saved', message: 'Your debug settings now persist across reloads', withBorder: true, autoClose: 2500 })
      } catch {}
    }
  }, [
    wireframe, realTime, gravity, impulseMultiplier, tessellationSegments,
    constraintIterations, substeps, sleepVelocity, sleepFrames, warmStartPasses,
    cameraZoom, pointerColliderVisible, drawAABBs, drawSleep, drawPins, pinMode,
    ccdEnabled, ccdProbeSpeed, ccdSpeedThreshold, ccdEpsilon,
  ])

  // CCD effects
  useEffect(() => {
    actionsRef.current?.setCcdEnabled(ccdEnabled)
  }, [ccdEnabled])
  useEffect(() => {
    actionsRef.current?.setCcdProbeSpeed(ccdProbeSpeed)
  }, [ccdProbeSpeed])
  useEffect(() => {
    actionsRef.current?.configureCcd({ speedThreshold: ccdSpeedThreshold, epsilon: ccdEpsilon })
  }, [ccdSpeedThreshold, ccdEpsilon])

  // Persist debugOpen state
  useEffect(() => { lsSetBoolean('debugOpen', debugOpen) }, [debugOpen])

  // CCD collision toasts hook
  const [ccdToastEnabled, setCcdToastEnabled] = useState(() => lsGetBoolean('ccd.toastEnabled', false))
  useEffect(() => { lsSetBoolean('ccd.toastEnabled', ccdToastEnabled) }, [ccdToastEnabled])
  useEffect(() => {
    if (!actionsRef.current) return
    if (!ccdToastEnabled) {
      actionsRef.current.onCcdCollision(null)
      return
    }
    actionsRef.current.onCcdCollision((payload) => {
      const { t, normal } = payload
      notifications.show({
        position: 'top-right',
        title: 'CCD contact',
        message: `t=${t.toFixed(3)} n=(${normal.x.toFixed(2)}, ${normal.y.toFixed(2)})`,
        withBorder: true,
        autoClose: 3000,
      })
    })
    return () => actionsRef.current?.onCcdCollision(null)
  }, [ccdToastEnabled, actionsRef.current])

  // Keyboard shortcuts: Cmd/Ctrl+J for Debug, Cmd/Ctrl+E for Events panel
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey
      if (!isMod) return
      const key = (event.key || '').toLowerCase()
      if (key === 'j') {
        event.preventDefault()
        setDebugOpen((v) => !v)
      } else if (key === 'e') {
        event.preventDefault()
        setEventsOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {mode === 'sandbox'
        ? <SandboxHero
          realTime={realTime}
          onRealTimeToggle={setRealTime}
          onStep={() => actionsRef.current?.stepOnce()}
          onOpenEvents={() => setEventsOpen(true)}
          onOpenDebug={() => setDebugOpen(true)}
          onDropBoxClick={() => {
          const id = rigidIdRef.current++
          const overlay = controllerRef.current?.getOverlayState?.() as DebugOverlayState | null
          let centerX = 0
          let centerY = 0.9
          let halfX = 0.12
          let halfY = 0.08
          if (overlay && overlay.aabbs.length > 0) {
            const box = overlay.aabbs[0]
            centerX = (box.min.x + box.max.x) * 0.5
            const width = box.max.x - box.min.x
            const height = box.max.y - box.min.y
            // Keep the rigid box comfortably smaller than the floor AABB.
            halfX = Math.max(width * 0.15, 0.01)
            halfY = Math.max(height * 0.35, 0.012)
            centerY = box.max.y + Math.max(halfY * 3.8, 0.22)
          }
          actionsRef.current?.addRigidBody({
            id,
            center: { x: centerX, y: centerY },
            half: { x: halfX, y: halfY },
            angle: 0,
            velocity: { x: 0, y: 0 },
            mass: 1,
            restitution: 0.2,
            friction: 0.6,
          } as any)
        }}
          onSelectScene={handleSelectScene}
        />
        : mode === 'playwright'
          ? <div data-testid="playwright-harness" style={{ width: 0, height: 0, overflow: 'hidden' }} />
          : <PlaygroundHero />}
      <EventsPanel
        open={eventsOpen}
        onOpenChange={setEventsOpen}
        bus={controllerRef.current?.getEventBus?.() ?? null}
        actions={actionsRef.current}
        realTime={realTime}
        onRealTimeChange={setRealTime}
      />
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
          setConstraintIterations(p.iterations)
          setSleepVelocity(p.sleepVelocity)
          setSleepFrames(p.sleepFrames)
          setWarmStartPasses(p.warmStartPasses)
          setCameraZoom(p.cameraZoom)
        }}
        pointerColliderVisible={pointerColliderVisible}
        onPointerColliderVisibleChange={setPointerColliderVisible}
        drawAABBs={drawAABBs}
        onDrawAABBsChange={setDrawAABBs}
        drawDomRects={drawDomRects}
        onDrawDomRectsChange={setDrawDomRects}
        drawSleep={drawSleep}
        onDrawSleepChange={setDrawSleep}
        drawPins={drawPins}
        onDrawPinsChange={setDrawPins}
        drawWake={drawWake}
        onDrawWakeChange={setDrawWake}
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
          setDrawAABBs(false)
          setDrawSleep(false)
          setDrawPins(false)
          setCcdEnabled(false)
          setCcdProbeSpeed(6)
          setCcdSpeedThreshold(5)
          setCcdEpsilon(1e-4)
          notifications.show({ position: 'top-right', title: 'Settings reset', message: 'All debug settings restored to defaults', withBorder: true })
        }}
        onResetBasics={() => {
          setWireframe(false)
          setRealTime(true)
          setGravity(9.81)
          setImpulseMultiplier(1)
          setTessellationSegments(24)
          setConstraintIterations(4)
          setSubsteps(1)
          setCameraZoom(1)
          setPointerColliderVisible(false)
          setPinMode('top')
          setDrawAABBs(false)
          setDrawSleep(false)
          setDrawPins(false)
          controllerRef.current?.setSleepConfig({ velocityThreshold: 0.001, frameThreshold: 60 })
          actionsRef.current?.setSleepConfig(0.001, 60)
          notifications.show({ position: 'top-right', title: 'Basics reset', message: 'Main debug settings restored to defaults', withBorder: true })
        }}
        // CCD props
        ccdEnabled={ccdEnabled}
        onCcdEnabledChange={setCcdEnabled}
        ccdProbeSpeed={ccdProbeSpeed}
        onCcdProbeSpeedChange={setCcdProbeSpeed}
        ccdSpeedThreshold={ccdSpeedThreshold}
        onCcdSpeedThresholdChange={setCcdSpeedThreshold}
        ccdEpsilon={ccdEpsilon}
        onCcdEpsilonChange={setCcdEpsilon}
        // toast toggle
        ccdToastEnabled={ccdToastEnabled}
        onCcdToastEnabledChange={setCcdToastEnabled}
        onResetCcd={() => {
          setCcdEnabled(false)
          setCcdProbeSpeed(6)
          setCcdSpeedThreshold(5)
          setCcdEpsilon(1e-4)
          notifications.show({ position: 'top-right', title: 'CCD reset', message: 'CCD settings restored to defaults', withBorder: true })
        }}
        registrySummary={registrySummary}
        onSpawnRigid={() => {
          const id = rigidIdRef.current++
          actionsRef.current?.addRigidBody({
            id,
            center: { x: 0, y: 0.2 },
            half: { x: 0.12, y: 0.08 },
            angle: 0,
            velocity: { x: 0.2, y: 0 },
            restitution: 0.2,
            friction: 0.3,
          } as any)
          notifications.show({ position: 'top-right', title: 'Rigid spawned', message: `id=${id}`, withBorder: true, autoClose: 1800 })
        }}
      />
    </>
  )
}

function App() {
  const [mode] = useState<DemoMode>(() => resolveDemoMode())
  const initialSceneId = useMemo(() => {
    if (typeof window === 'undefined') return null
    const path = window.location.pathname || ''
    if (path.startsWith('/playwright-tests')) {
      const parts = path.split('/')
      const maybeId = parts[2] as SandboxSceneId | undefined
      return maybeId ?? null
    }
    return null
  }, [])
  return (
    <MantineProvider defaultColorScheme="dark">
      <Notifications position="top-right" zIndex={2100} />
      <Demo mode={mode} initialSceneId={initialSceneId ?? undefined} />
    </MantineProvider>
  )
}

export default App
