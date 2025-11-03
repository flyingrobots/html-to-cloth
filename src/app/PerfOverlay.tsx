import { useEffect, useState } from 'react'
import { Affix, Paper, Table, Text } from '@mantine/core'
import { perfMonitor } from '../engine/perf/perfMonitor'

export function PerfOverlay({ visible }: { visible: boolean }) {
  const [rows, setRows] = useState(perfMonitor.getAverages())

  useEffect(() => {
    if (!visible) return
    const id = window.setInterval(() => {
      setRows(perfMonitor.getAverages())
    }, 250)
    return () => { window.clearInterval(id) }
  }, [visible])

  if (!visible) return null
  return (
    <Affix position={{ top: 16, right: 16 }}>
      <Paper withBorder p="sm" radius="md" shadow="sm">
        <Text fw={600} mb={4}>Perf (avg ms)</Text>
        <Table striped withTableBorder withColumnBorders>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.name}>
                <Table.Td>{r.name}</Table.Td>
                <Table.Td style={{ color: r.exceeded ? '#ff6b6b' : undefined }}>{r.avg.toFixed(2)}</Table.Td>
                <Table.Td>{r.budget ? r.budget.toFixed(2) : '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Affix>
  )
}

