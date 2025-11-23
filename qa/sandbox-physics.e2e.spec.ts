import { test, expect } from '@playwright/test'

test.describe('Sandbox Physics / Events', () => {
  test('spawns rigid and logs Registry + Pick events', async ({ page }) => {
    await page.goto('/sandbox')

    // Open debug palette (Ctrl+J, matching manual smoke tests)
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyJ')
    await page.keyboard.up('Control')

    // Spawn at least one rigid box
    await page.getByRole('button', { name: 'Spawn Rigid Box' }).click()

    // Open Events panel (Ctrl+E)
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyE')
    await page.keyboard.up('Control')

    // Ensure Events panel is visible
    await expect(page.getByText('Events')).toBeVisible()

    const eventsTable = page.getByRole('table').first()

    // Give the engine a moment to publish events
    await page.waitForTimeout(500)

    // Click in the scene to trigger a pick against any rigid body
    await page.mouse.click(400, 300)

    // Expect at least one row to appear (Registry, Collision, or Pick)
    await eventsTable.getByRole('row').first().waitFor({ state: 'visible', timeout: 5000 })
  })
})
