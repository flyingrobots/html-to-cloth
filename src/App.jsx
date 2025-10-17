import {
  Box,
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
  useMantineTheme,
} from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { PortfolioWebGL } from './lib/portfolioWebGL'

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
  const [debugOpen, setDebugOpen] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [realTime, setRealTime] = useState(true)
  const [gravity, setGravity] = useState(9.81)
  const [impulseMultiplier, setImpulseMultiplier] = useState(1)
  const [tessellationSegments, setTessellationSegments] = useState(24)
  const [constraintIterations, setConstraintIterations] = useState(4)
  const [substeps, setSubsteps] = useState(1)
  const [pointerColliderVisible, setPointerColliderVisible] = useState(false)
  const [pinMode, setPinMode] = useState('top')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReducedMotion.matches) return

    const controller = new PortfolioWebGL()
    controllerRef.current = controller
    void controller.init()

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

  const heroGradient = theme.colorScheme === 'dark'
    ? `radial-gradient(circle at top, ${theme.colors.dark[6]} 0%, ${theme.colors.dark[8]} 100%)`
    : `radial-gradient(circle at top, ${theme.colors.indigo[1]} 0%, ${theme.colors.gray[0]} 100%)`

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

      <Modal
        opened={debugOpen}
        onClose={() => setDebugOpen(false)}
        title="Debug Settings"
        centered
        size="lg"
        overlayProps={{ opacity: 0.4, blur: 4 }}
      >
        <Stack gap="md">
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
                  setPinMode(value)
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
