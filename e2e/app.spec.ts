import { test, expect } from '@playwright/test'

test.describe('App smoke tests', () => {
  test('loads the home page', async ({ page }) => {
    await page.goto('/')
    // The app should render without crashing
    await expect(page).toHaveTitle(/.+/)
  })

  test('navigates and renders main layout', async ({ page }) => {
    await page.goto('/')
    // Wait for Vue app to mount (the #app root should have children)
    await page.waitForSelector('#app > *', { timeout: 10000 })
    const appContent = page.locator('#app')
    await expect(appContent).not.toBeEmpty()
  })
})
