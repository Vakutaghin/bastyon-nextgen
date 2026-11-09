// Запуск моста мини-приложений целиком (bootMiniApps): сообщения из iframe
// проходят настоящие мост → реестр действий → разрешения → ответ в iframe.
// Замоканы только границы: окно разрешения (ant Modal), хост, список
// приложений, источники событий, сетевой fetch-туннель.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VNode } from 'vue'
import type { Router } from 'vue-router'
import type { HostContext } from '@/mini-apps/actions/host-context'
import type { InstalledApp } from '@/mini-apps/types/app'
import type { MiniAppsBridge } from '@/mini-apps/core/bridge'
import { FAKE_SIGNATURE, makeMockHost } from '@/mini-apps/actions/__test-helpers'

interface PromptConfig {
  title: string
  content: string | VNode
  onOk: () => void
  onCancel: () => void
}

const mocks = vi.hoisted(() => ({
  app: {
    manifest: { id: 'test.app', name: 'Test App', permissions: [] },
    scope: 'test.app.com',
    icon: '',
    source: 'built-in',
    installedAt: 0,
  },
  prompts: [] as Array<{ config: unknown; destroy: ReturnType<typeof vi.fn> }>,
  confirm: vi.fn(),
  host: null as unknown,
  createHost: vi.fn(),
  appsInit: vi.fn(),
  trackAppActions: vi.fn(),
  setupEventSources: vi.fn(),
  fetchHandle: vi.fn(),
  address: 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM',
}))

