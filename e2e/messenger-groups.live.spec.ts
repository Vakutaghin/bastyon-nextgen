import { test, expect, type Page } from '@playwright/test'
import { type MockNodeData } from './support/mock-node'
import {
  matrixId,
  matrixReady,
  newAccounts,
  openChatWith,
  send,
  signedIn,
} from './support/live-matrix'

/**
 * Групповые чаты вживую на своём Synapse: группа в формате прежнего клиента
 * («@» в названии, «_» в описании, роли уровнями power_levels). Запуск — как
 * у matrix-receipts.live.spec.ts; без E2E_SYNAPSE_URL пропускается.
 */

const BASE = process.env.E2E_SYNAPSE_URL
test.skip(!BASE, 'нужен локальный Synapse, см. шапку matrix-receipts.live.spec.ts')
test.use({ baseURL: BASE })

const MATRIX_SERVICE = '/src/b-components/messenger/services/matrix-service.ts'

/** Группа от имени пользователя страницы — как её создаёт прежний клиент. */
async function createLegacyGroup(
  page: Page,
  opts: { name: string; topic?: string; invite: string[]; moderators?: string[] }
): Promise<string> {
  return page.evaluate(
    async ({ opts, mod }) => {
      const { matrixService } = await import(/* @vite-ignore */ mod)
      const client = matrixService.getClient()
      const { room_id } = await client.createRoom({
        visibility: 'private',
        invite: opts.invite,
        name: `@${opts.name}`,
      })
      if (opts.topic) await client.setRoomTopic(room_id, opts.topic.replace(/ /g, '_'))
      for (const id of opts.moderators ?? []) await client.setPowerLevel(room_id, id, 50)
      return room_id as string
    },
    { opts, mod: MATRIX_SERVICE }
  )
}

/** Стор мессенджера страницы: открыть окно, открыть чат. */
async function messenger(page: Page, chatId?: string): Promise<void> {
  await page.evaluate(async (id) => {
    type Messenger = { openMessenger: () => Promise<void>; openChat: (id: string) => Promise<void> }
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Messenger> } } } }
      }
    ).__vue_app__
    const store = app.config.globalProperties.$pinia._s.get('messenger')!
    await store.openMessenger()
    if (id) void store.openChat(id)
  }, chatId)
}

/** Matrix-клиент страницы: тот же модуль, что у приложения (eval страница запрещает). */
async function roomState(page: Page, roomId: string) {
  return page.evaluate(
    async ({ roomId, mod }) => {
      const { matrixService } = await import(/* @vite-ignore */ mod)
      const room = matrixService.getRoom(roomId)
      return {
        muted: matrixService.isRoomMuted(roomId) as boolean,
        ignored: (matrixService.getClient()?.getIgnoredUsers?.() ?? []) as string[],
        membership: (room?.getMyMembership?.() ?? null) as string | null,
        count: (room?.getInvitedAndJoinedMemberCount?.() ?? 0) as number,
        members: (
          (room?.currentState?.getMembers?.() ?? []) as Array<{
            userId: string
            membership: string
          }>
        ).map((m) => `${m.userId.slice(1, 9)}:${m.membership}`),
      }
    },
    { roomId, mod: MATRIX_SERVICE }
  )
}

/** Список чатов: окно открыто (кнопка «Сообщения» его бы закрыла), чат не выбран. */
async function openMessengerList(page: Page): Promise<void> {
  await messenger(page)
}

