import { test, expect } from '@playwright/test'

test.describe('Sandbox scene selection smoke', () => {
  test('loads C1, C2, stack rest, and drop-onto-static without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/sandbox')

    const openTestsMenu = async () => {
      await page.getByRole('button', { name: /tests/i }).click()
    }

    const selectScene = async (label: string) => {
      await openTestsMenu()
      await page.getByRole('menuitem', { name: label }).click()
      // give the engine a moment to instantiate bodies/render
      await page.waitForTimeout(400)
    }

    await selectScene('Cloth: C1 – Settling')
    await selectScene('Cloth: C2 – Sleep/Wake')
    await selectScene('Rigid: Stack Rest')
    await selectScene('Rigid: Drop Onto Static')

    // WebGL canvas should remain mounted
    await expect(page.locator('canvas')).toHaveCount(1)

    expect(errors, `No page/console errors expected, saw: ${errors.join('\n')}`).toEqual([])
  })
})
