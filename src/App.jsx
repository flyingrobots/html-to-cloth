import {
  Box,
  Button,
  Container,
  Group,
  Kbd,
  MantineProvider,
  Drawer,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PortfolioWebGL } from './lib/portfolioWebGL'

const CLOTH_PRESETS = [
  {
    value: 'light',
    label: 'Light Fabric',
    overrides: {
      density: 0.6,
      damping: 0.94,
      constraintIterations: 4,
      substeps: 1,
      turbulence: 0.08,
      releaseDelayMs: 700,
      pinMode: 'top',
    },
  },
  {
    value: 'default',
    label: 'Default',
    overrides: {
      density: 1,
      damping: 0.97,
      constraintIterations: 4,
      substeps: 1,
      turbulence: 0.06,
      releaseDelayMs: 900,
      pinMode: 'top',
    },
  },
  {
    value: 'heavy',
    label: 'Heavy Drape',
    overrides: {
      density: 1.4,
      damping: 0.985,
      constraintIterations: 6,
      substeps: 2,
      turbulence: 0.04,
      releaseDelayMs: 1200,
      pinMode: 'top',
    },
  },
]

/**
 * @typedef {'top' | 'bottom' | 'corners' | 'none'} PinMode
 */

function App() {
  return (
    <MantineProvider defaultColorScheme="dark">
      <AppInner />
    </MantineProvider>
  )
}

