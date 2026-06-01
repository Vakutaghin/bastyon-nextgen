import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { wsService } from './ws-service'
import type { WsMessage } from './ws-service'
import type { KeyPair } from '../types/keys'

// ---------------------------------------------------------------------------
// Fake WebSocket — управляемая вручную замена сокета. Сервис получает её
// конструктор через pickWebSocketCtor() (см. мок ниже), поэтому реального
// сетевого соединения не происходит. Тестовые помощники (_open/_message/...)
// имитируют события сервера.
//
// Числовые readyState совпадают со стандартом WebSocket (CONNECTING=0, OPEN=1,
// CLOSING=2, CLOSED=3) — сервис сравнивает с глобальными WebSocket.OPEN и т.п.
// ---------------------------------------------------------------------------

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  static instances: FakeWebSocket[] = []

  url: string
  readyState = 0
  sent: string[] = []
  closeCalls = 0

  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: ((ev: { code?: number; reason?: string }) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closeCalls++
    this.readyState = FakeWebSocket.CLOSED
  }

  // --- Тестовые триггеры событий ---
  _open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  _message(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }

  _serverClose(code = 1006, reason = '') {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code, reason })
  }

  _error() {
    this.onerror?.({})
  }
}

// ---------------------------------------------------------------------------
// Моки зависимостей
// ---------------------------------------------------------------------------

const { _pickWebSocketCtor, _generateApiSignature, mockAuth } = vi.hoisted(() => ({
  _pickWebSocketCtor: vi.fn(),
  _generateApiSignature: vi.fn(),
  mockAuth: {
    getKeyPair: null as unknown,
    getUserAddress: null as unknown,
  },
}))

vi.mock('@/helpers/tor/tor-websocket', () => ({
  pickWebSocketCtor: _pickWebSocketCtor,
}))

vi.mock('@/helpers/common/debug-log', () => ({
  debugLog: vi.fn(),
}))

vi.mock('@/blockchain/core/signatures', () => ({
  generateApiSignature: _generateApiSignature,
}))

vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => mockAuth,
}))

const FAKE_SIGNATURE = { nonce: 'n', signature: 'sig', pubkey: 'pub', address: 'addr', v: 1 }
const ADDRESS = 'PUserAddress123'
// Минимальный мок: generateApiSignature замокан, поэтому полная форма KeyPair не нужна.
const KEY_PAIR = { ecPair: {} } as unknown as KeyPair

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Поднимает сервис до открытого состояния и возвращает активный сокет. */
async function openConnection(): Promise<FakeWebSocket> {
  await wsService.connect()
  const ws = FakeWebSocket.instances.at(-1)!
  ws._open()
  await flush() // ждём asynchronous authorize() (динамический импорт + подписка)
  return ws
}

