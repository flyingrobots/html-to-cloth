class PerfMonitor {
  private samples = new Map<string, number[]>()
  private budgets = new Map<string, number>()

  setBudget(name: string, ms: number) {
    this.budgets.set(name, ms)
  }

  begin(): number {
    return performance.now()
  }

  end(name: string, start: number) {
    const dt = performance.now() - start
    const arr = this.samples.get(name) ?? []
    arr.push(dt)
    if (arr.length > 120) arr.shift()
    this.samples.set(name, arr)
  }

  getAverages() {
    const rows: Array<{ name: string; avg: number; budget?: number; exceeded: boolean }> = []
    for (const [name, arr] of this.samples.entries()) {
      const avg = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length)
      const budget = this.budgets.get(name)
      rows.push({ name, avg, budget, exceeded: budget !== undefined ? avg > budget : false })
    }
    return rows.sort((a, b) => b.avg - a.avg)
  }
}

export const perfMonitor = new PerfMonitor()
