import { useEffect, useMemo, useRef, useState } from 'react'
import { Affix, Group, Paper, ScrollArea, Table, Text, TextInput, Button } from '@mantine/core'
import type { EventBus, Channel, EventHeaderView, EventReader } from '../engine/events/bus'
import { EventIds } from '../engine/events/ids'

export function EventsPanel({ open, onOpenChange, bus }: { open: boolean; onOpenChange: (v: boolean) => void; bus?: EventBus | null }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Array<{ time: number; ch: Channel; type: string; detail: string }>>([])
  const cursorRef = useRef<ReturnType<EventBus['subscribe']> | null>(null)
  const rafRef = useRef<number | null>(null)

  // Subscribe when opened and bus available
  useEffect(() => {
    if (!open || !bus) return
    // Subscribe to a minimal set: pointer moves (frameBegin) + perf rows (frameEnd)
    cursorRef.current = bus.subscribe('ui.eventsPanel', [
      { channel: 'frameBegin', ids: [EventIds.PointerMove] },
      { channel: 'frameEnd', ids: [EventIds.PerfRow] },
    ])

    const read = () => {
      const cur = cursorRef.current
      if (!cur) return
      let received = 0
      received += cur.read('frameBegin', (h: EventHeaderView, r: EventReader) => {
        const x = r.f32[0]; const y = r.f32[1]
        pushRow(h, 'frameBegin', 'PointerMove', `x=${x.toFixed(3)} y=${y.toFixed(3)}`)
      }, 128)
      received += cur.read('frameEnd', (h: EventHeaderView, r: EventReader) => {
        const ms = r.f32[0]
        pushRow(h, 'frameEnd', 'PerfRow', `${ms.toFixed(2)} ms`)
      }, 128)
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
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      cursorRef.current = null
    }
  }, [open, bus])

  // Reset filter when panel closes
  useEffect(() => { if (!open) setQuery('') }, [open])

  const filtered = useMemo(() => {
    if (!query) return rows
    const q = query.toLowerCase()
    return rows.filter((r) => r.type.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q) || r.ch.toLowerCase().includes(q))
  }, [rows, query])

  if (!open) return null
  return (
    <Affix position={{ left: 12, right: 12, bottom: 12 }}>
      <Paper withBorder radius="md" shadow="sm" style={{ height: '45vh' }}>
        <Group p="sm" justify="space-between">
          <Text fw={600}>Events</Text>
          <Group gap="xs">
            <TextInput aria-label="Filter events" placeholder="Filter…" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
            <Button size="xs" variant="default" onClick={() => onOpenChange(false)}>Close</Button>
          </Group>
        </Group>
        <ScrollArea style={{ height: 'calc(45vh - 100px)' }}>
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
        </ScrollArea>
      </Paper>
    </Affix>
  )
}
