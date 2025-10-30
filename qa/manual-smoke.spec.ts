import { test, expect } from '@playwright/test'

test.describe('Manual QA Smoke', () => {
  test('opens debug palette and toggles Real-Time', async ({ page }) => {
    await page.goto('/')
    // Toggle debug palette (Ctrl+J)
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyJ')
    await page.keyboard.up('Control')

    // Real-Time switch
    const rtLabel = page.getByText('Real-Time')
    await expect(rtLabel).toBeVisible()
    const row = await rtLabel.locator('..').locator('..')
    const sw = row.getByRole('switch')
    await sw.click()
    await expect(sw).toBeVisible()
  })

  test('adjusts Camera Zoom via slider', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyJ')
    await page.keyboard.up('Control')

    const zoomLabel = page.getByText('Camera Zoom')
    const row = await zoomLabel.locator('..').locator('..')
    const slider = row.getByRole('slider')
    // Increment zoom via ArrowRight to ensure control is interactive
    await slider.press('ArrowRight')
    await expect(slider).toBeVisible()
  })
})
