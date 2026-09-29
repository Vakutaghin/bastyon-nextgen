import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { FakeAir, FakeCompanion } from '../src/mesh/meshcore/testing/fake-companion'
import {
  APP_TO_RADIO,
  encodeStreamFrame,
  RADIO_TO_APP,
  StreamDeframer,
} from '../src/mesh/meshcore/framing'
import { PUBLIC_CHANNEL_SECRET } from '../src/mesh/meshcore/constants'
import { MeshCoreSession, type SessionMessage } from '../src/mesh/meshcore/session'
import {
  encodeStreamPacket,
  StreamDeframer as PacketDeframer,
} from '../src/mesh/meshtastic/framing'
import { MeshtasticSession, type MtIncoming } from '../src/mesh/meshtastic/session'
import { FakeMeshAir, FakeMeshtasticDevice } from '../src/mesh/meshtastic/testing/fake-device'

/**
 * Переписка через mesh-радио в интерфейсе: страница «Mesh-сети», подключение
 * радио по USB, узлы и контакты, личный чат с подтверждением доставки и
 * ответом, канал. Для Meshtastic — ещё первичная настройка региона с
 * перезагрузкой радио, ответ и реакция собеседника.
 *
 * Радио поддельные (testing в src/mesh/meshcore и meshtastic) и живут в процессе теста; команды
 * `radio_*` приложения приходят к ним через подменённый `__TAURI_INTERNALS__`.
 * Подмена ставится ПОСЛЕ входа: при ней все запросы приложения пошли бы через
 * плагин http Tauri, а вход идёт через подменную ноду в браузере. Второе
 * радио («Боб») управляется из теста.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const PORT = {
  path: '/dev/cu.usbserial-0001',
  kind: 'usb',
  vid: 0x10c4,
  pid: 0xea60,
  manufacturer: 'Silicon Labs',
  product: 'CP2102 USB to UART',
  serialNumber: '0001',
}

const DATA: MockNodeData = { profiles: [], posts: [], comments: [] }

/** Поток байтов до поддельного радио: то, что видит порт USB. */
interface FakePort {
  /** Байты от приложения (кадры протокола). */
  write(bytes: Uint8Array): void
  /** Байты от радио — приложению. Возвращает отписку. */
  onBytes(cb: (bytes: Uint8Array) => void): () => void
  /** Радио пропало само (перезагрузка, кабель). */
  onClose(cb: (reason: string) => void): void
  close(): void
}

/** Порт радио MeshCore: кадры `<`/`>`. */
function meshcorePort(radio: FakeCompanion): FakePort {
  const deframer = new StreamDeframer(APP_TO_RADIO)
  let stop: () => void = () => {}
  return {
    write(bytes) {
      for (const frame of deframer.push(bytes)) void radio.receiveCommand(frame)
    },
    onBytes(cb) {
      stop = radio.onFrameToApp((frame) => cb(encodeStreamFrame(frame, RADIO_TO_APP)))
      return stop
    },
    onClose() {},
    close: () => stop(),
  }
}

/** Порт радио Meshtastic: пакеты `0x94 0xC3`. */
function meshtasticPort(radio: FakeMeshtasticDevice): FakePort {
  const link = radio.connect('usb')
  const deframer = new PacketDeframer()
  return {
    write(bytes) {
      for (const packet of deframer.push(bytes).packets) void link.send(packet)
    },
    onBytes(cb) {
      return link.onPacket((packet) => cb(encodeStreamPacket(packet)))
    },
    onClose(cb) {
      link.onClose((reason) => cb(reason ?? 'device_lost'))
    },
    close: () => void link.close(),
  }
}

/** Команды радио из страницы — к поддельному радио Алисы. */
class RadioBridge {
  private next = 1
  private readonly links = new Map<number, FakePort>()

  constructor(
    private readonly page: Page,
    private readonly openPort: () => FakePort
  ) {}

