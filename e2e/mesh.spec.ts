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

/** Подменить Tauri: команды — в тест, Channel — через transformCallback. */
async function installTauriMock(page: Page, bridge: RadioBridge): Promise<void> {
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
