import { randomBytes } from 'node:crypto'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { Ed25519PrivateKey } from '../src/helpers/ipfs/ipns-keys'
import { putRecord, signRecord } from '../src/helpers/ipfs/ipns-names'
import { useMockNode } from './support/mock-node'

/**
 * Узел IPFS в приложении вживую: окно просмотра без модуля и без шлюзов
 * открывает из настоящей сети IPFS папку и страницу по DNSLink, статью
 * Википедии и картинку, а «Скачать» сохраняет файл. Постоянная ссылка: тест
 * публикует одноразовое имя IPNS (случайный ключ, запись на 30 дней) через
 * delegated-ipfs.dev и открывает его. Блокчейн подменный (mock-node), сеть
 * IPFS — настоящая. Это не тест для CI: нужен интернет, без IPFS_LIVE=1 он
 * пропускается. Запуск:
 *
 *   IPFS_LIVE=1 playwright test ipfs-node.live
 */

test.skip(!process.env.IPFS_LIVE, 'нужна сеть IPFS, см. шапку файла')
// Редкое содержимое узел ищет до минуты, первый запуск узла — ещё несколько секунд.
test.setTimeout(180_000)
const FOUND = { timeout: 120_000 }

/** Своё — подменное; роутеры, узлы IPFS и DNS — настоящие. */
const toNetwork = (url: string) => !/pocketnet\.app|bastyon\.com/.test(new URL(url).hostname)

async function openApp(page: Page): Promise<void> {
  await useMockNode(page, { profiles: [], posts: [], comments: [] }, toNetwork)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

/** Куда сейчас ведёт DNSLink docs.ipfs.tech: `/ipfs/<cid>`. */
async function docsRoot(): Promise<string> {
  const res = await fetch(
    'https://cloudflare-dns.com/dns-query?name=_dnslink.docs.ipfs.tech&type=TXT',
    {
      headers: { Accept: 'application/dns-json' },
    }
  )
  const { Answer = [] } = (await res.json()) as { Answer?: { data: string }[] }
  const link = Answer.map((a) => a.data.replace(/"/g, '')).find((d) =>
    d.startsWith('dnslink=/ipfs/')
  )
  if (!link) throw new Error('no DNSLink for docs.ipfs.tech')
  return link.slice('dnslink='.length)
}

/** Ссылка в документе, как в посте: её ловит общий перехватчик кликов. */
async function follow(page: Page, href: string): Promise<Locator> {
  await page.evaluate((h) => {
    const a = document.createElement('a')
    a.href = h
    document.body.appendChild(a)
    a.click()
    a.remove()
  }, href)
  return page.locator('.ant-modal').last()
}

test.describe('Узел IPFS в приложении, живая сеть', () => {
  // Необработанная ошибка в узле — это тост с ошибкой у пользователя
  // (use-error-boundary), даже если файл открылся.
  let pageErrors: string[] = []
  test.beforeEach(async ({ page }) => {
    pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    await openApp(page)
  })
  test.afterEach(() => {
    expect(pageErrors).toEqual([])
  })

  test('папка сайта по DNSLink: список, куда ведёт имя, подсказка про сайт', async ({ page }) => {
    const viewer = await follow(page, 'ipns://docs.ipfs.tech/')
    await expect(viewer.locator('li').first()).toBeVisible(FOUND)
    await expect(viewer.getByText('index.html', { exact: true })).toBeVisible()
    await expect(viewer).toContainText('DNSLink домена ведёт на /ipfs/')
    await expect(viewer).toContainText('Это сайт')
    await expect(viewer.getByRole('button', { name: 'Открыть сайт' })).toBeVisible()
  })

  test('страница — текстом, сверенным со ссылкой', async ({ page }) => {
    const viewer = await follow(page, 'ipns://docs.ipfs.tech/index.html')
    await expect(viewer.locator('pre')).toContainText(/<html/i, FOUND)
    await expect(viewer).toContainText('каждая его часть сверяется со ссылкой')
  })

  test('статья Википедии на IPFS', async ({ page }) => {
    const viewer = await follow(page, 'ipns://en.wikipedia-on-ipfs.org/wiki/Cat')
    await expect(viewer.locator('pre')).toContainText('Cat', FOUND)
  })

  test('картинка в окне и «Скачать» — тот же файл', async ({ page, browserName }) => {
    const viewer = await follow(page, 'ipns://docs.ipfs.tech/android-chrome-192x192.png')
    const img = viewer.locator('img')
    await expect(img).toBeVisible(FOUND)
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(192)

    // Chrome сохраняет через системный диалог, которого в тесте нет; Safari — загрузкой.
    test.skip(browserName !== 'webkit', 'сохранение загрузкой — только в WebKit')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      viewer.getByRole('button', { name: 'Скачать' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('android-chrome-192x192.png')
    expect(await download.failure()).toBeNull()
  })

  test('постоянная ссылка: своё имя IPNS открывает файл, имя файла — из записи', async ({
    page,
    browserName,
  }) => {
    const record = await signRecord(
      new Ed25519PrivateKey(randomBytes(32)),
      `${await docsRoot()}/android-chrome-192x192.png`,
      1n
    )
    await putRecord(record)

    const viewer = await follow(page, `ipns://${record.name}`)
    const img = viewer.locator('img')
    await expect(img).toBeVisible(FOUND)
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(192)
    await expect(viewer).toContainText('Имя ведёт на /ipfs/')
    await expect(viewer).toContainText('android-chrome-192x192.png')

    test.skip(browserName !== 'webkit', 'сохранение загрузкой — только в WebKit')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      viewer.getByRole('button', { name: 'Скачать' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('android-chrome-192x192.png')
  })
})
