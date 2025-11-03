import { useEffect, useState } from 'react'
import { Affix, Paper, Table, Text } from '@mantine/core'
import { perfMonitor } from '../engine/perf/perfMonitor'

export function PerfOverlay({ visible, intervalMs = 300 }: { visible: boolean; intervalMs?: number }) {
  const [rows, setRows] = useState<ReturnType<typeof perfMonitor.getAverages>>([])

  useEffect(() => {
    if (!visible) return
    try { setRows(perfMonitor.getAverages()) } catch (err) { console.error('PerfOverlay init failed', err) }
    const id = window.setInterval(() => {
      try {
        setRows(perfMonitor.getAverages())
      } catch (err) {
        console.error('PerfOverlay: failed to fetch averages', err)
      }
    }, intervalMs)
    return () => { window.clearInterval(id) }
  }, [visible, intervalMs])

  if (!visible) return null
  return (
    <Affix position={{ top: 16, right: 16 }}>
      <Paper withBorder p="sm" radius="md" shadow="sm">
        <Text fw={600} mb={4}>Perf (avg ms)</Text>
        <Table striped withTableBorder withColumnBorders>
          <Table.Tbody>
            {rows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" ta="center">No metrics available</Text>
                </Table.Td>
              </Table.Tr>
            )}
            {rows.map((r) => (
              <Table.Tr key={r.name}>
                <Table.Td>{r.name}</Table.Td>
                <Table.Td c={r.exceeded ? 'red' : undefined}>{r.avg.toFixed(2)}</Table.Td>
                <Table.Td>{r.budget ? r.budget.toFixed(2) : '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Affix>
  )
}
