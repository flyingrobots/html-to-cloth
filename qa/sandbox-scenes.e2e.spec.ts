import { test, expect } from '@playwright/test'

const SCENES = [
  'cloth-c1-settling',
  'cloth-c2-sleep-wake',
  'cloth-cr1-over-box',
  'rigid-stack-rest',
  'rigid-drop-onto-static',
  'rigid-thin-wall-ccd',
  'cloth-cr2-rigid-hit',
] as const

test.describe('Sandbox scene selection smoke (harness)', () => {
  test('loads DSL-mapped scenes and overlays via /playwright-tests harness', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/playwright-tests/cloth-c1-settling')

    const load = async (id: string) => {
      await page.waitForFunction(
        () => {
          const h = (window as any).__playwrightHarness
          return Boolean(h?.loadScene) && (h.readyResolved === true || h.ready?.then)
        },
        null,
        { timeout: 2000 }
      )

      await page.evaluate((sceneId) => {
        const helper = (window as any).__playwrightHarness
        if (!helper?.loadScene) throw new Error('harness missing')
        helper.loadScene(sceneId)
      }, id)
      await page.waitForTimeout(300)
    }

    const readOverlay = async () =>
      page.evaluate(() => {
        const overlay = (window as any).__playwrightHarness?.overlay
        if (!overlay) return null
        return {
          drawAABBs: overlay.drawAABBs,
          drawSleep: overlay.drawSleep,
          drawPins: overlay.drawPins,
          drawWake: overlay.drawWake,
          simSnapshot: overlay.simSnapshot,
          aabbs: overlay.aabbs,
          rigidBodies: overlay.rigidBodies,
        }
      })

    for (const id of SCENES) {
      await load(id)
    }

    // WebGL canvas should remain mounted
    await expect(page.locator('canvas')).toHaveCount(1)

    const overlay = await readOverlay()
    expect(overlay).toBeTruthy()
    const simBodies = overlay?.simSnapshot?.bodies ?? []
    const rigidBodies = overlay?.rigidBodies ?? []
    expect(Array.isArray(simBodies)).toBe(true)
    expect(Array.isArray(rigidBodies)).toBe(true)
    expect(simBodies.length + rigidBodies.length).toBeGreaterThan(0)
    expect(simBodies.length).toBeGreaterThan(0)

    // CR1 overlay expectations (floor AABB + cloth above floor + camera preset)
    await load('cloth-cr1-over-box')
    await page.waitForFunction(() => {
      const overlay = (window as any).__playwrightHarness?.overlay
      const bodies = overlay?.simSnapshot?.bodies ?? []
      const hasAabb = (overlay?.aabbs ?? []).length > 0
      if (!hasAabb || bodies.length === 0) return false
      return bodies.every((b: any) => (b.center?.y ?? 0) - (b.radius ?? 0) >= -0.12)
    }, null, { timeout: 9000 })

    await page.waitForFunction(
      (target) => {
        const snap = (window as any).__playwrightHarness?.actions?.getCameraSnapshot?.()
        return !!snap && Math.abs(snap.zoom - target) < 0.02
      },
      1.1,
      { timeout: 2000 }
    )

    const cr1Overlay = await readOverlay()
    expect(cr1Overlay?.drawSleep).toBe(true)
    expect(cr1Overlay?.drawAABBs).toBe(true)
    expect((cr1Overlay?.aabbs ?? []).length).toBeGreaterThan(0)

    // CR2 expectations (wake then deflect rightward + camera preset)
    await page.evaluate(() => { (window as any).__cr2AwakeSeen = false })
    await load('cloth-cr2-rigid-hit')

    await page.waitForFunction(
      (target) => {
        const snap = (window as any).__playwrightHarness?.actions?.getCameraSnapshot?.()
        return !!snap && Math.abs(snap.zoom - target) < 0.02
      },
      1.2,
      { timeout: 2000 }
    )

    await page.waitForFunction(() => {
      const overlay = (window as any).__playwrightHarness?.overlay
      const bodies = overlay?.simSnapshot?.bodies ?? []
      if (bodies.length === 0) return false
      const seenAwake = (window as any).__cr2AwakeSeen || bodies.some((b: any) => !b.sleeping)
      if (seenAwake) (window as any).__cr2AwakeSeen = true
      return seenAwake
    }, null, { timeout: 5000 })

    await page.waitForFunction(() => {
      const overlay = (window as any).__playwrightHarness?.overlay
      const bodies = overlay?.simSnapshot?.bodies ?? []
      const sawAwake = (window as any).__cr2AwakeSeen === true
      if (!sawAwake || bodies.length === 0) return false
      const maxX = Math.max(...bodies.map((b: any) => b.center?.x ?? -Infinity))
      return Number.isFinite(maxX) && maxX > -0.2
    }, null, { timeout: 10000 })

    const cr2Overlay = await readOverlay()
    expect(cr2Overlay?.drawSleep).toBe(true)
    expect(cr2Overlay?.drawPins).toBe(true)

    expect(errors, `No page/console errors expected, saw: ${errors.join('\n')}`).toEqual([])
  })

  test('falls back when visualViewport is missing and still maps DOM rects', async ({ page, browserName }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.addInitScript(() => {
      // Simulate environments without visualViewport
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete (window as any).visualViewport
    })

    await page.goto('/playwright-tests/cloth-c1-settling')

    const overlay = await page.evaluate(() => (window as any).__playwrightHarness?.overlay ?? null)
    expect(overlay?.aabbs?.length ?? 0).toBeGreaterThan(0)
    const first = overlay?.aabbs?.[0]
    expect(first?.max?.x - first?.min?.x).toBeGreaterThan(0.2)
    // Fallback banner should exist
    const hasBanner = await page.$('#vv-fallback-banner')
    expect(hasBanner).not.toBeNull()
    expect(errors, `No page/console errors expected, saw: ${errors.join('\n')}`).toEqual([])
  })
})
