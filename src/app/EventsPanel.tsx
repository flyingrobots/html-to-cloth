import { useEffect, useState } from 'react'
import { Affix, Group, Paper, ScrollArea, Text, TextInput, Button } from '@mantine/core'

export function EventsPanel({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

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
          {/* Placeholder list: wired to bus later; non-modal by design (no overlay mask). */}
          <Text c="dimmed" size="sm" pl="sm" pr="sm">
            Event stream will appear here once wired.
          </Text>
        </ScrollArea>
      </Paper>
    </Affix>
  )
}