  private deliver(channel: number, index: number, message: unknown): void {
    void this.page
      .evaluate(([c, i, m]) => window.__meshDeliver?.(c as number, i as number, m), [
        channel,
        index,
        message,
      ] as const)
      .catch(() => {})
  }

  async invoke(
    cmd: string,
    args: Record<string, unknown>
  ): Promise<{ value?: unknown; error?: string }> {
    switch (cmd) {
      case 'radio_serial_ports':
        return { value: [PORT] }
      case 'radio_serial_open': {
        if (args.path !== PORT.path) return { error: `port_not_found: ${String(args.path)}` }
        const id = this.next++
        const channel = (args.onEvent as { __channel: number }).__channel
        let index = 0
        const port = this.openPort()
        port.onBytes((bytes) =>
          this.deliver(channel, index++, { kind: 'data', bytes: Array.from(bytes) })
        )
        port.onClose((reason) => {
          this.links.delete(id)
          this.deliver(channel, index++, { kind: 'closed', reason })
        })
        this.links.set(id, port)
        return { value: id }
      }
      case 'radio_write': {
        const port = this.links.get(args.link as number)
        if (!port) return { error: 'link_not_found: closed' }
        port.write(Uint8Array.from(args.data as number[]))
        return { value: null }
      }
      case 'radio_close': {
        this.links.get(args.link as number)?.close()
        this.links.delete(args.link as number)
        return { value: null }
      }
      default:
        return { error: `not_mocked: ${cmd}` }
    }
  }
}

declare global {
  interface Window {
    __meshBridge?: (cmd: string, args: string) => Promise<{ value?: unknown; error?: string }>
    __meshDeliver?: (channel: number, index: number, message: unknown) => void
  }
}

/** Кто отвечает на команды Tauri: поддельное радио или узел Reticulum. */
interface Bridge {
  invoke(cmd: string, args: Record<string, unknown>): Promise<{ value?: unknown; error?: string }>
}

/**
 * Узел Reticulum вместо `rns_*` (src-tauri/src/rns): стек заменён, логика
 * страницы, сторов и мессенджера — настоящая. События — из теста.
 */
class RnsBridge implements Bridge {
  static readonly ADDRESS = 'a1'.repeat(16)
  private channel: number | null = null
  private index = 0
  private nextId = 1
  readonly sent: Array<{
    id: string
    to: string
    content: string
    attachments?: Array<{ kind: string; name: string; data: string }>
  }> = []
  /** Страницы узла NomadNet: путь → micron; запросы — с данными форм. */
  readonly pages: Record<string, (data: Record<string, string>) => string> = {}
  readonly pageRequests: Array<{ node: string; path: string; data: Record<string, string> }> = []
  /** Открытые бумажные сообщения (ссылки lxm://). */
  readonly ingested: string[] = []

  constructor(private readonly page: Page) {}

  emit(event: Record<string, unknown>): void {
    if (this.channel === null) return
    const [c, i] = [this.channel, this.index++]
    void this.page
      .evaluate(([ch, ix, m]) => window.__meshDeliver?.(ch as number, ix as number, m), [
        c,
        i,
        event,
      ] as const)
      .catch(() => {})
  }

  async invoke(
    cmd: string,
    args: Record<string, unknown>
  ): Promise<{ value?: unknown; error?: string }> {
    switch (cmd) {
      case 'rns_start':
        this.channel = (args.onEvent as { __channel: number }).__channel
        return { value: { address: RnsBridge.ADDRESS, identityHash: 'b2'.repeat(16) } }
      case 'rns_status':
        return {
          value: {
            running: true,
            interfaces: [{ name: 'LAN', kind: 'auto', online: true, rxBytes: 0, txBytes: 0 }],
            paths: 1,
            propagationNode: null,
          },
        }
      case 'rns_send': {
        const id = `lxm-${this.nextId++}`
        this.sent.push({
          id,
          to: args.to as string,
          content: args.content as string,
          attachments: args.attachments as Array<{ kind: string; name: string; data: string }>,
        })
        return { value: { id } }
      }
      case 'rns_page': {
        const request = {
          node: args.node as string,
          path: args.path as string,
          data: args.data as Record<string, string>,
        }
        this.pageRequests.push(request)
        const page = this.pages[request.path]
        return page
          ? { value: { content: page(request.data), binary: false } }
          : { error: 'rns_timeout' }
      }
      case 'rns_paper':
        return {
          value: { uri: `lxm://${Buffer.from(args.content as string).toString('base64url')}` },
        }
      case 'rns_ingest':
        this.ingested.push(args.uri as string)
        return { value: null }
      case 'rns_stop':
      case 'rns_announce':
      case 'rns_set_propagation_node':
      case 'rns_sync':
        return { value: null }
      default:
        return { error: `not_mocked: ${cmd}` }
    }
  }
}

