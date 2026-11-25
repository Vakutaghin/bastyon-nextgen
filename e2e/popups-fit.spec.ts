import { test, expect, type Locator, type Page } from '@playwright/test'
import { UI } from '../src/components/testing/ui-selectors'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { useMockPeerTube, VIDEO_URL } from './support/mock-peertube'
import { settleOfflineMessenger } from './support/offline-messenger'
import { expectFits, setInsets, type Screen } from './support/popup-fit'

/**
 * Меню, списки, панели и подсказки у любого края экрана видны целиком: нет
 * места внизу — раскрываются вверх, нет справа — влево, ни там ни там — вбок.
 * Кнопку каждого компонента со страницы /dev/ui ставим во все углы и в
 * середину краёв.
 */

const SCREENS: Screen[] = [
  { name: 'компьютер', width: 1366, height: 768 },
  {
    name: 'телефон стоя',
    width: 360,
    height: 640,
    touch: true,
    insets: { top: 40, bottom: 34 },
  },
  {
    name: 'телефон боком',
    width: 640,
    height: 360,
    touch: true,
    insets: { left: 44, right: 20, bottom: 24 },
  },
]

type Spot = { name: string; x: number; y: number }
const SPOTS: Spot[] = [0, 0.5, 1].flatMap((y) =>
  [0, 0.5, 1].map((x) => ({ name: `${x * 100}% ${y * 100}%`, x, y }))
)

interface Popup {
  name: string
  trigger: string
  panel: string
  rows?: string
}

const POPUPS: Popup[] = [
  {
    name: 'меню',
    trigger: '[data-testid="dev-dropdown"]',
    panel: '.ui-menu',
    rows: UI.menuItem,
  },
  {
    name: 'панель',
    trigger: '[data-testid="dev-pop-click"]',
    panel: UI.popover,
    rows: 'p, button',
  },
  {
    name: 'подтверждение',
    trigger: '[data-testid="dev-popconfirm"]',
    panel: UI.popover,
    rows: 'button',
  },
  {
    name: 'список выбора',
    trigger: '[data-testid="dev-select"]',
    panel: '.ui-select-panel',
    rows: UI.selectOption,
  },
  {
    name: 'дата и время',
    trigger: '[data-testid="dev-date"]',
    panel: '.ui-date-panel',
    rows: '.ui-date-panel__nav, .ui-date-panel__footer button',
  },
  { name: 'подсказка', trigger: '[data-testid="dev-tip-click"]', panel: '.ui-tooltip' },
]

