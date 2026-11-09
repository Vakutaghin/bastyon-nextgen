import type { Locator, Page } from '@playwright/test'

/**
 * Страница без невидимых областей экранного диктора (`#a11y-live-*`,
 * src/helpers/a11y/announce.ts). Тост и его объявление несут один и тот же
 * текст, и `page.getByText` находит оба — строгий режим Playwright падает.
 * Видимый текст тоста искать так: `onScreen(page).getByText('…')`.
 */
export function onScreen(page: Page): Locator {
  return page.locator('body > :not([aria-live])')
}