/** Подменить Tauri: команды — в тест, Channel — через transformCallback. */
async function installTauriMock(page: Page, bridge: Bridge): Promise<void> {
  await page.exposeFunction('__meshBridge', (cmd: string, args: string) =>
    bridge.invoke(cmd, JSON.parse(args) as Record<string, unknown>)
  )
  await page.evaluate(() => {
    const callbacks = new Map<number, (message: unknown) => void>()
    let next = 1
    const internals = {
      transformCallback(cb: (message: unknown) => void) {
        const id = next++
        callbacks.set(id, cb)
        return id
      },
      unregisterCallback(id: number) {
        callbacks.delete(id)
      },
      async invoke(cmd: string, args: Record<string, unknown> = {}) {
        const plain: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(args)) {
          const isChannel =
            !!value && typeof value === 'object' && 'id' in value && 'onmessage' in value
          plain[key] = isChannel ? { __channel: (value as { id: number }).id } : value
        }
        const result = await window.__meshBridge!(cmd, JSON.stringify(plain))
        // Команды Tauri отказывают строкой «код: подробности».
        if (result.error) throw result.error
        return result.value
      },
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    }
    Object.assign(window, { __TAURI_INTERNALS__: internals })
    window.__meshDeliver = (channel, index, message) => callbacks.get(channel)?.({ index, message })
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

test('mesh: connect a radio, chat with a node and write to a channel', async ({ page }) => {
  test.setTimeout(120_000)
  const air = new FakeAir()
  const channels = [{ name: 'Public', secret: PUBLIC_CHANNEL_SECRET }]
  const alice = new FakeCompanion(air, { name: 'Alice', channels })
  const bob = new FakeCompanion(air, { name: 'Bob', channels })
  FakeCompanion.introduce(alice, bob)
  const bobSession = await MeshCoreSession.open(bob.connect(), { pollIntervalMs: 0 })
  const bobInbox: SessionMessage[] = []
  bobSession.on('message', (m) => bobInbox.push(m))

  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  // Чистый профиль — первый запуск: «Что нового» перекрывает страницу.
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await signIn(page)
  await installTauriMock(page, new RadioBridge(page, () => meshcorePort(alice)))
  await goTo(page, '/mesh?net=meshcore')

  // Страница: радио не подключено, порт USB в списке.
  await expect(page.getByRole('heading', { name: 'Mesh-сети', level: 1 })).toBeVisible()
  await expect(page.getByText('Не подключено')).toBeVisible()
  const portRow = page.getByRole('listitem').filter({ hasText: 'CP2102 USB to UART' })
  await portRow.getByRole('button', { name: 'Подключить' }).click()

  // Подключено: узел, контакт Боб, канал Public.
  await expect(page.getByText('Подключено · Silicon Labs CP2102 USB to UART')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Alice' })).toBeVisible()
  const bobRow = page.getByRole('listitem').filter({ hasText: 'Bob' })
  await expect(bobRow).toContainText('собеседник')
  await expect(page.getByRole('listitem').filter({ hasText: 'Public' })).toContainText(
    'открытый — читают все'
  )

  // Личный чат: сообщение уходит по радио, радио Боба подтверждает.
  await bobRow.getByRole('button', { name: 'Написать' }).click()
  await expect(page.getByText('шифрование на радио, не в приложении')).toBeVisible()
  const input = page.getByPlaceholder('Сообщение по радио')
  await input.fill('Привет из Bastyon')
  await expect(page.getByText('25 / 160 байт')).toBeVisible()
  await input.press('Enter')
  await expect(page.getByText('Привет из Bastyon')).toBeVisible()
  await expect(page.getByTitle('Радио собеседника подтвердило получение')).toBeVisible()
  await expect.poll(() => bobInbox.map((m) => m.text)).toEqual(['Привет из Bastyon'])
  expect(bobInbox[0]).toMatchObject({ kind: 'direct', senderName: 'Alice' })

  // Ответ Боба приходит в открытый чат.
  await bobSession.sendDirect(
    alice.publicKey,
    'Привет, это Боб',
    Math.floor(Date.now() / 1000),
    () => {}
  )
  await expect(page.getByText('Привет, это Боб')).toBeVisible()

  // Канал Public: предупреждение об открытости и отправка.
  await goTo(page, '/mesh')
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Public' })
    .getByRole('button', { name: 'Открыть' })
    .click()
  await expect(page.getByText('открытый канал — читают все').first()).toBeVisible()
  await page.getByPlaceholder('Сообщение по радио').fill('Всем привет')
  await page.getByPlaceholder('Сообщение по радио').press('Enter')
  await expect
    .poll(() => bobInbox.filter((m) => m.kind === 'channel').map((m) => m.text))
    .toEqual(['Всем привет'])
  expect(bobInbox.find((m) => m.kind === 'channel')).toMatchObject({ senderName: 'Alice' })

  await bobSession.close()
})

test('meshtastic: set up a new radio, chat with a node, get a reply and a reaction', async ({
  page,
}) => {
  test.setTimeout(150_000)
  const air = new FakeMeshAir()
  // Новое радио Алисы: регион не выбран — оно молчит, пока его не зададут.
  const alice = new FakeMeshtasticDevice(air, { longName: 'Alice', region: 0 })
  const bob = new FakeMeshtasticDevice(air, { longName: 'Bob' })
  alice.learn(bob)
  bob.learn(alice)
  const bobSession = MeshtasticSession.create(bob.connect('bob'), { textSpacingMs: 0 })
  const bobInbox: MtIncoming[] = []
  bobSession.on('message', (m) => bobInbox.push(m))
  await bobSession.start()

  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await signIn(page)
  await installTauriMock(page, new RadioBridge(page, () => meshtasticPort(alice)))
  await goTo(page, '/mesh')

  // Вкладка Meshtastic открыта по умолчанию.
  await expect(page.getByRole('tab', { name: 'Meshtastic' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  const portRow = page.getByRole('listitem').filter({ hasText: 'CP2102 USB to UART' })
  await portRow.getByRole('button', { name: 'Подключить' }).click()

  // Регион не выбран: предупреждение, выбор региона, перезагрузка и снова на связи.
  await expect(page.getByRole('heading', { name: 'Alice' })).toBeVisible()
  await expect(page.getByText('Регион не выбран — радио ничего не передаёт')).toBeVisible()
  await page.getByLabel('Регион').selectOption({ label: 'Россия (868 МГц)' })
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(page.getByText('Регион не выбран — радио ничего не передаёт')).toBeHidden({
    timeout: 20_000,
  })
  await expect(page.getByText(/^Подключено · /)).toBeVisible({ timeout: 20_000 })
  expect(alice.reboots).toBe(1)
  expect(alice.lora.region).toBe(9)

  // Узел Боб и основной канал.
  const bobRow = page.getByRole('listitem').filter({ hasText: 'Bob' })
  await expect(bobRow).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'LongFast' })).toContainText(
    'открытый — ключ известен всем'
  )

  // Личный чат: шифрование ключами узлов, подтверждение от радио Боба.
  await bobRow.getByRole('button', { name: 'Написать' }).click()
  await expect(page.getByText('шифрование ключами узлов на радио, не в приложении')).toBeVisible()
  const input = page.getByPlaceholder('Сообщение по радио')
  await input.fill('Привет по Meshtastic')
  await expect(page.getByText('28 / 200 байт')).toBeVisible()
  await input.press('Enter')
  await expect(page.getByTitle('Радио собеседника подтвердило получение')).toBeVisible()
  await expect.poll(() => bobInbox.map((m) => m.text)).toEqual(['Привет по Meshtastic'])
  expect(bobInbox[0]).toMatchObject({ kind: 'direct', pki: true })

  // Боб отвечает на сообщение и ставит реакцию — всё по радио.
  const question = bobInbox[0]!.packetId
  await bobSession.sendText({ kind: 'direct', num: alice.nodeNum }, 'Слышу тебя', () => {}, {
    replyId: question,
  })
  await bobSession.sendText({ kind: 'direct', num: alice.nodeNum }, '👍', () => {}, {
    replyId: question,
    emoji: true,
  })
  await expect(page.getByText('Слышу тебя')).toBeVisible()
  await expect(page.getByText('👍')).toBeVisible()

  // Канал LongFast: ретрансляцию видно отметкой.
  await goTo(page, '/mesh')
  await page
    .getByRole('listitem')
    .filter({ hasText: 'LongFast' })
    .getByRole('button', { name: 'Открыть' })
    .click()
  await expect(page.getByText('открытый канал — читают все').first()).toBeVisible()
  await page.getByPlaceholder('Сообщение по радио').fill('Всем привет')
  await page.getByPlaceholder('Сообщение по радио').press('Enter')
  await expect
    .poll(() => bobInbox.filter((m) => m.kind === 'channel').map((m) => m.text))
    .toEqual(['Всем привет'])
  await expect(page.getByTitle('Сообщение услышали и передали дальше')).toBeVisible()

  await bobSession.close()
})

test.describe('reticulum', () => {
  // Свой узел есть в десктопе на macOS и Linux; профиль «Desktop Chrome» —
  // это Windows, где узла нет.
  test.use({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  })

  test('start the node, meet a contact over LXMF, write and get an answer', async ({ page }) => {
    test.setTimeout(120_000)
    await useMockNode(page, DATA)
    await page.goto('/')
    await page.waitForSelector('#app > *', { timeout: 30_000 })
    await page
      .getByRole('button', { name: 'Понятно' })
      .click({ timeout: 5_000 })
      .catch(() => {})
    await signIn(page)
    const rns = new RnsBridge(page)
    await installTauriMock(page, rns)
    await goTo(page, '/mesh?net=reticulum')

    // Свой узел: адрес для собеседников.
    await expect(page.getByRole('tab', { name: 'Reticulum' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await page.getByRole('button', { name: 'Запустить' }).click()
    await expect(page.getByText(RnsBridge.ADDRESS)).toBeVisible()
    await expect(page.getByText('на связи 1 из 1')).toBeVisible()

    // Боб объявился в сети — он в собеседниках.
    const BOB = 'c3'.repeat(16)
    rns.emit({
      kind: 'announce',
      aspect: 'lxmf.delivery',
      dest: BOB,
      identity: 'd4'.repeat(16),
      name: 'Боб',
      hops: 1,
    })
    const bobRow = page.getByRole('listitem').filter({ hasText: 'Боб' })
    await expect(bobRow).toContainText('1 хоп')

    // Чат: сквозное шифрование, отправка и подтверждение.
    await bobRow.getByRole('button', { name: 'Написать' }).click()
    await expect(page.getByText('сквозное шифрование Reticulum: ключи в приложении')).toBeVisible()
    const input = page.getByPlaceholder('Сообщение по радио')
    await input.fill('Привет по Reticulum')
    await input.press('Enter')
    await expect
      .poll(() => rns.sent.map((m) => [m.to, m.content]))
      .toEqual([[BOB, 'Привет по Reticulum']])
    rns.emit({ kind: 'state', id: rns.sent[0]!.id, state: 'delivered' })
    await expect(page.getByTitle('Устройство собеседника подтвердило получение')).toBeVisible()

    // Ответ Боба приходит в тот же чат.
    rns.emit({
      kind: 'message',
      id: 'from-bob-1',
      from: BOB,
      title: '',
      content: 'Слышу тебя через Reticulum',
      timestamp: 1_790_000_000,
      signed: true,
      method: 'direct',
    })
    await expect(page.getByText('Слышу тебя через Reticulum')).toBeVisible()
  })

  test('pictures and files over LXMF', async ({ page }) => {
    test.setTimeout(120_000)
    await useMockNode(page, DATA)
    await page.goto('/')
    await page.waitForSelector('#app > *', { timeout: 30_000 })
    await page
      .getByRole('button', { name: 'Понятно' })
      .click({ timeout: 5_000 })
      .catch(() => {})
    await signIn(page)
    const rns = new RnsBridge(page)
    await installTauriMock(page, rns)
    await goTo(page, '/mesh?net=reticulum')
    await page.getByRole('button', { name: 'Запустить' }).click()
    await expect(page.getByText(RnsBridge.ADDRESS)).toBeVisible()

    const BOB = 'c3'.repeat(16)
    rns.emit({
      kind: 'announce',
      aspect: 'lxmf.delivery',
      dest: BOB,
      identity: 'd4'.repeat(16),
      name: 'Боб',
      hops: 1,
    })
    const bobRow = page.getByRole('listitem').filter({ hasText: 'Боб' })
    await bobRow.getByRole('button', { name: 'Написать' }).click()

    // Картинка и файл от Боба (как шлёт Sideband): картинка видна в чате.
    const PIXEL =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    rns.emit({
      kind: 'message',
      id: 'from-bob-img',
      from: BOB,
      title: '',
      content: 'Вид из окна',
      timestamp: 1_790_000_000,
      signed: true,
      method: 'direct',
      attachments: [
        { kind: 'image', name: 'image.png', mime: 'image/png', data: PIXEL },
        { kind: 'file', name: 'route.gpx', mime: 'application/octet-stream', data: 'PGdweC8+' },
      ],
    })
    await expect(page.getByText('Вид из окна')).toBeVisible()
    await expect(page.locator('img[alt="image.png"]')).toHaveAttribute('src', /^blob:/)
    await expect(page.getByText('route.gpx')).toBeVisible()

    // Свой файл: через «Прикрепить», текст из поля — подписью.
    await page.getByPlaceholder('Сообщение по радио').fill('Держи план')
    await page
      .locator('input[type="file"]:not([accept])')
      .setInputFiles({ name: 'plan.txt', mimeType: 'text/plain', buffer: Buffer.from('plan') })
    await expect
      .poll(() =>
        rns.sent.map((m) => [m.content, m.attachments?.map((a) => [a.kind, a.name, a.data])])
      )
      .toEqual([['Держи план', [['file', 'plan.txt', 'cGxhbg==']]]])
    await expect(page.getByText('plan.txt')).toBeVisible()

    // Бумажное сообщение: текст из поля — в QR-код и ссылку lxm://.
    await page.getByPlaceholder('Сообщение по радио').fill('На бумаге')
    await page.getByRole('button', { name: 'Бумажное сообщение (QR-код)' }).click()
    const paper = page.getByRole('dialog', { name: 'Бумажное сообщение' })
    await expect(paper.locator('img')).toHaveAttribute('src', /^data:image\/png/)
    await expect(paper).toContainText(`lxm://${Buffer.from('На бумаге').toString('base64url')}`)
    await paper.getByRole('button', { name: 'Готово' }).click()
    await expect(paper).toBeHidden()
  })

  test('open a paper message by its link', async ({ page }) => {
    test.setTimeout(120_000)
    await useMockNode(page, DATA)
    await page.goto('/')
    await page.waitForSelector('#app > *', { timeout: 30_000 })
    await page
      .getByRole('button', { name: 'Понятно' })
      .click({ timeout: 5_000 })
      .catch(() => {})
    await signIn(page)
    const rns = new RnsBridge(page)
    await installTauriMock(page, rns)
    await goTo(page, '/mesh?net=reticulum')
    await page.getByRole('button', { name: 'Запустить' }).click()
    await expect(page.getByText(RnsBridge.ADDRESS)).toBeVisible()

    const link = page.getByPlaceholder('lxm://…')
    await link.fill('lxm://QbtgND2PxKlhqJt8Zm3Od8Ym')
    await link.locator('xpath=ancestor::form').getByRole('button', { name: 'Открыть' }).click()
    await expect.poll(() => rns.ingested).toEqual(['lxm://QbtgND2PxKlhqJt8Zm3Od8Ym'])
    await expect(page.getByText('Сообщение открыто — оно в чатах.')).toBeVisible()
  })

  test('browse a NomadNet node: pages, links, a form, back', async ({ page }) => {
    test.setTimeout(120_000)
    await useMockNode(page, DATA)
    await page.goto('/')
    await page.waitForSelector('#app > *', { timeout: 30_000 })
    await page
      .getByRole('button', { name: 'Понятно' })
      .click({ timeout: 5_000 })
      .catch(() => {})
    await signIn(page)
    const rns = new RnsBridge(page)
    rns.pages['/page/index.mu'] = () =>
      '>Доска объявлений\n`!Привет`! из `Ff00NomadNet`f\n-\n`[Правила`:/page/rules.mu]\nИмя: `<name`Гость>\n`[Отправить`:/page/hello.mu`name|lang=ru]'
    rns.pages['/page/rules.mu'] = () => '>>Правила\nБудьте вежливы.'
    rns.pages['/page/hello.mu'] = (data) => `Здравствуйте, ${data.field_name} (${data.var_lang})!`
    await installTauriMock(page, rns)
    await goTo(page, '/mesh?net=reticulum')
    await page.getByRole('button', { name: 'Запустить' }).click()
    await expect(page.getByText(RnsBridge.ADDRESS)).toBeVisible()

    const NODE = 'e5'.repeat(16)
    rns.emit({
      kind: 'announce',
      aspect: 'nomadnetwork.node',
      dest: NODE,
      identity: 'f6'.repeat(16),
      name: 'Доска района',
      hops: 2,
    })
    const nodeRow = page.getByRole('listitem').filter({ hasText: 'Доска района' })
    await nodeRow.getByRole('button', { name: 'Открыть' }).click()
    await expect(page.getByText('Доска объявлений')).toBeVisible()
    await expect(page.getByText('Привет', { exact: true })).toHaveCSS('font-weight', '700')
    await expect(page.getByText('NomadNet', { exact: true })).toHaveCSS('color', 'rgb(255, 0, 0)')
    expect(rns.pageRequests[0]).toEqual({ node: NODE, path: '/page/index.mu', data: {} })

    await page.getByRole('button', { name: 'Правила' }).click()
    await expect(page.getByText('Будьте вежливы.')).toBeVisible()
    await page.getByRole('button', { name: 'Назад' }).click()

    const name = page.getByRole('textbox', { name: 'name' })
    await expect(name).toHaveValue('Гость')
    await name.fill('Алиса')
    await page.getByRole('button', { name: 'Отправить' }).click()
    await expect(page.getByText('Здравствуйте, Алиса (ru)!')).toBeVisible()
    expect(rns.pageRequests[rns.pageRequests.length - 1]).toEqual({
      node: NODE,
      path: '/page/hello.mu',
      data: { field_name: 'Алиса', var_lang: 'ru' },
    })

    // Узел не ответил — ошибка вместо страницы.
    delete rns.pages['/page/hello.mu']
    await page.getByRole('button', { name: 'Обновить' }).click()
    await expect(page.getByText('Узел не ответил вовремя.')).toBeVisible()
  })
})
