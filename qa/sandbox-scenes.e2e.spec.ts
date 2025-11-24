import { test, expect } from '@playwright/test'

test.describe('Sandbox scene selection smoke', () => {
  test('loads DSL-mapped scenes without errors and surfaces overlay state', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/sandbox')

    const clickMenuScene = async (label: RegExp) => {
      await page.getByRole('button', { name: /tests/i }).click()
      const item = page.getByRole('menuitem', { name: label })
      await item.waitFor({ state: 'visible', timeout: 4000 })
      await item.click()
    }

    const load = async (id: string, label: RegExp) => {
      const helperReady = await page.waitForFunction(
        () => {
          const dbg = (window as any).__sandboxDebug
          return Boolean(dbg?.loadScene) && (dbg.readyResolved === true || dbg.ready?.then)
        },
        null,
        { timeout: 2000 }
      ).catch(() => null)

      if (helperReady) {
        await page.evaluate((sceneId) => {
          const helper = (window as any).__sandboxDebug
          if (!helper?.loadScene) throw new Error('sandbox helper missing')
          helper.loadScene(sceneId)
        }, id)
      } else {
        await clickMenuScene(label)
      }
      await page.waitForTimeout(400)
    }

    const readOverlay = async () =>
      page.evaluate(() => {
        const overlay = (window as any).__sandboxDebug?.overlay
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

    await load('cloth-c1-settling', /Cloth: C1/i)
    await load('cloth-c2-sleep-wake', /Cloth: C2/i)
    await load('cloth-cr1-over-box', /CR1/i)
    await load('rigid-stack-rest', /Rigid: Stack Rest/i)
    await load('rigid-drop-onto-static', /Rigid: Drop Onto Static/i)
    await load('rigid-thin-wall-ccd', /Thin Wall CCD/i)
    await load('cloth-cr2-rigid-hit', /CR2/i)
    await page.evaluate(() => { (window as any).__cr2AwakeSeen = false })

    // WebGL canvas should remain mounted
    await expect(page.locator('canvas')).toHaveCount(1)

    // Overlay snapshot sanity checks via test-only hook.
    const overlay = await readOverlay()
    expect(overlay).toBeTruthy()
    const simBodies = overlay?.simSnapshot?.bodies ?? []
    const rigidBodies = overlay?.rigidBodies ?? []
    expect(Array.isArray(simBodies)).toBe(true)
    expect(Array.isArray(rigidBodies)).toBe(true)
    expect(simBodies.length + rigidBodies.length).toBeGreaterThan(0)
    expect(simBodies.length).toBeGreaterThan(0)

    // Scene-specific overlay assertions
    await load('cloth-cr1-over-box', /CR1/i)
    await page.waitForFunction(() => {
      const overlay = (window as any).__sandboxDebug?.overlay
      const bodies = overlay?.simSnapshot?.bodies ?? []
      const hasAabb = (overlay?.aabbs ?? []).length > 0
      if (!hasAabb || bodies.length === 0) return false
      return bodies.every((b: any) => (b.center?.y ?? 0) - (b.radius ?? 0) >= -0.12)
    }, null, { timeout: 9000 })

    await page.waitForFunction(
      (target) => {
        const snap = (window as any).__sandboxDebug?.actions?.getCameraSnapshot?.()
        return !!snap && Math.abs(snap.zoom - target) < 0.02
      },
      1.1,
      { timeout: 2000 }
    )

    const cr1Overlay = await readOverlay()
    expect(cr1Overlay?.drawSleep).toBe(true)
    expect(cr1Overlay?.drawAABBs).toBe(true)
    expect((cr1Overlay?.aabbs ?? []).length).toBeGreaterThan(0)

    await load('cloth-cr2-rigid-hit', /CR2/i)

    await page.waitForFunction(
      (target) => {
        const snap = (window as any).__sandboxDebug?.actions?.getCameraSnapshot?.()
        return !!snap && Math.abs(snap.zoom - target) < 0.02
      },
      1.2,
      { timeout: 2000 }
    )

    // CR2 should wake at least once, then resleep.
    await page.waitForFunction(() => {
      const overlay = (window as any).__sandboxDebug?.overlay
      const bodies = overlay?.simSnapshot?.bodies ?? []
      if (bodies.length === 0) return false
      const seenAwake = (window as any).__cr2AwakeSeen || bodies.some((b: any) => !b.sleeping)
      if (seenAwake) (window as any).__cr2AwakeSeen = true
      return seenAwake
    }, null, { timeout: 5000 })

    await page.waitForFunction(() => {
      const overlay = (window as any).__sandboxDebug?.overlay
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
})
