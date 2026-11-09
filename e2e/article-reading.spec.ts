import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Чтение статьи. Жалоба с Windows 10 (08.11.2026): статья в окне заметно уже
 * ленты, картинки статьи не увеличиваются, открыть её можно только ссылкой
 * «Читать статью». Теперь окно не уже карточки ленты, картинка статьи
 * открывает просмотрщик со всеми картинками, анонс и заголовок открывают
 * статью.
 */

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'

/** Картинка без сети: внешние адреса подменная нода обрывает. */
const svg = (color: string) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="${color}"/></svg>`
  ).toString('base64')}`
const IMG_ONE = svg('red')
const IMG_TWO = svg('blue')

const paragraph = (id: number, text: string) => ({
  id: `p${id}`,
  type: 'paragraph',
  data: { text },
})

const ARTICLE = JSON.stringify({
  time: 1,
  version: '2.28.0',
  blocks: [
    paragraph(1, 'Горы начинаются не сразу: сначала долгие холмы.'),
    { id: 'i1', type: 'image', data: { file: { url: IMG_ONE }, caption: 'Подъём' } },
    paragraph(2, 'Потом тропа уходит вверх, и становится тихо.'),
    paragraph(3, 'На перевале ветер.'),
    { id: 'i2', type: 'image', data: { file: { url: IMG_TWO }, caption: 'Перевал' } },
    paragraph(4, 'Спуск всегда быстрее, чем кажется.'),
  ],
})

const DATA: MockNodeData = {
  profiles: [{ address: ALICE, name: 'alice_ng' }],
  posts: [
    {
      txid: 'a'.repeat(64),
      address: ALICE,
      type: 'article',
      caption: 'Дорога на перевал',
      message: ARTICLE,
      ago: 60,
    },
  ],
  comments: [],
}

test.use({ viewport: { width: 1920, height: 1080 } })

async function openFeed(page: Page): Promise<void> {
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

const modal = (page: Page) => page.locator('.ant-modal.post-modal')

async function closeModal(page: Page): Promise<void> {
  await modal(page).locator('.ant-modal-close').click()
  await expect(modal(page)).toBeHidden()
}

test('анонс и заголовок открывают статью; окно не уже карточки ленты', async ({ page }) => {
  await openFeed(page)
  const card = page.locator('.post-card', { hasText: 'Дорога на перевал' })
  const preview = card.getByTestId('article-preview')
  await expect(preview).toBeVisible({ timeout: 30_000 })
  const cardWidth = await card.evaluate((el) => el.getBoundingClientRect().width)
  expect(cardWidth, 'на широком экране лента шире прежних 880 px').toBeGreaterThan(900)

  await preview.click()
  await expect(modal(page)).toBeVisible()
  await expect(modal(page)).toContainText('Спуск всегда быстрее')
  // Окно открывается с анимацией масштаба: мерить, когда она кончилась.
  await expect
    .poll(() =>
      modal(page)
        .locator('.ant-modal-content')
        .evaluate((el) => Math.round(el.getBoundingClientRect().width))
    )
    .toBe(Math.round(cardWidth))
  await closeModal(page)

  await card.getByRole('heading', { name: 'Дорога на перевал' }).click()
  await expect(modal(page)).toBeVisible()
  await closeModal(page)
})

test('картинка статьи открывает просмотрщик со всеми картинками статьи', async ({ page }) => {
  await openFeed(page)
  // Кнопкой в карточке: «Что нового» после смены версии тоже упоминает «Читать статью».
  await page
    .locator('.post-card', { hasText: 'Дорога на перевал' })
    .getByRole('button', { name: 'Читать статью' })
    .click({ timeout: 30_000 })
  const images = modal(page).getByTestId('article-image')
  await expect(images).toHaveCount(2)

  await images.nth(1).click()
  const viewer = page.locator('.vel-modal')
  await expect(viewer).toBeVisible()
  await expect(viewer.locator('img.vel-img')).toHaveAttribute('src', IMG_TWO)
  const gallery = await page.evaluate(() => {
    const pinia = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: {
            globalProperties: {
              $pinia: { _s: Map<string, { imageGallery: { images: string[]; index: number } }> }
            }
          }
        }
      }
    ).__vue_app__.config.globalProperties.$pinia
    const state = pinia._s.get('modal')!.imageGallery
    return { count: state.images.length, index: state.index }
  })
  expect(gallery).toEqual({ count: 2, index: 1 })
})
