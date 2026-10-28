import { test, expect } from '@playwright/test'
import { openStudio } from './support/mock-studio'

/**
 * «Медиастудия», как «Контент» творческой студии YouTube: ролики плиткой или
 * списком (вид запоминается), поиск; окно ролика — название, описание и
 * обложка (кадр из файла ролика на видеосервере), «Сохранить» отправляет
 * только изменённое; «Статистика» — цифры, график и таблица за период.
 * Нода и видеосервер подменные.
 */

test('список: сводка, вид «Списком» с описанием запоминается, поиск', async ({ page }) => {
  test.setTimeout(120_000)
  await openStudio(page)
  await expect(page.getByText(/^2 ролика · 1\s237 просмотров$/)).toBeVisible()
  const audio = page.getByRole('listitem').filter({ hasText: 'Голосовая заметка' })
  await expect(audio).toContainText('Аудио')

  await page.getByRole('button', { name: 'Списком' }).click()
  const row = page.getByRole('listitem').filter({ hasText: 'Закат на море' })
  await expect(row).toContainText('Снимали с пирса в Анапе')
  await expect(audio).toContainText('Без описания')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Списком' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )

  await page.getByRole('textbox', { name: 'Поиск по названию и описанию' }).fill('заметка')
  await expect(page.getByRole('listitem')).toHaveCount(1)
  await expect(audio).toBeVisible()
})

test('окно ролика: название, описание и кадр с сервера — одним «Сохранить»', async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000)
  const server = await openStudio(page)
  await page.getByRole('button', { name: 'Закат на море', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Закат на море' })
  await expect(dialog.getByRole('textbox', { name: 'Описание' })).toHaveValue(
    'Снимали с пирса в Анапе'
  )
  await expect(dialog).toContainText('240p')
  await expect(dialog).toContainText('Текущая обложка')
  const save = dialog.getByRole('button', { name: 'Сохранить' })
  await expect(save).toBeDisabled()

  await dialog.getByRole('textbox', { name: 'Название' }).fill('Закат над морем')
  await dialog.getByRole('textbox', { name: 'Описание' }).fill('')
  // Кадр — из файла ролика на видеосервере.
  await page.getByTestId('video-cover-range').evaluate((el) => {
    const input = el as HTMLInputElement
    input.value = '1'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(dialog).toContainText('Кадр 0:01', { timeout: 20_000 })
  await expect(dialog).toContainText('Есть несохранённые изменения')

  await save.click()
  await expect(page.getByText('Изменения сохранены')).toBeVisible({ timeout: 20_000 })
  expect(server.texts).toEqual([{ name: 'Закат над морем', description: null }])
  expect(server.covers).toHaveLength(1)
  if (browserName === 'chromium') expect(server.covers[0]).toBe('image/jpeg')
  // Заголовок окна — уже новое название.
  const renamed = page.getByRole('dialog', { name: 'Закат над морем' })
  await expect(renamed.getByRole('button', { name: 'Сохранить' })).toBeDisabled()

  await renamed.getByRole('button', { name: 'Close' }).click()
  await expect(renamed).toBeHidden()
  await expect(page.getByRole('listitem').filter({ hasText: 'Закат над морем' })).toBeVisible()
})

test('просмотр: обложка и «Смотреть» в окне ролика открывают плеер поверх', async ({ page }) => {
  test.setTimeout(120_000)
  await openStudio(page)

  await page.getByRole('button', { name: 'Смотреть «Закат на море»' }).click()
  const player = page.getByTestId('studio-player')
  await expect(player.locator('video')).toHaveCount(1, { timeout: 30_000 })
  await expect
    .poll(() => player.locator('video').evaluate((v: HTMLVideoElement) => v.readyState), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect(player).toHaveCount(0)

  // Из окна ролика — плеер над ним, а не под ним.
  await page.getByRole('button', { name: 'Закат на море', exact: true }).click()
  const details = page.getByRole('dialog', { name: 'Закат на море' })
  await details.getByRole('button', { name: 'Смотреть' }).click()
  await expect(player.locator('video')).toHaveCount(1, { timeout: 30_000 })
  const box = await player.boundingBox()
  const onTop = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-testid="studio-player"]'),
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
  )
  expect(onTop).toBe(true)
})

test('статистика: цифры, график таблицей, время просмотра и период', async ({ page }) => {
  test.setTimeout(120_000)
  const server = await openStudio(page)
  const row = page.getByRole('listitem').filter({ hasText: 'Закат на море' })
  await row.getByRole('button', { name: 'Ещё' }).click()
  await page.getByRole('menuitem', { name: 'Статистика' }).click()

  const dialog = page.getByRole('dialog', { name: 'Закат на море' })
  const viewers = dialog.getByRole('button', { name: /Зрители/ })
  await expect(viewers).toContainText('52')
  await expect(viewers).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog).toContainText('1 ч 5 мин')
  await expect(dialog).toContainText('Россия')
  await expect(dialog.getByRole('img', { name: 'Удержание аудитории' })).toBeVisible()

  await dialog.getByText('Показать таблицей').first().click()
  const table = dialog.getByRole('table', { name: 'Зрители' })
  await expect(table.getByRole('row')).toHaveCount(4)
  await expect(table.getByRole('row').last()).toContainText('25')

  await dialog.getByRole('button', { name: /Время просмотра/ }).click()
  await expect
    .poll(() => server.stats.some((s) => s.startsWith('timeseries/aggregateWatchTime')))
    .toBe(true)

  await dialog.getByText('7 дней').click()
  await expect
    .poll(() => server.stats.filter((s) => s.startsWith('overall?startDate=')).length)
    .toBeGreaterThan(1)
})
