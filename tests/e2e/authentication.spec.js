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

test('public sign-in and registration controls remain available', async ({ page }, testInfo) => {
  await page.goto('/#/welcome', { waitUntil: 'domcontentloaded' })

  if (testInfo.project.name.startsWith('mobile')) {
    await expect(page.getByRole('heading', { name: 'Welcome to ARK ONE' })).toBeVisible()
    await page.getByRole('button', { name: 'Sign In' }).click()
  }

  await expect(page.locator('h2:visible', { hasText: 'Welcome Back' })).toBeVisible()
  await expect(page.locator('button:visible', { hasText: /^\s*Sign In\s*$/ })).toBeVisible()
  await page.locator('button:visible', { hasText: 'Register / Sign Up' }).click()
  await expect(page.locator('h2:visible', { hasText: 'Create Account' })).toBeVisible()
  await expect(page.locator('input[placeholder="Your full name"]:visible')).toBeVisible()
})

test('forgot-password validation does not submit an empty email', async ({ page }, testInfo) => {
  await page.goto('/#/welcome', { waitUntil: 'domcontentloaded' })
  if (testInfo.project.name.startsWith('mobile')) {
    await page.getByRole('button', { name: 'Sign In' }).click()
  }

  const dialogPromise = page.waitForEvent('dialog')
  const clickPromise = page.locator('button:visible', { hasText: 'Forgot Password?' }).click()
  const dialog = await dialogPromise
  expect(dialog.message()).toBe('Please enter your email address first.')
  await dialog.accept()
  await clickPromise
})

test('expired reset links show a safe recovery message', async ({ page }) => {
  await page.goto('/#/reset-password?error_code=otp_expired', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/password link has expired or has already been used/i)).toBeVisible()
})