async function openDevUi(page: Page): Promise<void> {
  await useMockNode(page, { profiles: [], posts: [], comments: [] })
  await page.goto('/dev/ui')
  await page.locator(POPUPS[0]!.trigger).waitFor({ timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

/** Кнопка — в заданном месте экрана, внутри вырезов, поверх всего. */
async function place(page: Page, selector: string, spot: Spot, insets: Screen['insets'] = {}) {
  await page.evaluate(
    ([sel, s, i]) => {
      const el = document.querySelector<HTMLElement>(sel)!
      const w = Math.min(el.offsetWidth, 220)
      const h = el.offsetHeight
      const left = i.left ?? 0
      const top = i.top ?? 0
      const spanX = window.innerWidth - left - (i.right ?? 0) - w
      const spanY = window.innerHeight - top - (i.bottom ?? 0) - h
      Object.assign(el.style, {
        position: 'fixed',
        zIndex: '900',
        width: `${w}px`,
        left: `${left + spanX * s.x}px`,
        top: `${top + spanY * s.y}px`,
      })
    },
    [selector, spot, insets] as const
  )
}

for (const screen of SCREENS) {
  for (const popup of POPUPS) {
    test.describe(`${screen.name} ${screen.width}×${screen.height}`, () => {
      test.use({
        viewport: { width: screen.width, height: screen.height },
        hasTouch: !!screen.touch,
      })

      test(`${popup.name} видна целиком у любого края`, async ({ page }) => {
        test.setTimeout(120_000)
        await openDevUi(page)
        await setInsets(page, screen.insets)
        // Шапка и нижняя панель закрывают кнопки у краёв, а не панели.
        await page.addStyleTag({ content: '[data-screen-edge]{display:none!important}' })
        for (const spot of SPOTS) {
          await test.step(spot.name, async () => {
            await place(page, popup.trigger, spot, screen.insets)
            const trigger = page.locator(popup.trigger)
            if (screen.touch) await trigger.tap()
            else await trigger.click()
            const panel = page.locator(popup.panel).last()
            await expectFits(page, panel, { insets: screen.insets, rows: popup.rows })
            // Нажатие мимо закрывает (у подсказки — повторное нажатие).
            await page.keyboard.press('Escape')
            await expect(page.locator(popup.panel)).toHaveCount(0)
          })
        }
      })
    })
  }
}

// ————— Панели, которые живут рядом со своим полем —————

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`
const PEOPLE = Array.from({ length: 12 }, (_, i) => ({
  address: `PMockPerson${String(i).padStart(2, '0')}11111111111111111111`,
  name: `person_${i}`,
  reputation: 100,
}))
const POST = 'a'.repeat(64)
const APP: MockNodeData = {
  profiles: [{ address: ME, name: 'me_ng', reputation: 500 }, ...PEOPLE],
  posts: [
    {
      txid: POST,
      address: PEOPLE[0]!.address,
      message: 'Пост с веткой',
      comments: PEOPLE.length,
      lastComment: 'c0'.padEnd(64, '0'),
    },
  ],
  comments: PEOPLE.map((person, i) => ({
    id: `c${i}`.padEnd(64, '0'),
    postid: POST,
    address: person.address,
    message: `Комментарий ${i}`,
  })),
  tags: Array.from({ length: 20 }, (_, i) => `лес_${i}`),
}

async function signIn(page: Page, screen: Screen, path = '/'): Promise<void> {
  await page.setViewportSize(screen)
  await page.route('**/_matrix/**', (route) => route.abort())
  await useMockNode(page, APP)
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
  // Тосты лежат поверх панелей нарочно — здесь они ни при чём.
  await page.addStyleTag({ content: `${UI.toastHost}{display:none!important}` })
  if (path !== '/') {
    await page.evaluate((to) => {
      const app = document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $router: { push: (p: string) => void } } } }
      }
      app.__vue_app__.config.globalProperties.$router.push(to)
    }, path)
  }
}

/** Прокрутить страницу так, чтобы низ элемента встал на `fromBottom` от низа экрана. */
async function scrollTo(page: Page, target: Locator, fromBottom: number): Promise<void> {
  await target.evaluate((el, gap) => {
    window.scrollBy(0, el.getBoundingClientRect().bottom - (window.innerHeight - gap))
  }, fromBottom)
  await page.waitForTimeout(300)
}

const DESKTOP: Screen = { name: 'компьютер', width: 1366, height: 768 }
const PHONE: Screen = { name: 'телефон стоя', width: 360, height: 640 }
const LANDSCAPE: Screen = { name: 'телефон боком', width: 740, height: 360 }

for (const screen of [DESKTOP, PHONE]) {
  test(`упоминание в ответе у низа экрана: ${screen.name}`, async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page, screen, `/post/${POST}`)
    const list = page.locator('[data-styled-name="SC_MentionList"]')
    const check = async (field: Locator): Promise<void> => {
      await field.click()
      // Поле у низа, в середине и под шапкой: список не лезет под неё и под
      // нижнюю панель и не накрывает само поле.
      for (const gap of [70, 300, screen.height - 160]) {
        await scrollTo(page, field, gap)
        await field.fill('')
        await field.pressSequentially('@person')
        await expectFits(page, list, { rows: 'button' })
      }
      await field.fill('')
    }

    // Ветка открывается не с первого нажатия: кнопка есть раньше обработчика.
    await expect(async () => {
      await page
        .getByRole('button', { name: 'Загрузить ещё' })
        .click({ timeout: 2_000 })
        .catch(() => {})
      await expect(page.getByText('Комментарий 5')).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 40_000 })

    await check(page.getByPlaceholder(/Введите комментарий/))
    await page.getByRole('button', { name: 'Ответить', exact: true }).last().click()
    await check(page.getByPlaceholder(/Введите ответ/))
  })

  test(`подсказки тегов: ${screen.name}`, async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page, screen)
    await page.getByRole('button', { name: 'Создать пост' }).first().click()
    const field = page.getByRole('textbox', { name: 'Добавьте теги…' })
    await field.click()
    await field.pressSequentially('лес')
    const list = page.locator('ul').filter({ hasText: '#лес_' }).last()
    await expectFits(page, list, { rows: 'li' })
    // Список выше поля или ниже — но само поле видно.
    const [box, input] = await Promise.all([list.boundingBox(), field.boundingBox()])
    expect(box!.y >= input!.y + input!.height || box!.y + box!.height <= input!.y).toBe(true)
  })
}

for (const screen of [DESKTOP, PHONE, LANDSCAPE]) {
  test(`чат: скрепка, смайлы и упоминание — ${screen.name}`, async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page, screen)
    await settleOfflineMessenger(page, PEOPLE)
    await page.evaluate(
      async ({ group, members, me }) => {
        // Участники группы: без сервера чатов их отдаёт подменный клиент.
        const { matrixService } = (await import(
          /* @vite-ignore */ '/src/b-components/messenger/services/matrix-service.ts'
        )) as { matrixService: { getClient: () => object | null } }
        const join = (userId: string) => ({ userId, membership: 'join' })
        const room = {
          roomId: group,
          currentState: {
            getMembers: () => [join(me), ...members.map((m) => join(m.id))],
            getStateEvents: () => null,
          },
          getJoinRule: () => 'invite',
          loadMembersIfNeeded: async () => true,
        }
        const real = matrixService.getClient.bind(matrixService)
        ;(matrixService as unknown as { getClient: () => unknown }).getClient = () => ({
          ...(real() ?? {}),
          getUserId: () => me,
          getRoom: (id: string) => (id === group ? room : null),
          getIgnoredUsers: () => [],
        })
        const s = (
          document.querySelector('#app') as unknown as {
            __vue_app__: {
              config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
            }
          }
        ).__vue_app__.config.globalProperties.$pinia._s
        const ui = s.get('messenger-ui') as unknown as {
          setDialogs: (d: unknown[]) => void
          switchToChat: (id: string) => void
        }
        const chat = s.get('messenger-chat') as unknown as {
          messages: Record<string, unknown[]>
          currentUser: { id: string }
        }
        chat.currentUser.id = me
        const list = members.map((m, i) => ({
          id: `$m${i}`,
          chatId: group,
          senderId: m.id,
          senderName: m.name,
          text: `сообщение ${i}`,
          timestamp: Date.now() - (members.length - i) * 60_000,
          read: true,
          status: 'sent',
        }))
        ui.setDialogs([
          {
            id: group,
            partner: { id: group, name: 'Команда' },
            unreadCount: 0,
            lastMessage: list[list.length - 1],
            group: { memberCount: members.length + 1, previewIds: [] },
          },
        ])
        chat.messages[group] = list
        ui.switchToChat(group)
      },
      {
        group: '!team:matrix.pocketnet.app',
        me: mx(ME),
        members: PEOPLE.map((p) => ({ id: mx(p.address), name: p.name })),
      }
    )
    const attach = page.locator('[data-styled-name="SC_AttachButton"]')
    await expect(attach).toBeVisible({ timeout: 30_000 })
    await attach.click()
    const menu = page.locator('[data-styled-name="SC_AttachmentRoot"] [data-styled-name="SC_Menu"]')
    await expectFits(page, menu, { rows: 'button' })
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)

    await page.getByRole('button', { name: 'Открыть выбор эмодзи' }).click()
    const emoji = page.locator('[data-styled-name="SC_EmojiPickerContainer"]')
    await expectFits(page, emoji, { rows: 'button' })
    await page.keyboard.press('Escape')
    await expect(emoji).toHaveCount(0)

    await page.getByPlaceholder('Введите сообщение').fill('@per')
    const mention = page.getByTestId('mention-picker')
    await expectFits(page, mention, { rows: '[role="option"]' })
    await page.keyboard.press('Escape')

    // Меню сообщения — у первого и у последнего видимого.
    for (const at of ['first', 'last'] as const) {
      const row = page.getByTestId('message-actions')[at]()
      await row.scrollIntoViewIfNeeded()
      await row.click()
      await expectFits(page, page.locator(UI.popover).last(), { rows: 'button' })
      await page.keyboard.press('Escape')
      await expect(page.locator(UI.popover)).toHaveCount(0)
    }
  })

  test(`карточки шапки: ${screen.name}`, async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page, screen)
    for (const trigger of await page.locator(`header ${UI.dropdownTrigger}`).all()) {
      if (!(await trigger.isVisible())) continue
      await trigger.click()
      const panel = page.locator('.ui-dropdown > *').last()
      if (await panel.isVisible().catch(() => false)) {
        await expectFits(page, panel, { rows: UI.menuItem })
      }
      await page.keyboard.press('Escape')
      await expect(page.locator('.ui-dropdown')).toHaveCount(0)
    }
  })
}

for (const screen of [
  { name: 'компьютер', width: 1366, height: 768 },
  { name: 'низкое окно', width: 1280, height: 560 },
] satisfies Screen[]) {
  test(`меню «…» каждой строки списка чатов в виджете: ${screen.name}`, async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page, screen)
    await settleOfflineMessenger(page, PEOPLE)
    await page.evaluate(
      (people) => {
        const s = (
          document.querySelector('#app') as unknown as {
            __vue_app__: {
              config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
            }
          }
        ).__vue_app__.config.globalProperties.$pinia._s
        ;(s.get('messenger-ui') as unknown as { setDialogs: (d: unknown[]) => void }).setDialogs(
          people.map((p, i) => ({
            id: `!room${i}:matrix.pocketnet.app`,
            partner: { id: p.id, name: p.name },
            unreadCount: 0,
            lastMessage: {
              id: `$last${i}`,
              chatId: `!room${i}:matrix.pocketnet.app`,
              senderId: p.id,
              text: 'привет',
              timestamp: Date.now() - i * 60_000,
              read: true,
              status: 'sent',
            },
          }))
        )
      },
      PEOPLE.map((p) => ({ id: mx(p.address), name: p.name }))
    )
    const rows = page.getByTestId('chat-row')
    await expect(rows).toHaveCount(PEOPLE.length, { timeout: 30_000 })
    for (let i = 0; i < PEOPLE.length; i++) {
      await rows.nth(i).scrollIntoViewIfNeeded()
      await rows.nth(i).hover()
      await rows.nth(i).locator('.dots-btn').click()
      await expectFits(page, page.locator('.ui-menu'), { rows: UI.menuItem })
      await page.keyboard.press('Escape')
      await expect(page.locator('.ui-menu')).toHaveCount(0)
    }
  })
}

for (const screen of [DESKTOP, PHONE, LANDSCAPE]) {
  test(`найденные получатели в кошельке: ${screen.name}`, async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page, screen, '/wallets')
    await page.getByRole('button', { name: 'Переводы', exact: true }).click({ timeout: 30_000 })
    const field = page.locator('#wallet-transfer-receiver')
    await field.waitFor({ timeout: 30_000 })
    for (const gap of [70, screen.height - 160]) {
      await scrollTo(page, field, gap)
      await field.fill('')
      await field.pressSequentially('person')
      await expectFits(page, page.locator('[data-styled-name="SC_TransferSearchDropdown"]'), {
        rows: 'button',
      })
    }
  })

  test(`недавние запросы в обозревателе: ${screen.name}`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.addInitScript(() => {
      const list = Array.from({ length: 10 }, (_, i) => ({
        kind: 'block',
        value: String(1000 + i),
        lastVisitedAt: Math.floor(Date.now() / 1000) - i,
        hits: 1,
      }))
      localStorage.setItem('bastyon.explorer.searchHistory.v1', JSON.stringify(list))
    })
    await signIn(page, screen, '/explorer')
    const field = page.getByPlaceholder('Хеш блока, txid, адрес или высота')
    await field.waitFor({ timeout: 30_000 })
    for (const gap of [70, screen.height - 160]) {
      await scrollTo(page, field, gap)
      await field.blur()
      await field.focus()
      await expectFits(page, page.locator('[data-styled-name="SC_SuggestionsDropdown"]'))
    }
  })

  test(`список блоков статьи: ${screen.name}`, async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page, screen)
    await page.getByRole('button', { name: 'Создать пост' }).first().click()
    await page.getByRole('button', { name: 'Статья', exact: true }).click()
    const editor = page.locator('.ProseMirror')
    await editor.click()
    for (let i = 0; i < 12; i++) {
      await page.keyboard.type(`строка ${i}`)
      await page.keyboard.press('Enter')
    }
    await page.keyboard.type('/')
    const list = page.getByRole('menu', { name: 'Добавить блок' })
    await expectFits(page, list, { rows: '[role="menuitem"]' })
    // Последний пункт виден и стрелками.
    await page.keyboard.press('ArrowUp')
    await expect(list.getByRole('menuitem').last()).toBeInViewport()
  })
}

test.describe('настройки плеера', () => {
  const VIDEO: MockNodeData = {
    profiles: APP.profiles,
    posts: Array.from({ length: 3 }, (_, i) => ({
      txid: 'edc'[i]!.repeat(64),
      address: PEOPLE[0]!.address,
      message: `Ролик ${i}`,
      type: 'video' as const,
      url: VIDEO_URL,
    })),
    comments: [],
  }

  for (const screen of [DESKTOP, { name: 'низкое окно', width: 1280, height: 420 }] as Screen[]) {
    test(`видны, даже когда верх ролика ушёл под шапку: ${screen.name}`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize(screen)
      await useMockNode(page, VIDEO)
      await useMockPeerTube(page, { hls: true })
      await page.goto('/')
      await page.waitForSelector('#app > *', { timeout: 30_000 })
      await page
        .getByRole('button', { name: 'Понятно' })
        .click({ timeout: 5_000 })
        .catch(() => {})
      const post = page.getByRole('article').filter({ hasText: 'Ролик 0' })
      const video = post.locator('video').first()
      const player = video.locator('xpath=ancestor::div[@tabindex="0"][1]')
      await player.click()
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 30_000 })
        .toBeGreaterThan(0)
      const gear = player.getByRole('button', { name: 'Настройки' })
      const menu = page.getByTestId('player-settings')

      // Низ ролика: у низа экрана, в середине и почти под шапкой.
      for (const bottom of [screen.height - 20, screen.height / 2, 130]) {
        await player.evaluate((el, y) => {
          window.scrollBy(0, el.getBoundingClientRect().bottom - y)
        }, bottom)
        await page.waitForTimeout(300)
        await video.evaluate((v: HTMLVideoElement) => v.pause())
        await gear.click()
        await expectFits(page, menu, { rows: 'button' })
        await page.getByRole('menuitem', { name: /Скорость/ }).click()
        await expectFits(page, menu, { rows: 'button' })
        await page.keyboard.press('Escape')
        await expect(menu).toHaveCount(0)
      }
    })
  }

  test('нажатие по ролику закрывает меню и не трогает ролик; клавиатурой — стрелки и Esc', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(DESKTOP)
    await useMockNode(page, VIDEO)
    await useMockPeerTube(page, { hls: true })
    await page.goto('/')
    await page.waitForSelector('#app > *', { timeout: 30_000 })
    await page
      .getByRole('button', { name: 'Понятно' })
      .click({ timeout: 5_000 })
      .catch(() => {})
    const post = page.getByRole('article').filter({ hasText: 'Ролик 0' })
    const video = post.locator('video').first()
    const player = video.locator('xpath=ancestor::div[@tabindex="0"][1]')
    const paused = () => video.evaluate((v: HTMLVideoElement) => v.paused)
    await player.click()
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 30_000 })
      .toBeGreaterThan(0)
    const gear = player.getByRole('button', { name: 'Настройки' })
    const menu = page.getByTestId('player-settings')

    await gear.click()
    await expect(menu).toBeVisible()
    const box = (await player.boundingBox())!
    await page.mouse.click(box.x + 60, box.y + 60)
    await expect(menu).toHaveCount(0)
    await page.waitForTimeout(400)
    expect(await paused()).toBe(false)

    // Шестерёнка и закрывает.
    await gear.click()
    await expect(menu).toBeVisible()
    await gear.click()
    await expect(menu).toHaveCount(0)

    await gear.focus()
    await page.keyboard.press('Enter')
    await expect(menu).toBeVisible()
    await expect(menu.locator('button').first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(menu.locator('button').first()).toBeFocused()
    await expect(page.getByRole('menuitemradio').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(gear).toBeFocused()
    expect(await paused()).toBe(false)

    // Во весь экран меню — внутри плеера: снаружи его не видно.
    await player.getByRole('button', { name: /полноэкран|весь экран/i }).click()
    await gear.click()
    await expect(menu).toBeVisible()
    expect(
      await player.evaluate((el) => !!el.querySelector('[data-testid="player-settings"]'))
    ).toBe(true)
    await expectFits(page, menu, { rows: 'button' })
  })
})
