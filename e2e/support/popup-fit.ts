import { expect, type Locator, type Page } from '@playwright/test'

/** Экран, на котором смотрим: размеры и вырезы (строка состояния, полоса жестов). */
export interface Screen {
  name: string
  width: number
  height: number
  touch?: boolean
  insets?: { top?: number; right?: number; bottom?: number; left?: number }
}

/** Вырезы — теми же переменными, которыми их передаёт Android. */
export async function setInsets(page: Page, insets: Screen['insets'] = {}): Promise<void> {
  await page.evaluate((i) => {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      document.documentElement.style.setProperty(`--android-inset-${side}`, `${i[side] ?? 0}px`)
    }
  }, insets)
}

/**
 * Панель целиком на экране, вне вырезов, и ничем не закрыта: у самой панели
 * смотрим края, у строк внутри — что нажатие попадёт в них. Строки, уехавшие
 * под прокрутку панели, не в счёт.
 */
export async function expectFits(
  page: Page,
  panel: Locator,
  options: { insets?: Screen['insets']; rows?: string } = {}
): Promise<void> {
  await expect(panel).toBeVisible()
  // Анимация появления меняет размеры — ждём, пока рамка не встанет.
  let before = ''
  await expect
    .poll(async () => {
      const now = JSON.stringify(await panel.boundingBox())
      const same = now === before
      before = now
      return same
    })
    .toBe(true)
  const found = await panel.evaluate((el, rowSelector) => {
    const r = el.getBoundingClientRect()
    const hidden: string[] = []
    if (rowSelector) {
      for (const row of el.querySelectorAll(rowSelector)) {
        const b = row.getBoundingClientRect()
        const x = b.x + b.width / 2
        const y = b.y + b.height / 2
        // Строка, срезанная краем прокрутки, — не «закрытая».
        if (y < r.top + 8 || y > r.bottom - 8) continue
        const hit = document.elementFromPoint(x, y)
        if (!row.contains(hit)) hidden.push(row.textContent?.trim().slice(0, 30) ?? '')
      }
    }
    return {
      box: { top: r.top, right: r.right, bottom: r.bottom, left: r.left },
      view: { width: window.innerWidth, height: window.innerHeight },
      hidden,
    }
  }, options.rows ?? '')
  const i = options.insets ?? {}
  const { box, view, hidden } = found
  const at = JSON.stringify(found)
  expect(box.top, at).toBeGreaterThanOrEqual(i.top ?? 0)
  expect(box.left, at).toBeGreaterThanOrEqual(i.left ?? 0)
  expect(box.bottom, at).toBeLessThanOrEqual(view.height - (i.bottom ?? 0))
  expect(box.right, at).toBeLessThanOrEqual(view.width - (i.right ?? 0))
  expect(hidden, at).toEqual([])
}
