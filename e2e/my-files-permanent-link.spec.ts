import { test, expect, type Page, type Route } from '@playwright/test'
import { parseRecord } from '../src/helpers/ipfs/ipns-names'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * «Мои файлы» → постоянная ссылка: создать ссылку на файл, увидеть её с
 * QR-кодом и перевести на новую версию. Приложение думает, что оно в Tauri:
 * `__TAURI_INTERNALS__` подменён после входа (как в mesh.spec.ts), команды
 * ipfs_* отвечает тест. delegated routing — словарь в тесте, который, как
 * DHT, проверяет подпись и не берёт запись со старым номером.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const DATA: MockNodeData = { profiles: [], posts: [], comments: [] }
const REPORT = {
  cid: 'bafybeier6ud42ptljtfaxrdlknktw54b7ohfpg5h33mosxpxjndxs7xzvm',
  name: 'Отчёт за май.pdf',
  size: 120_000,
  addedAt: Date.parse('2026-10-20T10:00:00Z'),
}
const REPORT_V2 = {
  cid: 'bafybeifson4pvbi2mutnpylre426pghwfo6wszesnksilpofbap6imhl6e',
  name: 'Отчёт за май v2.pdf',
  size: 130_000,
  addedAt: Date.parse('2026-10-21T10:00:00Z'),
}
const SECRET = {
  ...REPORT,
  cid: 'bafkreihfcegubxdrpkij2p6gtgcbq5ygjq6hsnzycw46zk7cvoppsfyagu',
  name: 's.pdf',
  key: 'k',
}

/** delegated routing в памяти. */
class Routing {
  readonly records = new Map<string, Uint8Array>()

  async handle(route: Route): Promise<void> {
    const request = route.request()
    const name = new URL(request.url()).pathname.split('/').pop() ?? ''
    const cors = { 'Access-Control-Allow-Origin': '*' }
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'PUT',
          'Access-Control-Allow-Headers': 'content-type',
        },
      })
    }
    if (request.method() === 'PUT') {
      const bytes = new Uint8Array(request.postDataBuffer() ?? [])
      const incoming = await parseRecord(name, bytes)
      const stored = this.records.get(name)
      if (stored && (await parseRecord(name, stored)).sequence >= incoming.sequence) {
        return route.fulfill({ status: 400, headers: cors, body: 'older record' })
      }
      this.records.set(name, bytes)
      return route.fulfill({ status: 200, headers: cors })
    }
    const bytes = this.records.get(name)
    return bytes
      ? route.fulfill({
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/vnd.ipfs.ipns-record' },
          body: Buffer.from(bytes),
        })
      : route.fulfill({
          status: 200,
          headers: { ...cors, 'Content-Type': 'text/plain' },
          body: 'routing: not found',
        })
  }

  async value(name: string): Promise<{ value: string; sequence: bigint }> {
    return parseRecord(name, this.records.get(name) as Uint8Array)
  }
}

/** Команды ipfs_* — от «компьютера» с работающей нодой и тремя файлами. */
async function installTauriMock(page: Page, kuboPuts: string[]): Promise<void> {
  await page.exposeFunction('__ipfsBridge', (cmd: string, args: string) => {
    const a = JSON.parse(args) as Record<string, unknown>
    switch (cmd) {
      case 'ipfs_status':
        return {
          value: {
            status: 'running',
            gateway_port: 8080,
            installed: true,
            update_available: false,
          },
        }
      case 'ipfs_shares':
        return { value: [REPORT_V2, REPORT, SECRET] }
      case 'ipfs_pin_service_status':
        return { value: false }
      case 'ipfs_name_put':
        kuboPuts.push(a.name as string)
        return { value: null }
      default:
        return { value: null }
    }
  })
  await page.evaluate(() => {
    let next = 1
    const internals = {
      transformCallback: () => next++,
      unregisterCallback: () => {},
      async invoke(cmd: string, args: Record<string, unknown> = {}) {
        const bridge = (
          window as unknown as {
            __ipfsBridge: (c: string, a: string) => Promise<{ value?: unknown; error?: string }>
          }
        ).__ipfsBridge
        const result = await bridge(cmd, JSON.stringify(args ?? {}))
        if (result.error) throw result.error
        return result.value
      },
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    }
    Object.assign(window, { __TAURI_INTERNALS__: internals })
    // Стор IPFS создан при запуске, до подмены, и решил, что он в браузере.
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: { globalProperties: { $pinia: { _s: Map<string, { available: boolean }> } } }
        }
      }
    ).__vue_app__
    const ipfs = app.config.globalProperties.$pinia._s.get('ipfs')
    if (ipfs) ipfs.available = true
  })
}

async function signIn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

async function goTo(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    const el = document.querySelector('#app') as unknown as {
      __vue_app__: {
        config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } }
      }
    }
    return el.__vue_app__.config.globalProperties.$router.push(to)
  }, path)
}

test('постоянная ссылка: создать, QR, перевести на новую версию', async ({ page }) => {
  test.setTimeout(120_000)
  const routing = new Routing()
  const kuboPuts: string[] = []

  await useMockNode(page, DATA)
  await page.route(/^https:\/\/delegated-ipfs\.dev\/routing\/v1\/ipns\//, (route) =>
    routing.handle(route)
  )
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await signIn(page)
  await installTauriMock(page, kuboPuts)
  await goTo(page, '/my-files')

  const report = page
    .locator('div', { hasText: REPORT.name })
    .filter({ has: page.getByRole('button', { name: 'Перестать раздавать' }) })
    .last()
  await expect(report).toBeVisible({ timeout: 15_000 })
  // У приватного файла постоянной ссылки нет.
  await expect(page.getByRole('button', { name: 'Постоянная ссылка' })).toHaveCount(2)

  await report.getByRole('button', { name: 'Постоянная ссылка' }).click()
  const dialog = page.getByRole('dialog', { name: 'Постоянная ссылка' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Постоянная ссылка' })).toHaveValue(
    /^ipns:\/\/k51[0-9a-z]{50,}$/
  )
  const name0 = (
    await dialog.getByRole('textbox', { name: 'Постоянная ссылка' }).inputValue()
  ).slice('ipns://'.length)
  await expect(dialog).toContainText(`Сейчас ведёт на «${REPORT.name}»`)
  await expect(dialog.getByRole('img', { name: 'QR-код постоянной ссылки' })).toBeVisible()
  expect(await routing.value(name0)).toMatchObject({
    value: `/ipfs/${REPORT.cid}/${REPORT.name}`,
    sequence: 1n,
  })
  await expect.poll(() => kuboPuts).toEqual([name0])

  // Новая версия: выбрать файл и перевести ссылку.
  await dialog.locator('.ant-select').click()
  await page.locator('.ant-select-item-option', { hasText: REPORT_V2.name }).click()
  await dialog.getByRole('button', { name: 'Перевести ссылку' }).click()
  await expect(dialog).toContainText(`Сейчас ведёт на «${REPORT_V2.name}»`)
  expect(await routing.value(name0)).toMatchObject({
    value: `/ipfs/${REPORT_V2.cid}/${REPORT_V2.name}`,
    sequence: 2n,
  })
  await dialog.getByRole('button', { name: 'Close' }).click()

  // В списке постоянных ссылок — куда ведёт ссылка.
  const section = page.getByRole('heading', { name: 'Постоянные ссылки' })
  await expect(section).toBeVisible()
  await expect(page.getByText(`ipns://${name0.slice(0, 10)}…${name0.slice(-6)}`)).toBeVisible()
})