test('группа видна в списке, у неё участники, «без звука», личное сообщение и выход', async ({
  browser,
}) => {
  test.setTimeout(360_000)
  const [alice, bob, carol] = await newAccounts(browser, 3)
  // Разная длина имён — разные id профилей у подменной ноды: по ним
  // упорядочены ключи групповой шифровки.
  const data: MockNodeData = {
    profiles: [
      { address: alice!.address, name: 'alice_e2e', k: alice!.keys },
      { address: bob!.address, name: 'bob_e2e', k: bob!.keys },
      { address: carol!.address, name: 'carolina_e2e', k: carol!.keys },
    ],
    posts: [],
    comments: [],
  }
  const a = await signedIn(browser, alice!, data)
  const b = await signedIn(browser, bob!, data)
  // Кэролайн входит один раз — чтобы у неё был аккаунт в Matrix — и группу не открывает.
  const c = await signedIn(browser, carol!, data)
  await Promise.all([matrixReady(a), matrixReady(b), matrixReady(c)])
  await c.close()

  // У Боба есть и личный чат: в «Переписках» он рядом с группами.
  await openChatWith(b, alice!, true)
  await send(b, 'Привет, это личное')
  await b.keyboard.press('Escape')

  const BOB = matrixId(bob!.address)
  const CAROL = matrixId(carol!.address)
  const ALICE = matrixId(alice!.address)
  const club = await createLegacyGroup(a, {
    name: 'Книжный клуб',
    topic: 'Читаем по главе',
    invite: [BOB, CAROL],
    moderators: [BOB],
  })
  // Группа на двоих — всё равно группа.
  await createLegacyGroup(a, { name: 'Дуэт', invite: [BOB] })

  await messenger(a, club)
  await send(a, 'Первая глава прочитана')

  // --- Список чатов у Боба: приглашения появляются сами ---
  await openMessengerList(b)
  const clubRow = b
    .locator('[data-testid=chat-row][data-group]')
    .filter({ hasText: 'Книжный клуб' })
  await expect(clubRow).toBeVisible({ timeout: 60_000 })
  // Группа на двоих — тоже группа, а не личный чат.
  await expect(
    b.locator('[data-testid=chat-row][data-group]').filter({ hasText: 'Дуэт' })
  ).toBeVisible({
    timeout: 60_000,
  })
  // Название без «@» прежнего клиента, значок группы у названия.
  await expect(clubRow.getByText('@Книжный клуб')).toHaveCount(0)
  await expect(clubRow.getByLabel(/^Группа · \d+ участник/)).toBeVisible()

  // Фильтр: личные и группы — переписки, в «Каналах» их нет.
  const directRow = b.locator('[data-testid=chat-row]:not([data-group])')
  await expect(directRow).toHaveText(/alice_e2e/)
  await b.getByRole('radio', { name: /Каналы/ }).click()
  await expect(directRow).toHaveCount(0)
  await expect(clubRow).toHaveCount(0)
  await b.getByRole('radio', { name: 'Переписки' }).click()
  await expect(clubRow).toBeVisible()
  await expect(directRow).toHaveCount(1)
  await b.getByRole('radio', { name: 'Все' }).click()

  // --- Открытая группа: шапка и окно участников ---
  await clubRow.click()
  const title = b.getByRole('button', { name: 'Участники и настройки группы: Книжный клуб' })
  await expect(title).toBeVisible({ timeout: 60_000 })
  // Вступил — состав полный.
  // Синк принёс вступление: состояние комнаты полное, а не от приглашения.
  await expect
    .poll(async () => (await roomState(b, club)).membership, { timeout: 30_000 })
    .toBe('join')
  await expect(title).toContainText('3 участника', { timeout: 60_000 })
  await expect(b.getByPlaceholder('Поиск в переписке…')).toBeVisible({ timeout: 60_000 })
  // ⊘ рядом с поиском скрыл бы случайного участника — в группе его нет.
  await expect(b.getByRole('button', { name: 'Скрыть сообщения' })).toHaveCount(0)

  // В списке: мозаика из двух других участников и кто написал последним.
  await b.keyboard.press('Escape')
  await expect(clubRow.getByLabel('Группа · 3 участника')).toBeVisible({ timeout: 30_000 })
  await expect(clubRow.getByRole('img', { name: 'Книжный клуб' })).toHaveClass(/\bn2\b/)
  await expect(clubRow).toContainText('alice_e2e:', { timeout: 60_000 })
  await clubRow.click()
  await expect(title).toBeVisible({ timeout: 60_000 })

  await title.click()
  const modal = b.getByRole('dialog', { name: 'О группе' })
  await expect(modal).toBeVisible()
  await expect(modal.getByText('Читаем по главе')).toBeVisible()
  const rows = modal.getByTestId('group-members').locator(':scope > div')
  await expect(rows).toHaveCount(3, { timeout: 30_000 })
  await expect(rows.nth(0)).toContainText('alice_e2e')
  await expect(rows.nth(0)).toContainText('админ')
  await expect(rows.nth(1)).toContainText('bob_e2e')
  await expect(rows.nth(1)).toContainText('Вы')
  await expect(rows.nth(1)).toContainText('модератор')
  await expect(rows.nth(2)).toContainText('carolina_e2e')
  await expect(rows.nth(2)).toContainText('приглашение не принято')

  // «Без звука» — правило уведомлений на сервере.
  await modal.getByTestId('group-mute').click()
  await expect(modal.getByTestId('group-mute')).toContainText('Включить уведомления')
  await expect.poll(async () => (await roomState(b, club)).muted, { timeout: 30_000 }).toBe(true)

  // Escape закрывает окно группы, а не чат.
  await b.keyboard.press('Escape')
  await expect(modal).toBeHidden()
  await expect(b.getByPlaceholder('Введите сообщение...')).toBeVisible()
  await b.keyboard.press('Escape')
  await expect(clubRow.getByLabel('Уведомления выключены')).toBeVisible()

  // Новое сообщение в группе без звука: счётчика сервер не даёт — видна точка.
  await send(a, 'Вторая глава тоже')
  await expect(clubRow.getByLabel('Есть новые сообщения')).toBeVisible({ timeout: 60_000 })

  // После перезапуска правило приходит с сервера.
  await b.reload()
  await matrixReady(b)
  await openMessengerList(b)
  await expect(clubRow.getByLabel('Уведомления выключены')).toBeVisible({ timeout: 60_000 })

  // --- Участники из меню «…» в списке: написать лично ---
  await clubRow.hover()
  await clubRow.locator('.dots-btn').click()
  await b.getByText('Участники', { exact: true }).click()
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: 'Написать лично: carolina_e2e' }).click()
  await expect(modal).toBeHidden()
  // Личного чата с ней ещё нет — карточка собеседника с «Начать чат».
  // (первая «Начать чат» — в профиле Алисы под окном).
  await expect(b.getByRole('button', { name: 'Начать чат' }).last()).toBeVisible({
    timeout: 60_000,
  })
  await expect(b.getByText('carolina_e2e').first()).toBeVisible()

  // --- Скрыть сообщения участника ---
  await b.keyboard.press('Escape')
  await openMessengerList(b)
  await clubRow.hover()
  await clubRow.locator('.dots-btn').click()
  await b.getByText('Участники', { exact: true }).click()
  await modal.getByRole('button', { name: 'Скрыть сообщения: alice_e2e' }).click()
  await b.locator('.ant-popover').getByRole('button', { name: 'Скрыть сообщения' }).click()
  await expect(modal.getByRole('button', { name: 'Показать сообщения: alice_e2e' })).toBeVisible()
  await expect.poll(async () => (await roomState(b, club)).ignored).toContain(ALICE)

  // --- Выйти из группы ---
  await modal.getByTestId('group-leave').click()
  await b.locator('.ant-popover').getByRole('button', { name: 'Покинуть группу' }).click()
  await expect(modal).toBeHidden()
  await expect(clubRow).toHaveCount(0, { timeout: 30_000 })
  // На сервере Боб вышел; комната забыта.
  await expect.poll(async () => (await roomState(b, club)).membership).not.toBe('join')
})