function AppInner() {
  const controllerRef = /** @type {import('react').MutableRefObject<PortfolioWebGL | null>} */ (
    useRef(null)
  )
  const theme = useMantineTheme()
  const realTimeRef = useRef(true)
  const realTimeBeforeDebugRef = useRef(true)
  const [debugOpen, setDebugOpen] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [realTime, setRealTime] = useState(true)
  const [gravity, setGravity] = useState(2)
  const [impulseMultiplier, setImpulseMultiplier] = useState(1)
  const [tessellationSegments, setTessellationSegments] = useState(24)
  const [constraintIterations, setConstraintIterations] = useState(4)
  const [substeps, setSubsteps] = useState(1)
  const [pointerColliderVisible, setPointerColliderVisible] = useState(false)
  const [pinMode, setPinMode] = useState('top')
  const [autoRelease, setAutoRelease] = useState(true)
  const [showAabbs, setShowAabbs] = useState(false)
  const [showSleepState, setShowSleepState] = useState(false)
  const [entities, setEntities] = useState([])
  const [selectedEntityId, setSelectedEntityId] = useState(null)
  const [selectedEntityDetails, setSelectedEntityDetails] = useState(null)
  const [debugPaused, setDebugPaused] = useState(false)
  const modalContentRef = useRef(null)
  const pinModeInitializedRef = useRef(false)
  const pauseForcedRef = useRef(false)

  const updateEntities = useCallback(() => {
    const controller = controllerRef.current
    if (!controller) return
    const list = controller.getEntities()
    setEntities(list)
    setSelectedEntityId((prev) => {
      if (prev && list.some((entity) => entity.id === prev)) {
        return prev
      }
      return list[0]?.id ?? null
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReducedMotion.matches) return

    const controller = new PortfolioWebGL()
    controllerRef.current = controller
    void controller.init().then(() => {
      updateEntities()
      controller.setAutoRelease(autoRelease)
      controller.setShowAabbs(showAabbs)
      controller.setShowSleepState(showSleepState)
    })

    const handler = (event) => {
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
    controllerRef.current?.setRealTime(realTime)
  }, [realTime])

  useEffect(() => {
    realTimeRef.current = realTime
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
    controllerRef.current?.setPointerColliderVisible(debugOpen ? false : pointerColliderVisible)
    console.log('[App]', 'effect:setPointerColliderVisible', {
      debugOpen,
      pointerColliderVisible,
      controllerReady: !!controllerRef.current,
    })
  }, [pointerColliderVisible, debugOpen])

  useEffect(() => {
    controllerRef.current?.setAutoRelease(autoRelease)
  }, [autoRelease])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller) return

    if (debugOpen) {
      if (!pauseForcedRef.current) {
        realTimeBeforeDebugRef.current = realTimeRef.current
      }

      if (realTimeRef.current) {
        controller.setRealTime(false)
        realTimeRef.current = false
        pauseForcedRef.current = true
      }

      setDebugPaused(true)
      controller.setPointerInteractionEnabled(false)
      controller.setPointerColliderVisible(false)
      updateEntities()
    } else {
      controller.setPointerInteractionEnabled(true)
      controller.setPointerColliderVisible(pointerColliderVisible)
      if (pauseForcedRef.current) {
        controller.setRealTime(true)
        realTimeRef.current = true
        pauseForcedRef.current = false
        setDebugPaused(false)
        setRealTime(true)
      } else {
        setDebugPaused(false)
      }
    }
  }, [debugOpen, pointerColliderVisible, updateEntities])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller) return
    if (!pinModeInitializedRef.current) {
      pinModeInitializedRef.current = true
      return
    }
    controller.setPinMode(pinMode)
  }, [pinMode])

  useEffect(() => {
    controllerRef.current?.setShowAabbs(showAabbs)
  }, [showAabbs])

  useEffect(() => {
    controllerRef.current?.setShowSleepState(showSleepState)
  }, [showSleepState])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller || !debugOpen || pointerColliderVisible) return

    const handlePointerDown = (event) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (modalContentRef.current && modalContentRef.current.contains(event.target)) {
        return
      }
      const picked = controller.pickEntityAt(event.clientX, event.clientY)
      if (picked) {
        event.preventDefault()
        event.stopPropagation()
        setSelectedEntityId(picked.id)
        setSelectedEntityDetails(controller.getEntityDetails(picked.id))
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [debugOpen, pointerColliderVisible])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller) {
      setSelectedEntityDetails(null)
      return
    }
    if (!selectedEntityId) {
      setSelectedEntityDetails(null)
      return
    }
    setSelectedEntityDetails(controller.getEntityDetails(selectedEntityId))
  }, [selectedEntityId, entities, debugOpen])

  const handleApplyPreset = useCallback(
    (overrides) => {
      const controller = controllerRef.current
      if (!controller || !selectedEntityId) return
      controller.applyPhysicsPreset(selectedEntityId, overrides)
      updateEntities()
      setSelectedEntityDetails(controller.getEntityDetails(selectedEntityId))
    },
    [selectedEntityId, updateEntities]
  )

  const modifierKey =
    typeof navigator !== 'undefined' && navigator?.platform?.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'

  const resetControls = () => {
    setWireframe(false)
    setRealTime(true)
    setGravity(2)
    setImpulseMultiplier(1)
    setTessellationSegments(24)
    setConstraintIterations(4)
    setSubsteps(1)
    setPointerColliderVisible(false)
    setPinMode('top')
  }

  const pinModeOptions = [
    { value: 'top', label: 'Top Edge' },
    { value: 'bottom', label: 'Bottom Edge' },
    { value: 'corners', label: 'Corners' },
    { value: 'none', label: 'None' },
  ]

  const heroGradient = theme.colorScheme === 'dark'
    ? `radial-gradient(circle at top, ${theme.colors.dark[6]} 0%, ${theme.colors.dark[8]} 100%)`
    : `radial-gradient(circle at top, ${theme.colors.indigo[1]} 0%, ${theme.colors.gray[0]} 100%)`

  const entityOptions = entities.map((entity) => ({
    value: entity.id,
    label: `${entity.label}${entity.isActive ? ' (Active)' : ''}`,
  }))

  const selectedPhysics = selectedEntityDetails?.physics ?? {}
  const selectedMetrics = selectedEntityDetails?.metrics ?? {}

  return (
    <>
      <Box
        component="main"
        style={{
          background: heroGradient,
          minHeight: '100vh',
        }}
        py={{ base: 64, md: 96 }}
      >
        <Container size="sm">
          <Stack align="center" gap="lg">
            <Title order={1} ta="center">
              Cloth Playground
            </Title>
            <Text ta="center" size="lg" c="dimmed">
              This minimal scene keeps the DOM simple while we tune the cloth overlay. Click the button below to peel it
              away.
            </Text>
            <Button
              component="button"
              type="button"
              className="cloth-enabled"
              size="lg"
              radius="xl"
              variant="gradient"
              gradient={{ from: 'indigo', to: 'grape' }}
            >
              Peel Back
            </Button>
          </Stack>
        </Container>
      </Box>

      <Paper
        withBorder
        shadow="lg"
        radius="xl"
        px="md"
        py="xs"
        pos="fixed"
        bottom="var(--mantine-spacing-lg)"
        left="50%"
        style={{ transform: 'translateX(-50%)', zIndex: 400 }}
      >
        <Group gap="xs" justify="center">
          <Text size="sm" c="dimmed">
            Press
          </Text>
          <Kbd>{modifierKey}</Kbd>
          <Text size="sm" c="dimmed">
            +
          </Text>
          <Kbd>J</Kbd>
          <Text size="sm" c="dimmed">
            to open the debug palette
          </Text>
        </Group>
      </Paper>

      <Drawer
        opened={debugOpen}
        onClose={() => setDebugOpen(false)}
        title="Debug Settings"
        position="right"
        size="md"
        padding="lg"
        overlayProps={{ opacity: 0.35, blur: 6 }}
        withinPortal
      >
        <Stack ref={modalContentRef} gap="md">
          <Group justify="space-between" align="center">
            <Text fw={500}>Wireframe</Text>
            <Switch
              checked={wireframe}
              onChange={(event) => setWireframe(event.currentTarget.checked)}
              size="md"
            />
          </Group>

          <Group justify="space-between" align="center">
            <Text fw={500}>Real-Time</Text>
            <Switch
              checked={realTime}
              onChange={(event) => setRealTime(event.currentTarget.checked)}
              size="md"
            />
          </Group>

          <Group justify="space-between" align="center">
            <Text fw={500}>Pointer Collider</Text>
            <Switch
              checked={pointerColliderVisible}
              onChange={(event) => {
                console.log('[App]', 'pointer collider switch onChange', {
                  checked: event.currentTarget.checked,
                })
                setPointerColliderVisible(event.currentTarget.checked)
              }}
              size="md"
            />
          </Group>

          <Group justify="space-between" align="center">
            <Text fw={500}>Auto Release</Text>
            <Switch
              checked={autoRelease}
              onChange={(event) => setAutoRelease(event.currentTarget.checked)}
              size="md"
            />
          </Group>

          <Group justify="space-between" align="center">
            <Text fw={500}>Show AABBs</Text>
            <Switch
              checked={showAabbs}
              onChange={(event) => setShowAabbs(event.currentTarget.checked)}
              size="md"
            />
          </Group>

          <Group justify="space-between" align="center">
            <Text fw={500}>Highlight Sleep State</Text>
            <Switch
              checked={showSleepState}
              onChange={(event) => setShowSleepState(event.currentTarget.checked)}
              size="md"
            />
          </Group>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>Gravity</Text>
              <Text size="sm" c="dimmed">
                {gravity.toFixed(2)} m/s²
              </Text>
            </Group>
            <Slider value={gravity} min={0} max={30} step={0.5} onChange={setGravity} labelAlwaysOn />
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>Impulse Multiplier</Text>
              <Text size="sm" c="dimmed">
                {impulseMultiplier.toFixed(2)}
              </Text>
            </Group>
            <Slider value={impulseMultiplier} min={0.1} max={3} step={0.1} onChange={setImpulseMultiplier} labelAlwaysOn />
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>Tessellation</Text>
              <Text size="sm" c="dimmed">
                {tessellationSegments} × {tessellationSegments}
              </Text>
            </Group>
            <Slider
              value={tessellationSegments}
              min={1}
              max={32}
              step={1}
              onChange={(value) => setTessellationSegments(Math.round(value))}
            />
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>Constraint Iterations</Text>
              <Text size="sm" c="dimmed">
                {constraintIterations}
              </Text>
            </Group>
            <Slider
              value={constraintIterations}
              min={1}
              max={12}
              step={1}
              onChange={(value) => setConstraintIterations(Math.round(value))}
            />
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>Substeps</Text>
              <Text size="sm" c="dimmed">
                {substeps}
              </Text>
            </Group>
            <Slider
              value={substeps}
              min={1}
              max={8}
              step={1}
              onChange={(value) => setSubsteps(Math.round(value))}
            />
          </Stack>

          <Stack gap="xs">
            <Text fw={500}>Pin Mode</Text>
            <Select
              data={pinModeOptions}
              value={pinMode}
              onChange={(value) => {
                if (value) {
                  setPinMode(value)
                }
              }}
            />
          </Stack>

          <Stack gap="xs">
            <Text fw={500}>Entity Inspector</Text>
            <Select
              data={entityOptions}
              placeholder={entityOptions.length ? 'Select cloth entity' : 'No cloth elements'}
              value={selectedEntityId}
              onChange={(value) => {
                if (value) {
                  setSelectedEntityId(value)
                }
              }}
              searchable={entityOptions.length > 6}
              nothingFoundMessage="No entities"
              disabled={!entityOptions.length}
            />
            {selectedEntityDetails ? (
              <Paper
                withBorder
                radius="md"
                p="sm"
                style={{
                  background: theme.colorScheme === 'dark' ? theme.colors.dark[7] : theme.colors.gray[1],
                }}
              >
                <Stack gap={4}>
                  <Text size="sm" fw={600}>{selectedEntityDetails.label}</Text>
                  <Text size="sm" c="dimmed">
                    Status: {selectedEntityDetails.isActive ? 'Active cloth' : 'Idle (DOM)'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Density: {(selectedPhysics.density ?? 1).toFixed(2)} | Damping: {(selectedPhysics.damping ?? 0.97).toFixed(3)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Iterations: {selectedPhysics.constraintIterations ?? constraintIterations} | Substeps: {selectedPhysics.substeps ?? substeps}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Pin: {selectedPhysics.pinMode ?? pinMode} | Release: {(selectedPhysics.releaseDelayMs ?? 900).toFixed(0)} ms
                  </Text>
                  <Text size="sm" c="dimmed">
                    Vertices: {selectedMetrics.vertexCount ?? 0} | Triangles: {selectedMetrics.triangleCount ?? 0}
                  </Text>
                  {selectedEntityDetails.isActive ? (
                    <Text size="sm" c="dimmed">
                      Constraint error avg: {(selectedMetrics.averageError ?? 0).toFixed(4)} m | max: {(selectedMetrics.maxError ?? 0).toFixed(4)} m
                    </Text>
                  ) : null}
                </Stack>
              </Paper>
            ) : (
              <Text size="sm" c="dimmed">
                Click a cloth-enabled element to inspect while the debug panel is open.
              </Text>
            )}
            <Group gap="xs">
              {CLOTH_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  size="xs"
                  variant="outline"
                  disabled={!selectedEntityId}
                  onClick={() => handleApplyPreset(preset.overrides)}
                >
                  {preset.label}
                </Button>
              ))}
            </Group>
          </Stack>

          {!realTime || debugPaused ? (
            <Button variant="light" onClick={() => controllerRef.current?.stepOnce()}>
              Step (Space)
            </Button>
          ) : null}

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setDebugOpen(false)}>
              Close
            </Button>
            <Button
              variant="filled"
              color="dark"
              onClick={() => {
                resetControls()
                setDebugOpen(false)
              }}
            >
              Reset
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </>
  )
}

export default App
