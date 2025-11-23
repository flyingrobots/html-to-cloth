import { test, expect } from '@playwright/test'

test.describe('Manual QA Smoke', () => {
  test.skip('opens debug palette and toggles Real-Time', async ({ page }) => {
    await page.goto('/sandbox')
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyJ')
    await page.keyboard.up('Control')
    await expect(page.getByText('Debug Settings')).toBeVisible({ timeout: 5000 })
  })

  test('adjusts Camera Zoom via slider', async ({ page }) => {
    await page.goto('/sandbox')
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyJ')
    await page.keyboard.up('Control')

    const slider = page.getByLabel('Camera Zoom', { exact: false }).getByRole('slider').first()
    await expect(slider).toBeVisible({ timeout: 5000 })
    await slider.press('ArrowRight')
  })
})
