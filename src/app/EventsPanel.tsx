import { useEffect, useMemo, useRef, useState } from 'react'
import { Affix, Group, Paper, ScrollArea, Table, Text, TextInput, Button, Checkbox, Tabs, Slider } from '@mantine/core'
import type { EventBus, Channel, EventHeaderView, EventReader, BusStats } from '../engine/events/bus'
import type { EngineActions } from '../engine/debug/engineActions'
import { EventIds } from '../engine/events/ids'

export function EventsPanel({
  open,
  onOpenChange,
  bus,
  actions,
  realTime,
  onRealTimeChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  bus?: EventBus | null
  actions?: EngineActions | null
  realTime?: boolean
  onRealTimeChange?: (enabled: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Array<{ time: number; ch: Channel; type: string; detail: string }>>([])
  const [latest, setLatest] = useState<Record<string, { ch: Channel; detail: string; time: number }>>({})
  const [stats, setStats] = useState<BusStats | null>(null)
  const [paused, setPaused] = useState(() => realTime === false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [activeTab, setActiveTab] = useState<'stream' | 'latest' | 'stats'>('stream')
  const [panelHeight, setPanelHeight] = useState(45)
  const [panelWidth, setPanelWidth] = useState(480)
  const [dock, setDock] = useState<'left' | 'right' | 'float'>('right')
  const [floatPos, setFloatPos] = useState<{ x: number; y: number }>({ x: 24, y: 24 })
  const draggingRef = useRef<{ kind: 'move' | 'resize'; startX: number; startY: number; startW: number; startH: number; startPos: { x: number; y: number } } | null>(null)
  const [enabledChannels, setEnabledChannels] = useState<Record<Channel, boolean>>({ frameBegin: true, fixedEnd: true, frameEnd: true, immediate: true })
  const [enabledTypes, setEnabledTypes] = useState<Record<string, boolean>>({
    PointerMove: true,
    PerfRow: true,
    CcdHit: true,
    Collision: true,
    Registry: true,
    Pick: true,
    Sleep: true,
  })
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const cursorRef = useRef<ReturnType<EventBus['subscribe']> | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    setPaused(realTime === false)
  }, [realTime])

  // Subscribe when opened and bus available
  useEffect(() => {
    if (!open || !bus) return
    // Subscribe to a minimal set: pointer moves (frameBegin) + perf rows (frameEnd)
    cursorRef.current = bus.subscribe('ui.eventsPanel', [
      { channel: 'frameBegin', ids: [EventIds.PointerMove] },
      { channel: 'fixedEnd', ids: [EventIds.CollisionV2, EventIds.Sleep] },
      {
        channel: 'frameEnd',
        ids: [
          EventIds.PerfRow,
          EventIds.CcdHit,
          EventIds.RegistryAdd,
          EventIds.RegistryUpdate,
          EventIds.RegistryRemove,
          EventIds.Pick,
        ],
      },
    ])

    const read = () => {
      const cur = cursorRef.current
      if (!cur) return
      if (!paused) {
        let received = 0
        if (enabledChannels.frameBegin && enabledTypes.PointerMove) {
          received += cur.read('frameBegin', (h: EventHeaderView, r: EventReader) => {
            const x = r.f32[0]; const y = r.f32[1]
            pushRow(h, 'frameBegin', 'PointerMove', `x=${x.toFixed(3)} y=${y.toFixed(3)}`)
          }, 128)
        }
        if (enabledChannels.fixedEnd) {
          received += cur.read('fixedEnd', (h: EventHeaderView, r: EventReader) => {
            const id = h.id >>> 0
            if (id === EventIds.CollisionV2 && enabledTypes.Collision) {
              const a = r.u32[0] >>> 0
              const b = r.u32[1] >>> 0
              const depth = r.f32[4]
              pushRow(
                h,
                'fixedEnd',
                'Collision',
                `a=${a} b=${b} depth=${depth.toFixed(3)}`
              )
            } else if (id === EventIds.Sleep && enabledTypes.Sleep) {
              const eid = r.u32[0] >>> 0
              pushRow(h, 'fixedEnd', 'Sleep', `id=${eid}`)
            }
          }, 128)
        }
        if (enabledChannels.frameEnd) {
          received += cur.read('frameEnd', (h: EventHeaderView, r: EventReader) => {
            // Distinguish by header id (Phase 0 stores numeric ids in header)
            const id = h.id >>> 0
            if (id === EventIds.PerfRow && enabledTypes.PerfRow) {
              const ms = r.f32[0]
              const lane = r.u32[0] >>> 0
              const laneLabel =
                lane === 0 ? 'rigid:fixed' :
                lane === 1 ? 'cloth:fixed' :
                lane === 2 ? 'render:frame' :
                `lane-${lane}`
              pushRow(h, 'frameEnd', 'PerfRow', `${laneLabel} ${ms.toFixed(2)} ms`)
            } else if (id === EventIds.CcdHit && enabledTypes.CcdHit) {
              const t = r.f32[0]
              const nx = r.f32[1]
              const ny = r.f32[2]
              pushRow(h, 'frameEnd', 'CcdHit', `t=${t.toFixed(3)} n=(${nx.toFixed(2)}, ${ny.toFixed(2)})`)
            } else if (enabledTypes.Registry && (id === EventIds.RegistryAdd || id === EventIds.RegistryUpdate || id === EventIds.RegistryRemove)) {
              const detail =
                id === EventIds.RegistryAdd ? 'add' : id === EventIds.RegistryUpdate ? 'update' : 'remove'
              pushRow(h, 'frameEnd', 'Registry', detail)
            } else if (id === EventIds.Pick && enabledTypes.Pick) {
              const eid = r.u32[0] >>> 0
              const px = r.f32[0]
              const py = r.f32[1]
              pushRow(h, 'frameEnd', 'Pick', `id=${eid} p=(${px.toFixed(3)}, ${py.toFixed(3)})`)
            } else if (id === EventIds.Sleep && enabledTypes.Sleep) {
              const eid = r.u32[0] >>> 0
              pushRow(h, 'frameEnd', 'Sleep', `id=${eid}`)
            }
          }, 128)
        }
      }
      // Keep pumping
      rafRef.current = window.requestAnimationFrame(read)
    }
    const pushRow = (_h: EventHeaderView, ch: Channel, type: string, detail: string) => {
      setRows((prev) => {
        const next = prev.length > 200 ? prev.slice(prev.length - 200) : prev.slice(0)
        next.push({ time: Date.now(), ch, type, detail })
        return next
      })
      setLatest((prev) => ({ ...prev, [type]: { ch, detail, time: Date.now() } }))
    }
    rafRef.current = window.requestAnimationFrame(read)
    const statsTimer = window.setInterval(() => {
      if (paused) return
      try { setStats(bus.stats()) } catch {}
    }, 300)
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      cursorRef.current = null
      window.clearInterval(statsTimer)
    }
  }, [open, bus, paused, enabledChannels.frameBegin, enabledChannels.frameEnd, enabledTypes.PointerMove, enabledTypes.PerfRow, enabledTypes.CcdHit])

  // Reset filter when panel closes
  useEffect(() => { if (!open) setQuery('') }, [open])

  // Drag/resize handlers for floating mode
  useEffect(() => {
    if (!open) return
    const onMove = (e: MouseEvent) => {
      const drag = draggingRef.current
      if (!drag) return
      e.preventDefault()
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (drag.kind === 'move') {
        setFloatPos({ x: Math.max(8, drag.startPos.x + dx), y: Math.max(8, drag.startPos.y + dy) })
      } else if (drag.kind === 'resize') {
        setPanelWidth(Math.max(320, drag.startW + dx))
        setPanelHeight(Math.max(30, Math.min(75, drag.startH + dy * 0.2)))
      }
    }
    const onUp = () => { draggingRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!query) return rows
    const q = query.toLowerCase()
    return rows.filter((r) => r.type.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q) || r.ch.toLowerCase().includes(q))
  }, [rows, query])

  // Auto-scroll when new rows arrive
  useEffect(() => {
    if (!autoScroll || paused) return
    const el = scrollerRef.current?.querySelector('[data-scrollarea-viewport]') as HTMLElement | null
    if (el) el.scrollTop = el.scrollHeight
  }, [filtered.length, autoScroll, paused])

  if (!open) return null

  const affixProps = dock === 'float'
    ? { style: { position: 'fixed', left: floatPos.x, top: floatPos.y, width: panelWidth, zIndex: 1200 } as React.CSSProperties }
    : { position: { left: dock === 'left' ? 12 : undefined, right: dock === 'right' ? 12 : undefined, bottom: 12 } }

  return (
    <Affix {...affixProps}>
      <Paper withBorder radius="md" shadow="sm" style={{ height: `${panelHeight}vh`, minHeight: 220, width: dock === 'float' ? panelWidth : undefined }}>
        <Group p="sm" justify="space-between" wrap="nowrap">
          <Group gap="xs" align="center" data-drag-handle="move" style={{ cursor: dock === 'float' ? 'grab' : 'default' }}>
            <Text fw={600}>Events</Text>
            <Group gap={4}>
              <Button size="xs" variant={dock === 'left' ? 'filled' : 'light'} onClick={() => setDock('left')}>Dock L</Button>
              <Button size="xs" variant={dock === 'right' ? 'filled' : 'light'} onClick={() => setDock('right')}>Dock R</Button>
              <Button size="xs" variant={dock === 'float' ? 'filled' : 'light'} onClick={() => setDock('float')}>Float</Button>
            </Group>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <TextInput aria-label="Filter events" placeholder="Filter…" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
            <Checkbox label="Auto-scroll" checked={autoScroll} onChange={(e) => setAutoScroll(e.currentTarget.checked)} />
            <Button size="xs" variant="outline" onClick={() => setRows([])}>Clear</Button>
            <Button
              size="xs"
              variant="default"
              onClick={() => {
                const next = !paused
                setPaused(next)
                const desiredRealTime = !next
                if (onRealTimeChange) onRealTimeChange(desiredRealTime)
                else actions?.setRealTime?.(desiredRealTime)
              }}
            >
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button size="xs" variant="default" onClick={() => onOpenChange(false)}>Close</Button>
          </Group>
        </Group>
        <Group pl="sm" pr="sm" pb={6} gap="md" align="center">
          <Text size="xs" fw={600}>Height</Text>
          <Slider value={panelHeight} onChange={setPanelHeight} min={30} max={75} step={1} style={{ width: 200 }} marks={[{ value: 30, label: '30vh' }, { value: 50, label: '50vh' }, { value: 70, label: '70vh' }]} />
          {dock === 'float' ? (
            <>
              <Text size="xs" fw={600}>Width</Text>
              <Slider value={panelWidth} onChange={setPanelWidth} min={320} max={900} step={10} style={{ width: 200 }} marks={[{ value: 320, label: '320' }, { value: 620, label: '620' }, { value: 900, label: '900' }]} />
              <Text size="xs" c="dimmed">Drag header to move, corner to resize</Text>
            </>
          ) : null}
        </Group>
        <Group pl="sm" pr="sm" gap="xl" wrap="wrap">
          <Group gap="xs">
            <Text size="sm" fw={600}>Channels</Text>
            {(['frameBegin','fixedEnd','frameEnd','immediate'] as Channel[]).map((ch) => (
              <Checkbox key={ch} label={ch} checked={enabledChannels[ch]} onChange={(e) => setEnabledChannels((prev) => ({ ...prev, [ch]: e.currentTarget.checked }))} />
            ))}
          </Group>
          <Group gap="xs">
            <Text size="sm" fw={600}>Types</Text>
            {['PointerMove','PerfRow','CcdHit','Collision','Registry','Pick','Sleep'].map((t) => (
              <Checkbox key={t} label={t} checked={enabledTypes[t]} onChange={(e) => setEnabledTypes((prev) => ({ ...prev, [t]: e.currentTarget.checked }))} />
            ))}
          </Group>
        </Group>
        <ScrollArea style={{ height: `calc(${panelHeight}vh - 180px)` }} viewportRef={scrollerRef}>
          <Tabs value={activeTab} onChange={(v) => setActiveTab(v as any)} keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="stream">Stream</Tabs.Tab>
              <Tabs.Tab value="latest">Latest</Tabs.Tab>
              <Tabs.Tab value="stats">Stats</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="stream">
              <Table striped highlightOnHover stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Ch</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Detail</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filtered.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{r.ch}</Table.Td>
                      <Table.Td>{r.type}</Table.Td>
                      <Table.Td>{r.detail}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>
            <Tabs.Panel value="latest">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Channel</Table.Th>
                    <Table.Th>Detail</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(latest).map(([type, v]) => (
                    <Table.Tr key={type}>
                      <Table.Td>{type}</Table.Td>
                      <Table.Td>{v.ch}</Table.Td>
                      <Table.Td>{v.detail}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>
            <Tabs.Panel value="stats">
              {stats ? (
                <>
                  <Text size="sm" fw={600} pl="sm" pr="sm" pt="xs">Bus internals</Text>
                  <Table withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Channel</Table.Th>
                        <Table.Th>seqHead</Table.Th>
                        <Table.Th>tick</Table.Th>
                        <Table.Th>subs</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(['frameBegin','fixedEnd','frameEnd','immediate'] as Channel[]).map((ch) => (
                        <Table.Tr key={ch}>
                          <Table.Td>{ch}</Table.Td>
                          <Table.Td>{stats.channels[ch].seqHead}</Table.Td>
                          <Table.Td>{stats.channels[ch].tick}</Table.Td>
                          <Table.Td>{stats.channels[ch].subs}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                  <Group pl="sm" pr="sm" pt="xs" gap="xl">
                    <Text size="sm">capacity={stats.capacity}</Text>
                    <Text size="sm">mailboxCapacity={stats.mailboxCapacity}</Text>
                    <Text size="sm">subscribers={stats.subscribers.total}</Text>
                    <Text size="sm">drops: ch={stats.drops.channel} tomb={stats.drops.tombstone}</Text>
                  </Group>
                  {stats.subscribers.mailboxes.length ? (
                    <>
                      <Text size="sm" fw={600} pl="sm" pr="sm" pt="xs">Top mailboxes by backlog</Text>
                      <Table withTableBorder withColumnBorders>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Subscriber</Table.Th>
                            <Table.Th>frameBegin</Table.Th>
                            <Table.Th>fixedEnd</Table.Th>
                            <Table.Th>frameEnd</Table.Th>
                            <Table.Th>immediate</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {[...stats.subscribers.mailboxes]
                            .sort((a, b) => (b.frameBegin+b.fixedEnd+b.frameEnd+b.immediate) - (a.frameBegin+a.fixedEnd+a.frameEnd+a.immediate))
                            .slice(0, 5)
                            .map((m) => (
                              <Table.Tr key={m.id}>
                                <Table.Td>{m.id}</Table.Td>
                                <Table.Td>{m.frameBegin}</Table.Td>
                                <Table.Td>{m.fixedEnd}</Table.Td>
                                <Table.Td>{m.frameEnd}</Table.Td>
                                <Table.Td>{m.immediate}</Table.Td>
                              </Table.Tr>
                            ))}
                        </Table.Tbody>
                      </Table>
                    </>
                  ) : null}
                </>
              ) : <Text pl="sm" pr="sm">No stats yet</Text>}
            </Tabs.Panel>
          </Tabs>
        </ScrollArea>
        {dock === 'float'
          ? (
            <div
              style={{
                position: 'absolute',
                right: 4,
                bottom: 4,
                width: 16,
                height: 16,
                cursor: 'nwse-resize',
              }}
              onMouseDown={(e) => {
                draggingRef.current = {
                  kind: 'resize',
                  startX: e.clientX,
                  startY: e.clientY,
                  startW: panelWidth,
                  startH: panelHeight,
                  startPos: floatPos,
                }
              }}
            />
          )
          : null}
      </Paper>
    </Affix>
  )
}
