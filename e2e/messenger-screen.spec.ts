import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Фильтр входящих: чат человека с низкой репутацией пропадает из списка, не
 * входит в счётчик, его новое — на глазе в шапке; меню глаза показывает
 * спрятанные вместе со всеми или одни, окно «Скрытые чаты» возвращает их,
 * меню «⋯» убирает в скрытые и возвращает. Шестерёнка и «Правила фильтра»
 * ведут в настройки чатов. В настройках — правило и человек по нику.
 * Диалоги подставлены в стор, сервер чатов закрыт, профили — с подменной ноды.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ANNA = 'PAnnaMockAddress111111111111111111'
const SPAM = 'PSpamMockAddress111111111111111111'
const NEWBIE = 'PNewbieMockAddress1111111111111111'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`

const DATA: MockNodeData = {
  profiles: [
    { address: ANNA, name: 'anna_ng', reputation: 300 },
    { address: SPAM, name: 'spam_bot', reputation: 0 },
    { address: NEWBIE, name: 'newbie_ng', reputation: 0 },
  ],
  posts: [],
  comments: [],
}

/** Перечитывание списка после новых профилей (PROFILE_UPDATE_DEBOUNCE) с запасом. */
const PROFILE_RELOAD_SETTLE = 2_500

const NOW = Date.now()
function dialog(id: string, partner: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    partner: { id: mx(partner), name },
    unreadCount: 0,
    lastMessage: {
      id: `$${id.slice(1)}`,
      chatId: id,
      senderId: mx(partner),
      text: `привет от ${name}`,
      timestamp: NOW,
      read: false,
      status: 'sent',
    },
    ...extra,
  }
}

const DIALOGS = [
  dialog('!anna:matrix.pocketnet.app', ANNA, 'anna_ng', { unreadCount: 1 }),
  dialog('!spam:matrix.pocketnet.app', SPAM, 'spam_bot', { unreadCount: 3 }),
  // Начали вы — правила такой чат не прячут.
  dialog('!newbie:matrix.pocketnet.app', NEWBIE, 'newbie_ng', { startedByMe: true }),
]

async function signedInWithDialogs(page: Page): Promise<void> {
  await page.route('**/_matrix/**', (route) => route.abort())
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const auth = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await auth.locator('input, textarea').first().fill(MNEMONIC)
  await auth.getByRole('button', { name: 'Войти' }).click()
  await expect(auth).toBeHidden({ timeout: 30_000 })
  await page.evaluate(async () => {
    type Store = Record<string, (...a: unknown[]) => unknown>
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> } } } }
      }
    ).__vue_app__
    await app.config.globalProperties.$pinia._s.get('messenger')!.openMessenger!()
  })
  // Сервер чатов закрыт: вход в мессенджер падает и очищает список, а новые
  // профили в кэше перечитывают список с сервера — тоже пустой. Поэтому
  // сначала сбой входа и профили собеседников (их кладёт разбор комнат), потом чаты.
  await expect(page.getByText('Не удалось войти в мессенджер', { exact: false })).toBeVisible({
    timeout: 30_000,
  })
  await page.evaluate((profiles) => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: {
            globalProperties: {
              $pinia: { _s: Map<string, { userProfiles: Record<string, unknown> }> }
            }
          }
        }
      }
    ).__vue_app__
    const cache = app.config.globalProperties.$pinia._s.get('messenger-profile-cache')!
    for (const p of profiles) cache.userProfiles[p.address] = { ...p }
  }, DATA.profiles)
  await page.waitForTimeout(PROFILE_RELOAD_SETTLE)
  await page.evaluate((dialogs) => {
    type Store = Record<string, (...a: unknown[]) => unknown>
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> } } } }
      }
    ).__vue_app__
    app.config.globalProperties.$pinia._s.get('messenger-ui')!.setDialogs!(dialogs)
  }, DIALOGS)
}

async function setReputationRule(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Store = Record<string, (...a: unknown[]) => unknown>
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> } } } }
      }
    ).__vue_app__
    app.config.globalProperties.$pinia._s.get('messenger-screen')!.setReputation!(true, 10)
  })
}

const totalUnread = (page: Page) =>
  page.evaluate(() => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: {
            globalProperties: { $pinia: { _s: Map<string, { totalUnreadCount: number }> } }
          }
        }
      }
    ).__vue_app__
    return app.config.globalProperties.$pinia._s.get('messenger')!.totalUnreadCount
  })

const messengerOpen = (page: Page) =>
  page.evaluate(() => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: { globalProperties: { $pinia: { _s: Map<string, { isOpen: boolean }> } } }
        }
      }
    ).__vue_app__
    return app.config.globalProperties.$pinia._s.get('messenger')!.isOpen
  })

const row = (page: Page, name: string) => page.getByTestId('chat-row').filter({ hasText: name })

/** Пункт меню глаза: normal, all, only, manage, rules. */
async function screenMenu(page: Page, item: string): Promise<void> {
  await page.getByTestId('chat-screen-toggle').click()
  const id = ['normal', 'all', 'only'].includes(item)
    ? `chat-screen-view-${item}`
    : `chat-screen-${item}`
  await page.getByTestId(id).click()
  await expect(page.getByTestId('chat-screen-menu')).toBeHidden()
}

async function rowMenu(page: Page, name: string, item: string): Promise<void> {
  const r = row(page, name)
  await r.hover()
  await r.locator('.dots-btn').click()
  await page.getByText(item, { exact: true }).click()
}

test('фильтр входящих: прячет, считает отдельно, глаз показывает, меню возвращает', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signedInWithDialogs(page)
  await expect(row(page, 'spam_bot')).toBeVisible({ timeout: 30_000 })
  // Счётчик — чаты с непрочитанным, а не сообщения (19f57b64): Анна и спам.
  expect(await totalUnread(page)).toBe(2)
  await expect(page.getByTestId('chat-screen-toggle')).toHaveCount(0)

  await setReputationRule(page)

  // Спам уходит, начатый вами чат остаётся.
  await expect(row(page, 'spam_bot')).toHaveCount(0, { timeout: 15_000 })
  await expect(row(page, 'anna_ng')).toBeVisible()
  await expect(row(page, 'newbie_ng')).toBeVisible()
  expect(await totalUnread(page)).toBe(1)

  const toggle = page.getByTestId('chat-screen-toggle')
  await expect(toggle).toBeVisible()
  await expect(toggle.getByTestId('chat-screen-new')).toHaveText('1')

  // «Показывать вместе со всеми» — спрятанное видно, с отметкой и причиной.
  await screenMenu(page, 'all')
  await expect(toggle).toHaveClass(/active/)
  const spam = row(page, 'spam_bot')
  await expect(spam).toBeVisible()
  await expect(spam.getByTestId('screened-mark')).toHaveAttribute(
    'title',
    'Скрыт фильтром: репутация ниже 10'
  )

  // «Вернуть из скрытых» — человек становится «всегда показывать».
  await rowMenu(page, 'spam_bot', 'Вернуть из скрытых')
  await expect(spam.getByTestId('screened-mark')).toHaveCount(0)
  expect(await totalUnread(page)).toBe(2)

  // «Убрать в скрытые» — вручную, и без правил.
  await rowMenu(page, 'anna_ng', 'Убрать в скрытые')
  await expect(row(page, 'anna_ng').getByTestId('screened-mark')).toHaveAttribute(
    'title',
    'Скрыт вами'
  )
  await screenMenu(page, 'normal')
  await expect(row(page, 'anna_ng')).toHaveCount(0)
  await expect(row(page, 'spam_bot')).toBeVisible()
  expect(await totalUnread(page)).toBe(1)
})

test('меню глаза: только скрытые, окно «Скрытые чаты», шестерёнка и правила — в настройки', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signedInWithDialogs(page)
  await expect(row(page, 'spam_bot')).toBeVisible({ timeout: 30_000 })
  await setReputationRule(page)
  await expect(row(page, 'spam_bot')).toHaveCount(0, { timeout: 15_000 })

  // Пункт меню отмечен; «Только скрытые» — в списке один спам.
  await page.getByTestId('chat-screen-toggle').click()
  await expect(page.getByTestId('chat-screen-menu')).toContainText('Скрыт фильтром 1 чат')
  await expect(page.getByTestId('chat-screen-view-normal')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('chat-screen-view-only').click()
  await expect(row(page, 'spam_bot')).toBeVisible()
  await expect(row(page, 'anna_ng')).toHaveCount(0)
  await expect(row(page, 'newbie_ng')).toHaveCount(0)

  // Окно: причина и число нового; «Вернуть» — спам снова виден, скрытых нет.
  await screenMenu(page, 'manage')
  const dialog = page.getByRole('dialog', { name: 'Скрытые чаты' })
  const item = dialog.getByTestId('screen-manage-row')
  await expect(item).toHaveCount(1)
  await expect(item).toContainText('spam_bot')
  await expect(item).toContainText('Скрыт фильтром: репутация ниже 10')
  await expect(item).toContainText('3')
  await item.getByTestId('screen-manage-unhide').click()
  await expect(dialog.getByTestId('screen-manage-empty')).toHaveText('Скрытых чатов нет')
  await dialog.locator('.ant-modal-close').click()
  await expect(dialog).toBeHidden()
  // В «Только скрытые» пусто — подсказка возвращает обычный список.
  await expect(page.getByTestId('chats-none-screened')).toBeVisible()
  await page
    .getByTestId('chats-none-screened')
    .getByRole('button', { name: 'Показать все чаты' })
    .click()
  await expect(row(page, 'spam_bot')).toBeVisible()
  await expect(row(page, 'anna_ng')).toBeVisible()
  await expect(page.getByTestId('chat-screen-toggle')).toHaveCount(0)

  // Шестерёнка — «Настройки → Чаты», окошко мессенджера закрывается.
  await page.getByTestId('chat-settings').first().click()
  await expect(page).toHaveURL(/\/settings\?tab=chats$/)
  await expect(page.getByTestId('screen-reputation')).toBeVisible()
  // Закрытое окошко прозрачно, но в DOM: смотрим на сам мессенджер.
  await expect.poll(() => messengerOpen(page)).toBe(false)

  // «Правила фильтра» — к разделу фильтра.
  await rowMenuFromSettings(page)
})

/** Снова мессенджер, спам спрятан вручную — «Правила фильтра» в меню глаза ведут к разделу. */
async function rowMenuFromSettings(page: Page): Promise<void> {
  await page.evaluate(async () => {
    type Store = Record<string, (...a: unknown[]) => unknown>
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: {
            globalProperties: {
              $pinia: { _s: Map<string, Store> }
              $router: { push(p: string): Promise<unknown> }
            }
          }
        }
      }
    ).__vue_app__
    await app.config.globalProperties.$router.push('/settings?tab=general')
    await app.config.globalProperties.$pinia._s.get('messenger')!.openMessenger!()
  })
  await rowMenu(page, 'spam_bot', 'Убрать в скрытые')
  await screenMenu(page, 'rules')
  await expect(page).toHaveURL(/\/settings\?tab=chats&section=screen$/)
  const head = page.locator('[data-settings-section="screen"]')
  await expect(head).toBeInViewport()
}

test('настройки: правило по репутации и человек по нику', async ({ page }) => {
  test.setTimeout(120_000)
  await signedInWithDialogs(page)
  await expect(row(page, 'spam_bot')).toBeVisible({ timeout: 30_000 })
  await page.evaluate(async () => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: {
            globalProperties: {
              $router: { push: (p: string) => Promise<unknown> }
              $pinia: { _s: Map<string, Record<string, () => void>> }
            }
          }
        }
      }
    ).__vue_app__
    // Окошко мессенджера в углу закрывает настройки — убираем.
    app.config.globalProperties.$pinia._s.get('messenger')!.closeWidget!()
    await app.config.globalProperties.$router.push('/settings')
  })
  // Вкладка настроек — последняя «Чаты» на странице: первая в шапке открывает мессенджер.
  await page.getByRole('button', { name: 'Чаты', exact: true }).last().click()

  const rep = page.getByTestId('screen-reputation')
  await expect(rep).toBeVisible()
  await expect(page.getByTestId('screen-hidden-count')).toHaveText('Сейчас ничего не скрыто')
  await rep.focus()
  await page.keyboard.press('Space')
  await expect(rep).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('screen-hidden-count')).toHaveText('Сейчас скрыт 1 чат', {
    timeout: 15_000,
  })

  // Порог выше репутации anna_ng — спрятан и её чат.
  const below = page.getByTestId('screen-reputation-below')
  await below.fill('500')
  await below.press('Enter')
  await below.blur()
  await expect(page.getByTestId('screen-hidden-count')).toHaveText('Сейчас скрыто 2 чата')
  await below.fill('10')
  await below.blur()
  await expect(page.getByTestId('screen-hidden-count')).toHaveText('Сейчас скрыт 1 чат')

  // По нику: такого нет — сказать; есть — в список, чат спрятан.
  const input = page.getByTestId('screen-add-input')
  await input.fill('nobody_here')
  await page.getByTestId('screen-add').click()
  await expect(page.getByTestId('screen-add-error')).toHaveText('Ника «nobody_here» в Bastyon нет')

  await input.fill('ANNA_NG')
  await page.getByTestId('screen-add').click()
  const person = page.getByTestId('screen-person')
  await expect(person).toHaveCount(1)
  await expect(person).toContainText('anna_ng')
  await expect(person.getByTestId('screen-person-hide')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('screen-hidden-count')).toHaveText('Сейчас скрыто 2 чата')

  // «Виден» — сильнее правил; крестик — убрать из списка.
  await person.getByTestId('screen-person-show').click()
  await expect(page.getByTestId('screen-hidden-count')).toHaveText('Сейчас скрыт 1 чат')
  await person.getByTestId('screen-person-remove').click()
  await expect(page.getByTestId('screen-person')).toHaveCount(0)
})