vi.mock('ant-design-vue', () => ({ Modal: { confirm: mocks.confirm } }))
vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}|${JSON.stringify(params)}` : key,
}))
vi.mock('@/mini-apps/actions/host-context', () => ({
  createDefaultHostContext: mocks.createHost,
}))
vi.mock('@/mini-apps/store/apps-store', async () => {
  const { createInMemoryResolver } = await import('@/mini-apps/core/origin-guard')
  const resolver = createInMemoryResolver([mocks.app as unknown as InstalledApp])
  return {
    useAppsStore: () => ({ init: mocks.appsInit, originResolver: resolver, installedCount: 1 }),
  }
})
vi.mock('@/mini-apps/events/sources', () => ({ setupEventSources: mocks.setupEventSources }))
vi.mock('@/mini-apps/tx/app-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/mini-apps/tx/app-actions')>()),
  trackAppActions: mocks.trackAppActions,
}))
vi.mock('@/mini-apps/core/fetch-tunnel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/mini-apps/core/fetch-tunnel')>()),
  createFetchTunnel: () => ({ handle: mocks.fetchHandle }),
}))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ address: mocks.address }),
}))
vi.mock('@/services/logger', () => {
  const silent = { debug() {}, info() {}, warn() {}, error() {} }
  return { logger: { ...silent, scope: () => silent } }
})

const APP = mocks.app as unknown as InstalledApp
const APP_ORIGIN = 'https://test.app.com'
const ROUTER = { name: 'router' } as unknown as Router

type BootModule = typeof import('./use-mini-app-bridge')

let bridge: MiniAppsBridge | null = null

/**
 * Свежие модули на каждый тест: у моста, реестра и `bootMiniApps` состояние
 * модульное (singleton, флаг `started`, открытые окна разрешений).
 */
async function prepare(): Promise<{ mod: BootModule; bridge: MiniAppsBridge }> {
  vi.resetModules()
  const { setActivePinia, createPinia } = await import('pinia')
  setActivePinia(createPinia())
  const { usePermissionsStore } = await import('@/mini-apps/store/permissions-store')
  const { createMemoryStore } = await import('@/mini-apps/storage/key-value-store')
  usePermissionsStore().configure({ kv: createMemoryStore() })
  const mod = await import('./use-mini-app-bridge')
  const core = await import('@/mini-apps/core/bridge')
  bridge = core.miniAppsBridge
  return { mod, bridge: core.miniAppsBridge }
}

/** Запущенный мост с привязанным окном iframe. */
async function bootWithFrame() {
  const { mod, bridge } = await prepare()
  await mod.bootMiniApps(ROUTER)
  const frame = makeFrame()
  bridge.attachFrame(APP.manifest.id, frame.win as unknown as MessageEventSource)
  return { mod, bridge, frame }
}

function makeFrame() {
  const sent: unknown[] = []
  return { sent, win: { postMessage: (message: unknown) => sent.push(message) } }
}

function fromFrame(source: object, data: unknown, origin = APP_ORIGIN): void {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin, source: source as MessageEventSource })
  )
}

/** Последнее открытое окно разрешения. */
function lastPrompt() {
  const p = mocks.prompts[mocks.prompts.length - 1]
  if (!p) throw new Error('окно разрешения не открывалось')
  return { config: p.config as PromptConfig, destroy: p.destroy }
}

const responseTo = (sent: unknown[], id: string) =>
  sent.find((m) => (m as { response?: string }).response === id) as
    | { response: string; data?: unknown; error?: { code?: string; message?: string } }
    | undefined

const host = () => mocks.host as HostContext

beforeEach(() => {
  mocks.prompts.length = 0
  mocks.confirm.mockReset().mockImplementation((config: unknown) => {
    const destroy = vi.fn()
    mocks.prompts.push({ config, destroy })
    return { destroy }
  })
  mocks.host = makeMockHost({ getUserBalance: vi.fn(async () => ({ actual: 7 })) })
  mocks.createHost.mockReset().mockImplementation(async () => mocks.host)
  mocks.appsInit.mockReset().mockResolvedValue(undefined)
  mocks.trackAppActions.mockReset().mockReturnValue(() => {})
  mocks.setupEventSources.mockReset()
  mocks.fetchHandle.mockReset()
  // Повторный импорт модулей после resetModules: Capacitor ругается на
  // повторную регистрацию плагинов — в тесте это шум.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  bridge?.stop()
  bridge = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('bootMiniApps: запуск', () => {
  it('поднимает хост и источники событий один раз; повторный вызов ничего не делает', async () => {
    const { mod } = await prepare()
    await mod.bootMiniApps(ROUTER)
    await mod.bootMiniApps(ROUTER)

    expect(mocks.appsInit).toHaveBeenCalledTimes(1)
    expect(mocks.createHost).toHaveBeenCalledTimes(1)
    expect(mocks.createHost).toHaveBeenCalledWith({ router: ROUTER })
    expect(mocks.setupEventSources).toHaveBeenCalledTimes(1)
    expect(mocks.setupEventSources).toHaveBeenCalledWith({ router: ROUTER })
    expect(mocks.trackAppActions).toHaveBeenCalledTimes(1)
  })
})

describe('bootMiniApps: запросы мини-приложения', () => {
  it('без разрешения спрашивает пользователя; отказ — permission_denied, адрес не выдаётся', async () => {
    const { frame } = await bootWithFrame()
    fromFrame(frame.win, { id: 'r1', action: 'account' })

    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1))
    const { config } = lastPrompt()
    expect(config.title).toBe(
      'appMsg.permission.promptTitle|{"app":"Test App","name":"appMsg.permission.account.name"}'
    )
    expect(config.content).toBe('appMsg.permission.account.description')

    config.onCancel()
    await vi.waitFor(() => expect(responseTo(frame.sent, 'r1')).toBeDefined())
    expect(responseTo(frame.sent, 'r1')?.error).toMatchObject({ code: 'permission_denied' })
    expect(host().signApiMessage).not.toHaveBeenCalled()

    // Отказ запомнен: второй запрос не открывает окно и снова получает отказ.
    fromFrame(frame.win, { id: 'r2', action: 'account' })
    await vi.waitFor(() => expect(responseTo(frame.sent, 'r2')).toBeDefined())
    expect(responseTo(frame.sent, 'r2')?.error).toMatchObject({ code: 'permission_denied' })
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
  })

  it('разрешил — приложение получает адрес и подпись; повторно не спрашивает', async () => {
    const { frame } = await bootWithFrame()
    fromFrame(frame.win, { id: 'r1', action: 'account' })
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
    lastPrompt().config.onOk()

    await vi.waitFor(() => expect(responseTo(frame.sent, 'r1')).toBeDefined())
    expect(responseTo(frame.sent, 'r1')?.data).toEqual({
      address: 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM',
      signature: FAKE_SIGNATURE,
    })
    // Подпись — над id приложения, а не над чем-то, что выбрало приложение.
    expect(host().signApiMessage).toHaveBeenCalledWith('test.app')

    fromFrame(frame.win, { id: 'r2', action: 'account' })
    await vi.waitFor(() => expect(responseTo(frame.sent, 'r2')?.data).toBeDefined())
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
  })

  it('сообщения с чужого origin и из чужого окна того же origin не исполняются', async () => {
    const { frame } = await bootWithFrame()
    const popup = makeFrame() // окно, открытое приложением: тот же origin, не iframe

    fromFrame(frame.win, { id: 'e1', action: 'account' }, 'https://evil.example')
    fromFrame(popup.win, { id: 'e2', action: 'account' })
    fromFrame(frame.win, { id: 'ok', action: 'nope' }) // контрольное — доходит
    await vi.waitFor(() => expect(responseTo(frame.sent, 'ok')).toBeDefined())

    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(responseTo(frame.sent, 'e1')).toBeUndefined()
    expect(popup.sent).toEqual([])
  })

  it('неизвестное действие — ошибка unknown_action в ответ', async () => {
    const { frame } = await bootWithFrame()
    fromFrame(frame.win, { id: 'u1', action: 'stealKeys' })
    await vi.waitFor(() => expect(responseTo(frame.sent, 'u1')).toBeDefined())
    expect(responseTo(frame.sent, 'u1')?.error).toMatchObject({ code: 'unknown_action' })
  })

  it('окно подписи показывает, что именно подписывается; длинный текст обрезан до 300 символов', async () => {
    const { frame } = await bootWithFrame()
    const long = 'x'.repeat(400)
    fromFrame(frame.win, { id: 's1', action: 'sign', data: { string: `  ${long}  ` } })

    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
    const { config } = lastPrompt()
    const content = config.content as VNode
    const [descr, detail] = content.children as unknown as VNode[]
    expect(descr!.children).toBe('appMsg.permission.sign.description')
    expect(detail!.children).toBe(
      `appMsg.permission.signPayload|${JSON.stringify({ text: `${'x'.repeat(300)}…` })}`
    )

    config.onOk()
    await vi.waitFor(() => expect(responseTo(frame.sent, 's1')).toBeDefined())
    expect(responseTo(frame.sent, 's1')?.data).toEqual(FAKE_SIGNATURE)
    expect(host().signApiMessage).toHaveBeenCalledWith(`  ${long}  /test.app`)
  })

  it('подпись спрашивается каждый раз; короткий текст — как есть, пустой — без строки данных', async () => {
    const { frame } = await bootWithFrame()

    fromFrame(frame.win, { id: 's1', action: 'sign', data: { string: ' hello ' } })
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1))
    const [, detail] = (lastPrompt().config.content as VNode).children as unknown as VNode[]
    expect(detail!.children).toBe('appMsg.permission.signPayload|{"text":"hello"}')
    lastPrompt().config.onOk()
    await vi.waitFor(() => expect(responseTo(frame.sent, 's1')).toBeDefined())

    fromFrame(frame.win, { id: 's2', action: 'sign', data: { string: '   ' } })
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2))
    expect(lastPrompt().config.content).toBe('appMsg.permission.sign.description')
    lastPrompt().config.onCancel()
    await vi.waitFor(() => expect(responseTo(frame.sent, 's2')).toBeDefined())
    expect(responseTo(frame.sent, 's2')?.error).toMatchObject({ code: 'permission_denied' })
  })

  it('iframe закрыли, пока открыто окно разрешения: окно убирается, ответа нет, отказ не запоминается', async () => {
    const { bridge, frame } = await bootWithFrame()
    fromFrame(frame.win, { id: 'r1', action: 'account' })
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
    const first = lastPrompt()

    bridge.unregisterApp(APP.manifest.id)
    expect(first.destroy).toHaveBeenCalledTimes(1)
    await new Promise((r) => setTimeout(r, 0))
    expect(responseTo(frame.sent, 'r1')).toBeUndefined()

    // Приложение открыли снова — вопрос задаётся заново, а не «вечный отказ».
    bridge.attachFrame(APP.manifest.id, frame.win as unknown as MessageEventSource)
    fromFrame(frame.win, { id: 'r2', action: 'account' })
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2))
  })

  it('по тайм-ауту запроса окно разрешения закрывается, приложению — ошибка timeout', async () => {
    const { frame } = await bootWithFrame()
    vi.useFakeTimers()
    fromFrame(frame.win, { id: 'r1', action: 'account' })
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
    const prompt = lastPrompt()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(prompt.destroy).toHaveBeenCalledTimes(1)
    expect(responseTo(frame.sent, 'r1')?.error).toMatchObject({ code: 'timeout' })
  })

  it('окно подписи ждёт человека дольше обычного тайм-аута (10 минут)', async () => {
    const { frame } = await bootWithFrame()
    vi.useFakeTimers()
    fromFrame(frame.win, { id: 's1', action: 'sign', data: { string: 'order #1' } })
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
    const prompt = lastPrompt()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(prompt.destroy).not.toHaveBeenCalled()
    expect(responseTo(frame.sent, 's1')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(prompt.destroy).toHaveBeenCalledTimes(1)
    expect(responseTo(frame.sent, 's1')?.error).toMatchObject({ code: 'timeout' })
  })
})

describe('bootMiniApps: события и fetch', () => {
  it('события iframe получают все подписчики, даже если один из них упал', async () => {
    const { mod, frame } = await bootWithFrame()
    const broken = vi.fn(() => {
      throw new Error('listener bug')
    })
    const ok = vi.fn()
    mod.onIframeLifecycleEvent.add(broken)
    mod.onIframeLifecycleEvent.add(ok)

    fromFrame(frame.win, { event: 'loaded', data: { ready: true } })
    await vi.waitFor(() => expect(ok).toHaveBeenCalled())
    expect(broken).toHaveBeenCalled()
    expect(ok).toHaveBeenCalledWith(APP, 'loaded', { ready: true })
  })

  it('fetch из iframe идёт через туннель, ответ туннеля возвращается в iframe', async () => {
    const { frame } = await bootWithFrame()
    const resp = {
      type: 'FETCH_RESPONSE',
      requestId: 'f1',
      success: true,
      data: { status: 200, statusText: 'OK', headers: {}, body: [104, 105] },
    }
    mocks.fetchHandle.mockResolvedValue(resp)
    const req = {
      type: 'FETCH_REQUEST',
      requestId: 'f1',
      request: { url: 'https://api.test.app.com/items', method: 'GET' },
    }

    fromFrame(frame.win, req)
    await vi.waitFor(() => expect(frame.sent).toContainEqual(resp))
    expect(mocks.fetchHandle).toHaveBeenCalledWith(APP, req)
  })
})

describe('bootMiniApps: действия приложения подтвердились', () => {
  /** Регистрирует push-канал iframe и возвращает колбэк trackAppActions. */
  async function setupPush() {
    const ctx = await bootWithFrame()
    fromFrame(ctx.frame.win, { id: 'L1', listener: 'L1' })
    await vi.waitFor(() => expect(responseTo(ctx.frame.sent, 'L1')).toBeDefined())
    const [push, owner] = mocks.trackAppActions.mock.calls[0] as [
      (appId: string, key: string, data: Record<string, unknown>) => void,
      () => string | null,
    ]
    return { ...ctx, push, owner }
  }

  it('приложению приходит событие action, а следом — свежий баланс', async () => {
    const { frame, push, owner } = await setupPush()
    expect(owner()).toBe('PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM')

    push('test.app', 'action', { id: 'a1', completed: true })
    expect(frame.sent).toContainEqual({
      listener: 'L1',
      key: 'action',
      data: { id: 'a1', completed: true },
    })
    await vi.waitFor(() =>
      expect(frame.sent).toContainEqual({ listener: 'L1', key: 'balance', data: { actual: 7 } })
    )
  })

  it('баланс не получился — событие action всё равно доставлено, ошибка не всплывает', async () => {
    const { frame, push } = await setupPush()
    vi.mocked(host().getUserBalance).mockRejectedValue(new Error('node down'))

    push('test.app', 'action', { id: 'a2' })
    await new Promise((r) => setTimeout(r, 0))
    expect(frame.sent).toContainEqual({ listener: 'L1', key: 'action', data: { id: 'a2' } })
    expect(frame.sent.some((m) => (m as { key?: string }).key === 'balance')).toBe(false)
  })

  it('подтверждение, пришедшее до готовности хоста, баланс не запрашивает', async () => {
    const { mod } = await prepare()
    let releaseInit: () => void = () => {}
    mocks.appsInit.mockImplementation(
      () =>
        new Promise<void>((r) => {
          releaseInit = r
        })
    )
    const booting = mod.bootMiniApps(ROUTER)
    // Слежение за действиями включается ДО загрузки приложений.
    expect(mocks.trackAppActions).toHaveBeenCalledTimes(1)
    const [push] = mocks.trackAppActions.mock.calls[0] as [
      (appId: string, key: string, data: Record<string, unknown>) => void,
    ]

    expect(() => push('test.app', 'action', { id: 'early' })).not.toThrow()
    releaseInit()
    await booting
    expect(host().getUserBalance).not.toHaveBeenCalled()

    push('test.app', 'action', { id: 'late' })
    expect(host().getUserBalance).toHaveBeenCalledTimes(1)
  })
})