describe('PocketnetWsService', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    FakeWebSocket.instances = []
    _pickWebSocketCtor.mockReset().mockResolvedValue(FakeWebSocket)
    _generateApiSignature.mockReset().mockReturnValue(FAKE_SIGNATURE)
    mockAuth.getKeyPair = null
    mockAuth.getUserAddress = null
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    wsService.destroy()
    vi.useRealTimers()
    warnSpy.mockRestore()
    errSpy.mockRestore()
  })

  describe('connect', () => {
    it('открывает сокет по wss-URL из конфигурации прокси', async () => {
      await wsService.connect()

      expect(FakeWebSocket.instances).toHaveLength(1)
      expect(FakeWebSocket.instances[0].url).toBe('wss://1.pocketnet.app:8099')
    })

    it('по событию open выставляет isConnected и эмитит "open"', async () => {
      const onOpen = vi.fn()
      wsService.on('open', onOpen)

      await openConnection()

      expect(wsService.isConnected).toBe(true)
      expect(onOpen).toHaveBeenCalledTimes(1)
    })

    it('не создаёт второй сокет, если уже подключается/подключён', async () => {
      await wsService.connect()
      await wsService.connect()

      expect(FakeWebSocket.instances).toHaveLength(1)
    })
  })

  describe('авторизация при открытии', () => {
    it('подписывается на адрес пользователя при наличии ключей', async () => {
      mockAuth.getKeyPair = KEY_PAIR
      mockAuth.getUserAddress = ADDRESS

      const ws = await openConnection()

      expect(_generateApiSignature).toHaveBeenCalledWith(KEY_PAIR, ADDRESS)
      expect(ws.sent).toHaveLength(1)
      expect(JSON.parse(ws.sent[0])).toEqual({
        signature: FAKE_SIGNATURE,
        address: ADDRESS,
        block: 0,
      })
    })

    it('не отправляет подписку, если ключей ещё нет', async () => {
      mockAuth.getKeyPair = null
      mockAuth.getUserAddress = null

      const ws = await openConnection()

      expect(ws.sent).toHaveLength(0)
      expect(_generateApiSignature).not.toHaveBeenCalled()
    })
  })

  describe('subscribeAddress', () => {
    it('ставит подписку в очередь, пока сокет не открыт, и шлёт её после open', async () => {
      mockAuth.getKeyPair = KEY_PAIR
      mockAuth.getUserAddress = ADDRESS

      // Сокет ещё не открыт — подписка откладывается.
      await wsService.subscribeAddress('PendingAddr', KEY_PAIR)
      expect(FakeWebSocket.instances).toHaveLength(0)

      const ws = await openConnection()

      // После open: и адрес пользователя, и отложенный адрес.
      const sentAddrs = ws.sent.map((s) => JSON.parse(s).address)
      expect(sentAddrs).toContain(ADDRESS)
      expect(sentAddrs).toContain('PendingAddr')
    })

    it('не подписывается повторно на уже подтверждённый адрес', async () => {
      mockAuth.getKeyPair = KEY_PAIR
      const ws = await openConnection()

      // Сервер подтвердил подписку.
      ws._message({ mesType: 'registered', addr: ADDRESS })
      _generateApiSignature.mockClear()

      await wsService.subscribeAddress(ADDRESS, KEY_PAIR)

      expect(_generateApiSignature).not.toHaveBeenCalled()
    })

    it('логирует warn при попытке отправки в неоткрытый сокет', async () => {
      // Открыли, затем сокет «закрылся» → send упрётся в not-open.
      mockAuth.getKeyPair = KEY_PAIR
      const ws = await openConnection()
      ws.readyState = FakeWebSocket.CLOSED

      // Свежий адрес, минуя connected/in-flight guard'ы.
      await wsService.subscribeAddress('FreshAddr', KEY_PAIR)

      expect(warnSpy).toHaveBeenCalled()
    })
  })

  describe('обработка сообщений', () => {
    it('маршрутизирует "registered" и помечает адрес подключённым', async () => {
      const onReg = vi.fn()
      wsService.on('registered', onReg)
      const ws = await openConnection()

      ws._message({ mesType: 'registered', addr: ADDRESS })

      expect(onReg).toHaveBeenCalledTimes(1)
      expect(onReg.mock.calls[0][0]).toMatchObject({ addr: ADDRESS })
    })

    it('нормализует сообщение с vin/vout без msg в transaction', async () => {
      const onTx = vi.fn()
      wsService.on('transaction', onTx)
      const ws = await openConnection()

      ws._message({ vin: [{}], vout: [{}], txid: 'abc' })

      expect(onTx).toHaveBeenCalledTimes(1)
      const payload = onTx.mock.calls[0][0] as WsMessage
      expect(payload.msg).toBe('transaction')
      expect(payload.txid).toBe('abc')
    })

    it('переносит mesType в type для транзакции и удаляет mesType', async () => {
      const onTx = vi.fn()
      wsService.on('transaction', onTx)
      const ws = await openConnection()

      ws._message({ msg: 'transaction', mesType: 'share', txid: 'xyz' })

      const payload = onTx.mock.calls[0][0] as WsMessage
      expect(payload.type).toBe('share')
      expect(payload.mesType).toBeUndefined()
    })

    it('эмитит "block" по "new block"', async () => {
      const onBlock = vi.fn()
      wsService.on('block', onBlock)
      const ws = await openConnection()

      ws._message({ msg: 'new block', height: 42 })

      expect(onBlock).toHaveBeenCalledTimes(1)
      expect((onBlock.mock.calls[0][0] as WsMessage).height).toBe(42)
    })

    it('неизвестный тип уходит в "message"', async () => {
      const onMsg = vi.fn()
      wsService.on('message', onMsg)
      const ws = await openConnection()

      ws._message({ msg: 'something-else' })

      expect(onMsg).toHaveBeenCalledTimes(1)
    })

    it('игнорирует невалидный JSON без падения', async () => {
      const onMsg = vi.fn()
      wsService.on('message', onMsg)
      const ws = await openConnection()

      expect(() => ws.onmessage?.({ data: 'not-json{' })).not.toThrow()
      expect(onMsg).not.toHaveBeenCalled()
    })
  })

  describe('подписка на события (on/emit)', () => {
    it('возвращает функцию отписки', async () => {
      const handler = vi.fn()
      const off = wsService.on('block', handler)
      const ws = await openConnection()

      off()
      ws._message({ msg: 'new block' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('ошибка в одном обработчике не ломает остальные', async () => {
      const bad = vi.fn(() => {
        throw new Error('handler boom')
      })
      const good = vi.fn()
      wsService.on('block', bad)
      wsService.on('block', good)
      const ws = await openConnection()

      ws._message({ msg: 'new block' })

      expect(bad).toHaveBeenCalled()
      expect(good).toHaveBeenCalled()
    })
  })

  describe('reconnect', () => {
    it('по неожиданному закрытию планирует переподключение с задержкой', async () => {
      vi.useFakeTimers()
      await wsService.connect()
      const ws = FakeWebSocket.instances.at(-1)!
      ws._open()

      ws._serverClose()
      expect(wsService.isConnected).toBe(false)

      // Раньше базовой задержки (2000мс) переподключения нет.
      await vi.advanceTimersByTimeAsync(1999)
      expect(FakeWebSocket.instances).toHaveLength(1)

      // На 2000мс создаётся новый сокет.
      await vi.advanceTimersByTimeAsync(1)
      expect(FakeWebSocket.instances).toHaveLength(2)
    })

    it('idempotent: onerror + onclose из-за одной аварии дают один reconnect', async () => {
      vi.useFakeTimers()
      await wsService.connect()
      const ws = FakeWebSocket.instances.at(-1)!
      ws._open()

      ws._error()
      ws._serverClose()

      // Если бы reconnect зашедулился дважды (attempt=2 → 3000мс),
      // на 2000мс нового сокета бы не было. Проверяем, что он есть → attempt=1.
      await vi.advanceTimersByTimeAsync(2000)
      expect(FakeWebSocket.instances).toHaveLength(2)
    })

    it('форсит reconnect по таймауту подключения, если open не наступил', async () => {
      vi.useFakeTimers()
      await wsService.connect()
      const ws = FakeWebSocket.instances.at(-1)!
      // НЕ открываем — имитируем зависший SYN.

      await vi.advanceTimersByTimeAsync(10000) // CONNECT_TIMEOUT_MS
      expect(ws.closeCalls).toBeGreaterThan(0)

      // Open так и не наступил → reconnectAttempt не сбрасывался и каждый новый
      // (тоже не открывающийся) сокет вновь упирается в таймаут, запуская
      // следующий цикл. Нам важен сам факт переподключения, не их число.
      await vi.advanceTimersByTimeAsync(30000)
      expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(2)
    })

    it('close() запрещает дальнейшие переподключения', async () => {
      vi.useFakeTimers()
      await wsService.connect()
      const ws = FakeWebSocket.instances.at(-1)!
      ws._open()

      wsService.close()
      ws._serverClose()

      await vi.advanceTimersByTimeAsync(30000)
      expect(FakeWebSocket.instances).toHaveLength(1)
      expect(wsService.isConnected).toBe(false)
    })

    it('reconnect() закрывает текущий сокет и поднимает новый', async () => {
      const ws = await openConnection()

      wsService.reconnect()
      await flush()

      expect(ws.closeCalls).toBeGreaterThan(0)
      expect(FakeWebSocket.instances).toHaveLength(2)
    })
  })

  describe('создание сокета', () => {
    it('планирует reconnect, если конструктор сокета бросил', async () => {
      vi.useFakeTimers()
      _pickWebSocketCtor.mockResolvedValue(
        class {
          constructor() {
            throw new Error('ctor boom')
          }
        }
      )

      await wsService.connect()
      expect(errSpy).toHaveBeenCalled()

      // После аварии возвращаем рабочий конструктор и ждём backoff. Open не
      // наступает, поэтому возможны повторные циклы (см. таймаут-тест) — важен
      // факт, что после восстановления конструктора сокет создаётся.
      _pickWebSocketCtor.mockResolvedValue(FakeWebSocket)
      await vi.advanceTimersByTimeAsync(30000)
      expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(1)
    })
  })
})
