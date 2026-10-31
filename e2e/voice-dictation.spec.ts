import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Голосовой ввод в окне поста: слова появляются в поле по ходу речи
 * (черновик), распознанная целиком фраза встаёт на их место, Ctrl+Z убирает
 * последнюю фразу одним шагом, а после 10 секунд без новых слов диктовка выключается
 * сама.
 * Приложение думает, что оно в Tauri: `__TAURI_INTERNALS__` подменён после
 * входа (как в my-files-permanent-link.spec.ts), команды asr_* отвечает тест,
 * события движка шлёт тоже он.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const DATA: MockNodeData = { profiles: [], posts: [], comments: [] }

type VoiceWindow = Window & {
  __asrCalls: string[]
  __asrEmit: (event: string, payload: unknown) => void
}

async function installTauriMock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as VoiceWindow & Record<string, unknown>
    const callbacks = new Map<number, (message: unknown) => void>()
    const listeners = new Map<string, number[]>()
    let next = 1
    w.__asrCalls = []
    w.__asrEmit = (event, payload) => {
      for (const id of listeners.get(event) ?? []) callbacks.get(id)?.({ event, id, payload })
    }
    const internals = {
      transformCallback: (cb: (message: unknown) => void) => {
        const id = next++
        callbacks.set(id, cb)
        return id
      },
      unregisterCallback: (id: number) => callbacks.delete(id),
      async invoke(cmd: string, args: Record<string, unknown> = {}) {
        if (cmd === 'plugin:event|listen') {
          const event = args.event as string
          listeners.set(event, [...(listeners.get(event) ?? []), args.handler as number])
          return args.handler
        }
        if (cmd.startsWith('plugin:')) return null
        w.__asrCalls.push(cmd)
        if (cmd === 'asr_status')
          return {
            supported: true,
            gpu: true,
            installing: null,
            models: [
              { id: 'base', size: 60e6, installed: false },
              { id: 'small', size: 190e6, installed: true },
              { id: 'turbo', size: 575e6, installed: false },
            ],
          }
        if (cmd === 'asr_start') return 5
        return null
      },
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    }
    Object.assign(window, { __TAURI_INTERNALS__: internals })
    // Стор голосового ввода создан при запуске, до подмены, и решил, что он в браузере.
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: { globalProperties: { $pinia: { _s: Map<string, { available: boolean }> } } }
        }
      }
    ).__vue_app__
    const voice = app.config.globalProperties.$pinia._s.get('voice-input')
    if (voice) voice.available = true
  })
}

const emit = (page: Page, event: string, payload: Record<string, unknown>) =>
  page.evaluate(([e, p]) => (window as unknown as VoiceWindow).__asrEmit(e as string, p), [
    event,
    { session: 5, ...payload },
  ] as const)
const calls = (page: Page) => page.evaluate(() => (window as unknown as VoiceWindow).__asrCalls)

test('слова по ходу речи, фраза на их месте, Ctrl+Z и выключение в тишине', async ({ page }) => {
  test.setTimeout(120_000)
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
  await installTauriMock(page)

  await page.getByRole('button', { name: 'Создать пост' }).first().click()
  const composer = page.getByRole('dialog', { name: 'Новый пост' })
  const text = composer.getByPlaceholder('Что у вас нового?')
  await text.click()
  await page.keyboard.type('Итак')
  await page.waitForTimeout(1200)

  await composer.getByRole('button', { name: 'Голосовой ввод' }).click()
  await expect.poll(() => calls(page)).toContain('asr_start')
  const stop = composer.getByRole('button', { name: 'Закончить диктовку (Esc)' })
  await expect(stop).toBeVisible()
  await emit(page, 'asr:state', { loading: false, pending: 0 })

  // Черновик растёт по ходу речи.
  await emit(page, 'asr:level', { level: 0.6, speaking: true })
  await emit(page, 'asr:partial', { seq: 0, text: 'Встречаемся' })
  await expect(text).toHaveValue('Итак встречаемся')
  await emit(page, 'asr:partial', { seq: 0, text: 'Встречаемся в семь' })
  await expect(text).toHaveValue('Итак встречаемся в семь')

  // Фраза распознана целиком — встаёт на место черновика.
  await emit(page, 'asr:text', { seq: 0, text: 'Встречаемся в семь, не опаздывайте.' })
  await expect(text).toHaveValue('Итак встречаемся в семь, не опаздывайте.')
  await emit(page, 'asr:level', { level: 0, speaking: false })

  // Ctrl+Z убирает фразу одним шагом, а не перебирает черновики.
  await page.keyboard.press('ControlOrMeta+z')
  await expect(text).toHaveValue('Итак')

  // Следующая фраза: черновик есть, а целиком в ней ничего не распознано.
  await emit(page, 'asr:partial', { seq: 1, text: 'Продолжение следует' })
  await expect(text).toHaveValue('Итак продолжение следует')
  await emit(page, 'asr:text', { seq: 1, text: '' })
  await expect(text).toHaveValue('Итак')

  // 10 секунд без новых слов — диктовка выключается сама.
  expect(await calls(page)).not.toContain('asr_stop')
  await expect.poll(() => calls(page), { timeout: 15_000 }).toContain('asr_stop')
  await emit(page, 'asr:end', { reason: 'stopped', error: null })
  await expect(composer.getByRole('button', { name: 'Голосовой ввод' })).toBeVisible()
})
