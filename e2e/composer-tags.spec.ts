import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Теги поста, как в прежнем Bastyon: подчёркивание остаётся, список,
 * вставленный в текст или в поле, встаёт тегами целиком, предел — 15.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [],
  comments: [],
  tags: ['все_самое_интересное', 'новости'],
}

async function openComposer(page: Page): Promise<Locator> {
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const signIn = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await signIn.locator('input, textarea').first().fill(MNEMONIC)
  await signIn.getByRole('button', { name: 'Войти' }).click()
  await expect(signIn).toBeHidden({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Создать пост' }).first().click()
  // Окно на компьютере, страница на телефоне.
  const composer = page.locator('body')
  await expect(text(composer)).toBeVisible()
  return composer
}

const chips = (composer: Locator) =>
  composer
    .getByRole('button', { name: /^Удалить тег / })
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-label')!.replace('Удалить тег ', ''))
    )

const text = (composer: Locator) => composer.getByPlaceholder('Что у вас нового?')
const field = (composer: Locator) => composer.getByRole('textbox', { name: 'Добавьте теги…' })

/** Вставка из буфера: событие с данными, а не нажатие клавиш — буфер в тестах закрыт. */
async function paste(target: Locator, value: string): Promise<boolean> {
  await target.focus()
  return target.evaluate((el, data) => {
    const transfer = new DataTransfer()
    transfer.setData('text/plain', data)
    const event = new ClipboardEvent('paste', {
      clipboardData: transfer,
      bubbles: true,
      cancelable: true,
    })
    return el.dispatchEvent(event)
  }, value)
}

test.setTimeout(90_000)

test.describe('компьютер', () => {
  test.use({ viewport: { width: 1366, height: 900 } })

  test('хэштеги из текста — в теги: вставленные сразу, набираемый — целиком', async ({ page }) => {
    const composer = await openComposer(page)
    await text(composer).click()
    // insertText — то же, что вставка из буфера клавиатуры на телефоне.
    await page.keyboard.insertText('О крипте\n\n#крипта_пкоин #Blockchain')
    await expect.poll(() => chips(composer)).toEqual(['крипта_пкоин', 'blockchain'])

    await page.keyboard.type(' и #новости_дня')
    expect(await chips(composer)).toEqual(['крипта_пкоин', 'blockchain'])
    await page.keyboard.type('.')
    await expect.poll(() => chips(composer)).toEqual(['крипта_пкоин', 'blockchain', 'новости_дня'])

    // Последний — когда из текста ушли. Список из текста стёрли — теги стоят.
    await page.keyboard.type(' #лес')
    await field(composer).focus()
    await expect
      .poll(() => chips(composer))
      .toEqual(['крипта_пкоин', 'blockchain', 'новости_дня', 'лес'])
    await text(composer).fill('О крипте и лесе, без списка тегов')
    expect(await chips(composer)).toHaveLength(4)

    // Убранный крестиком не возвращается от продолжения текста.
    await text(composer).fill('О крипте #море ')
    await composer.getByRole('button', { name: 'Удалить тег море' }).click()
    await text(composer).focus()
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type('и ещё ')
    expect(await chips(composer)).not.toContain('море')
  })

  test('поле тегов: подчёркивание, подсказка с подчёркиванием и вставка списка', async ({
    page,
  }) => {
    const composer = await openComposer(page)
    await field(composer).click()
    await page.keyboard.type('крипта_пкоин ')
    await expect.poll(() => chips(composer)).toEqual(['крипта_пкоин'])

    // Подсказка встаёт буква в букву и из списка уходит.
    await page.keyboard.type('самое')
    const hint = composer.locator('li', { hasText: '#все_самое_интересное' })
    await hint.click()
    await expect.poll(() => chips(composer)).toEqual(['крипта_пкоин', 'все_самое_интересное'])
    await expect(hint).toHaveCount(0)

    expect(await paste(field(composer), 'море\n#крипта_пкоин, kryptowährung\r\n中国')).toBe(false)
    await expect
      .poll(() => chips(composer))
      .toEqual(['крипта_пкоин', 'все_самое_интересное', 'море', 'kryptowährung', '中国'])
    await expect(composer).toContainText('5/15')
    // Одно слово — обычная вставка.
    expect(await paste(field(composer), '#лес')).toBe(true)
  })
})

test.describe('телефон', () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true })

  test('пятнадцать длинных тегов помещаются в ширину, шестнадцатый не встаёт', async ({ page }) => {
    const composer = await openComposer(page)
    const list = Array.from({ length: 16 }, (_, i) => `#${i}_очень_длинный_тег_из_многих_слов`)
    await text(composer).focus()
    await page.keyboard.insertText(`${list.join(' ')} `)
    await expect.poll(async () => (await chips(composer)).length).toBe(15)
    await expect(composer).toContainText('15/15')
    const overflow = await composer.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    for (const button of await composer.getByRole('button', { name: /^Удалить тег / }).all()) {
      const box = (await button.boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(360)
    }
  })
})
