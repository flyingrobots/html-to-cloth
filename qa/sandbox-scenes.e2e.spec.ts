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

    await load('cloth-c1-settling', /Cloth: C1/i)
    await load('cloth-c2-sleep-wake', /Cloth: C2/i)
    await load('cloth-cr1-over-box', /CR1/i)
    await load('rigid-stack-rest', /Rigid: Stack Rest/i)
    await load('rigid-drop-onto-static', /Rigid: Drop Onto Static/i)
    await load('rigid-thin-wall-ccd', /Thin Wall CCD/i)
    await load('cloth-cr2-rigid-hit', /CR2/i)

    // WebGL canvas should remain mounted
    await expect(page.locator('canvas')).toHaveCount(1)

    // Overlay snapshot sanity checks via test-only hook.
    const overlay = await page.evaluate(() => (window as any).__sandboxDebug?.overlay ?? null)
    expect(overlay).toBeTruthy()
    const simBodies = overlay?.simSnapshot?.bodies ?? []
    const rigidBodies = overlay?.rigidBodies ?? []
    expect(Array.isArray(simBodies)).toBe(true)
    expect(Array.isArray(rigidBodies)).toBe(true)
    expect(simBodies.length + rigidBodies.length).toBeGreaterThan(0)
    expect(simBodies.length).toBeGreaterThan(0)

    expect(errors, `No page/console errors expected, saw: ${errors.join('\n')}`).toEqual([])
  })
})
