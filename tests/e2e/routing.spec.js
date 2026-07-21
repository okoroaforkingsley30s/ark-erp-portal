import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.route('http://localhost:54321/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: null, session: null }),
  }))
})

test('unauthenticated users cannot open protected ERP modules', async ({ page }, testInfo) => {
  await page.goto('/#/finance', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/#\/welcome$/)
  const expectedHeading = testInfo.project.name.startsWith('mobile') ? 'Welcome to ARK ONE' : 'Welcome Back'
  await expect(page.locator('h2:visible', { hasText: expectedHeading })).toBeVisible()
})

test('unknown routes render the not-found recovery page', async ({ page }) => {
  await page.goto('/#/definitely-not-an-ark-route', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Oops!' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Return to Dashboard/ })).toBeVisible()
})
