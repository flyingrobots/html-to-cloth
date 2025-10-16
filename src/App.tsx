import {
  Button,
  Container,
  Group,
  Kbd,
  MantineProvider,
  Modal,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
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

  const resetControls = () => {
    setWireframe(false)
    setRealTime(true)
    setGravity(9.81)
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

  return (
    <>
      <main className="demo-shell">
        <Container size="sm">
          <Title order={1} className="demo-title">
            Cloth Playground
          </Title>
          <Text className="demo-copy" size="lg">
            This minimal scene keeps the DOM simple while we tune the cloth overlay. Click the button below to peel it
            away.
          </Text>
          <Button className="demo-button cloth-enabled" size="lg" radius="xl">
            Peel Back
          </Button>
        </Container>
      </main>

      <Paper className="debug-toast" radius="xl" shadow="lg" withBorder>
        Press{' '}
        <Kbd>{modifierKey}</Kbd>
        {' '}+{' '}
        <Kbd>J</Kbd>
        {' '}to open the debug palette
      </Paper>

      <Modal
        opened={debugOpen}
        onClose={() => setDebugOpen(false)}
        title="Debug Settings"
        centered
        size="lg"
        overlayProps={{ opacity: 0.4, blur: 4 }}
      >
        <Stack gap="md">
          <Group justify="space-between" gap="md">
            <Text fw={500}>Wireframe</Text>
            <Switch
              checked={wireframe}
              onChange={(event) => setWireframe(event.currentTarget.checked)}
              size="md"
            />
          </Group>

          <Group justify="space-between" gap="md">
            <Text fw={500}>Real-Time</Text>
            <Switch
              checked={realTime}
              onChange={(event) => setRealTime(event.currentTarget.checked)}
              size="md"
            />
          </Group>

          <Group justify="space-between" gap="md">
            <Text fw={500}>Pointer Collider</Text>
            <Switch
              checked={pointerColliderVisible}
              onChange={(event) => setPointerColliderVisible(event.currentTarget.checked)}
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
                  setPinMode(value as PinMode)
                }
              }}
            />
          </Stack>

          {!realTime ? (
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
      </Modal>
    </>
  )
}

export default App
