import { useEffect, useMemo, useRef, useState } from 'react'
import { Affix, Group, Paper, ScrollArea, Table, Text, TextInput, Button, Checkbox } from '@mantine/core'
import type { EventBus, Channel, EventHeaderView, EventReader, BusStats } from '../engine/events/bus'
import { EventIds } from '../engine/events/ids'

export function EventsPanel({ open, onOpenChange, bus }: { open: boolean; onOpenChange: (v: boolean) => void; bus?: EventBus | null }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Array<{ time: number; ch: Channel; type: string; detail: string }>>([])
  const [stats, setStats] = useState<BusStats | null>(null)
  const [paused, setPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [enabledChannels, setEnabledChannels] = useState<Record<Channel, boolean>>({ frameBegin: true, fixedEnd: true, frameEnd: true, immediate: true })
  const [enabledTypes, setEnabledTypes] = useState<Record<string, boolean>>({
    PointerMove: true,
    PerfRow: true,
    CcdHit: true,
    Collision: true,
    Registry: true,
    Pick: true,
  })
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const cursorRef = useRef<ReturnType<EventBus['subscribe']> | null>(null)
  const rafRef = useRef<number | null>(null)

  // Subscribe when opened and bus available
  useEffect(() => {
    if (!open || !bus) return
    // Subscribe to a minimal set: pointer moves (frameBegin) + perf rows (frameEnd)
    cursorRef.current = bus.subscribe('ui.eventsPanel', [
      { channel: 'frameBegin', ids: [EventIds.PointerMove] },
      { channel: 'fixedEnd', ids: [EventIds.CollisionV2] },
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
        if (enabledChannels.fixedEnd && enabledTypes.Collision) {
          received += cur.read('fixedEnd', (h: EventHeaderView, r: EventReader) => {
            if ((h.id >>> 0) !== EventIds.CollisionV2) return
            const a = r.u32[0] >>> 0
            const b = r.u32[1] >>> 0
            const depth = r.f32[4]
            pushRow(
              h,
              'fixedEnd',
              'Collision',
              `a=${a} b=${b} depth=${depth.toFixed(3)}`
            )
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
            }
          }, 128)
        }
      }
      // Keep pumping
      rafRef.current = window.requestAnimationFrame(read)
    }
    const pushRow = (h: EventHeaderView, ch: Channel, type: string, detail: string) => {
      setRows((prev) => {
        const next = prev.length > 200 ? prev.slice(prev.length - 200) : prev.slice(0)
        next.push({ time: Date.now(), ch, type, detail })
        return next
      })
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
  return (
    <Affix position={{ left: 12, right: 12, bottom: 12 }}>
      <Paper withBorder radius="md" shadow="sm" style={{ height: '45vh' }}>
        <Group p="sm" justify="space-between" wrap="nowrap">
          <Text fw={600}>Events</Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput aria-label="Filter events" placeholder="Filter…" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
            <Checkbox label="Auto-scroll" checked={autoScroll} onChange={(e) => setAutoScroll(e.currentTarget.checked)} />
            <Button size="xs" variant="outline" onClick={() => setRows([])}>Clear</Button>
            <Button size="xs" variant="default" onClick={() => setPaused((v) => !v)}>{paused ? 'Resume' : 'Pause'}</Button>
            <Button size="xs" variant="default" onClick={() => onOpenChange(false)}>Close</Button>
          </Group>
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
            {['PointerMove','PerfRow','CcdHit','Collision','Registry','Pick'].map((t) => (
              <Checkbox key={t} label={t} checked={enabledTypes[t]} onChange={(e) => setEnabledTypes((prev) => ({ ...prev, [t]: e.currentTarget.checked }))} />
            ))}
          </Group>
        </Group>
        <ScrollArea style={{ height: 'calc(45vh - 160px)' }} viewportRef={scrollerRef}>
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
          {/* Under-the-hood stats (watermarks, subs, drops) */}
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
          ) : null}
        </ScrollArea>
      </Paper>
    </Affix>
  )
}
