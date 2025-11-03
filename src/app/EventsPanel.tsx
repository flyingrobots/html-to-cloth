import { useEffect, useMemo, useState } from 'react'
import { Affix, Group, Paper, ScrollArea, Table, Text, TextInput, Button } from '@mantine/core'
import { globalEventBus } from '../engine/events/eventBus'
import type { EngineEvent } from '../engine/events/types'

export function EventsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [events, setEvents] = useState<EngineEvent[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<EngineEvent | null>(null)

  useEffect(() => {
    if (!open) return
    const off = globalEventBus.on((e) => {
      setEvents((prev) => {
        const next = [...prev, e]
        if (next.length > 100) next.shift()
        return next
      })
    })
    return () => off()
  }, [open])

  const filtered = useMemo(() => {
    if (!query) return events
    const q = query.toLowerCase()
    return events.filter((e) => JSON.stringify(e).toLowerCase().includes(q))
  }, [events, query])

  if (!open) return null
  return (
    <Affix position={{ left: 12, right: 12, bottom: 12 }}>
      <Paper withBorder radius="md" shadow="sm" style={{ height: '45vh' }}>
        <Group p="sm" justify="space-between">
          <Text fw={600}>Events</Text>
          <Group gap="xs">
            <TextInput placeholder="Filter…" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
            <Button size="xs" variant="default" onClick={() => onOpenChange(false)}>Close</Button>
          </Group>
        </Group>
        <ScrollArea style={{ height: 'calc(45vh - 100px)' }}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Time</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Tag</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((e, i) => (
                <Table.Tr key={i} onClick={() => setSelected(e)} style={{ cursor: 'pointer' }}>
                  <Table.Td>{new Date(e.time).toLocaleTimeString()}</Table.Td>
                  <Table.Td>{e.type}</Table.Td>
                  <Table.Td>{(e as any).tag ?? ''}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        {selected ? (
          <Paper p="sm" m="sm" withBorder>
            <Text size="sm">{JSON.stringify(selected, null, 2)}</Text>
          </Paper>
        ) : null}
      </Paper>
    </Affix>
  )
}

