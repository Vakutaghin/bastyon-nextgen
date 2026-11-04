import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Ссылка на YouTube в посте: без своих картинок и видео — большой плеер; с
 * прикреплённой картинкой — аккуратная карточка ссылки, как у обычного сайта
 * (раньше под картинкой вставал ещё и плеер). Нода подменная.
 */

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const YT = 'dQw4w9WgXcQ'
const YT_OTHER = 'aqz-KE-bpKQ'
const PHOTO = 'https://bastyon.com/images/e2e-photo.png'
const IMAGE = readFileSync(join(process.cwd(), 'public/img/icon-512.png'))

const DATA: MockNodeData = {
  profiles: [{ address: ALICE, name: 'alice_ng' }],
  posts: [
    {
      txid: 'a'.repeat(64),
      address: ALICE,
      message: `Пост с картинкой и клипом https://youtu.be/${YT}`,
      images: [PHOTO],
      ago: 300,
    },
    {
      txid: 'b'.repeat(64),
      address: ALICE,
      message: `Только клип https://www.youtube.com/watch?v=${YT_OTHER}`,
      ago: 600,
    },
  ],
  comments: [],
  linkPreviews: {
    [`https://www.youtube.com/watch?v=${YT}`]: {
      title: 'Клип с картинкой рядом',
      description: 'Описание ролика',
      site_name: 'YouTube',
      image: `https://i.ytimg.com/vi/${YT}/hqdefault.jpg`,
    },
  },
}

test('YouTube при прикреплённой картинке — карточкой ссылки, без вложений — плеером', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1400, height: 1000 })
  await useMockNode(page, DATA)
  for (const url of [PHOTO, 'https://i.ytimg.com/**']) {
    await page.route(url, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: IMAGE })
    )
  }
  await page.route('https://www.youtube.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>YouTube</title>' })
  )
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})

  const withPhoto = page.locator('.post-card', { hasText: 'Пост с картинкой и клипом' })
  await expect(withPhoto).toBeVisible({ timeout: 30_000 })
  const card = withPhoto.getByTestId('link-preview-card')
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expect(card).toContainText('Клип с картинкой рядом')
  await expect(card).toContainText('YouTube')
  await expect(withPhoto.locator('iframe')).toHaveCount(0)

  const onlyClip = page.locator('.post-card', { hasText: 'Только клип' })
  await expect(onlyClip.locator(`iframe[src*="youtube.com/embed/${YT_OTHER}"]`)).toHaveCount(1)
  await expect(onlyClip.getByTestId('link-preview-card')).toHaveCount(0)
})
