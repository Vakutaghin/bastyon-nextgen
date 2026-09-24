import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const onOpenUrl = vi.fn(async (_cb: (urls: string[]) => void) => () => {})
const getCurrent = vi.fn(async (): Promise<string[] | null> => null)
const isRegistered = vi.fn(async (_scheme: string) => false)
const register = vi.fn(async (_scheme: string) => null)
const addListener = vi.fn(async (_event: string, _cb: (data: { url: string }) => void) => ({
  remove: async () => {},
}))
const getLaunchUrl = vi.fn(async (): Promise<{ url: string } | null> => null)
const isNativePlatform = vi.fn(() => false)
const isTauriEnv = vi.fn(() => false)

vi.mock('@tauri-apps/plugin-deep-link', () => ({ onOpenUrl, getCurrent, isRegistered, register }))
vi.mock('@capacitor/app', () => ({ App: { addListener, getLaunchUrl } }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNativePlatform() } }))
vi.mock('@/helpers/api/request-tor', () => ({ isTauriEnv: () => isTauriEnv() }))

const { setupDeepLinks, resetDeepLinksForTests, DEEP_LINK_QUERY_PARAM } =
  await import('./use-deep-links')

const TXID = 'a'.repeat(64)

function fakeRouter() {
  return { replace: vi.fn(), push: vi.fn() } as unknown as Parameters<typeof setupDeepLinks>[0] & {
    replace: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  resetDeepLinksForTests()
  vi.clearAllMocks()
  isNativePlatform.mockReturnValue(false)
  isTauriEnv.mockReturnValue(false)
  getCurrent.mockResolvedValue(null)
  getLaunchUrl.mockResolvedValue(null)
  isRegistered.mockResolvedValue(false)
})

afterEach(() => {
  resetDeepLinksForTests()
})

describe('setupDeepLinks — Tauri', () => {
  it('подписывается на onOpenUrl и открывает пришедшую ссылку', async () => {
    isTauriEnv.mockReturnValue(true)
    const router = fakeRouter()

    await setupDeepLinks(router)
    expect(onOpenUrl).toHaveBeenCalledTimes(1)

    // Эмулируем системную ссылку в уже запущенное приложение.
    const handler = onOpenUrl.mock.calls[0]![0]
    handler([`bastyon://post?s=${TXID}`])
    expect(router.replace).toHaveBeenCalledWith(`/post/${TXID}`)
  })

  // Windows/Linux регистрируют схему сами (на macOS это делает Info.plist бандла).
  it('регистрирует схемы, если система о них ещё не знает', async () => {
    isTauriEnv.mockReturnValue(true)
    await setupDeepLinks(fakeRouter())

    expect(register).toHaveBeenCalledWith('bastyon')
    expect(register).toHaveBeenCalledWith('pocketnet')
  })

  it('не перерегистрирует уже известную схему', async () => {
    isTauriEnv.mockReturnValue(true)
    isRegistered.mockResolvedValue(true)
    await setupDeepLinks(fakeRouter())

    expect(register).not.toHaveBeenCalled()
  })

  it('холодный старт: ссылка из getCurrent (argv на Windows/Linux)', async () => {
    isTauriEnv.mockReturnValue(true)
    getCurrent.mockResolvedValue(['bastyon://alice'])
    const router = fakeRouter()

    await setupDeepLinks(router)
    expect(router.replace).toHaveBeenCalledWith('/alice')
  })
})

describe('setupDeepLinks — Capacitor', () => {
  it('слушает appUrlOpen', async () => {
    isNativePlatform.mockReturnValue(true)
    const router = fakeRouter()

    await setupDeepLinks(router)
    expect(addListener).toHaveBeenCalledWith('appUrlOpen', expect.any(Function))

    const handler = addListener.mock.calls[0]![1]
    handler({ url: 'bastyon://application?id=demo.app' })
    expect(router.replace).toHaveBeenCalledWith('/app/demo.app')
  })

  it('ссылка, с которой запустили приложение', async () => {
    isNativePlatform.mockReturnValue(true)
    getLaunchUrl.mockResolvedValue({ url: `bastyon://index?v=${TXID}` })
    const router = fakeRouter()

    await setupDeepLinks(router)
    expect(router.replace).toHaveBeenCalledWith(`/post/${TXID}`)
  })
})

describe('setupDeepLinks — веб', () => {
  it('разбирает ?deeplink= (обработчик протокола PWA)', async () => {
    const url = new URL(window.location.href)
    url.searchParams.set(DEEP_LINK_QUERY_PARAM, 'web+bastyon://bob')
    window.history.replaceState({}, '', url)

    const router = fakeRouter()
    await setupDeepLinks(router)
    expect(router.replace).toHaveBeenCalledWith('/bob')

    window.history.replaceState({}, '', '/')
  })

  it('чужую ссылку игнорирует', async () => {
    const url = new URL(window.location.href)
    url.searchParams.set(DEEP_LINK_QUERY_PARAM, 'https://evil.example/post')
    window.history.replaceState({}, '', url)

    const router = fakeRouter()
    await setupDeepLinks(router)
    expect(router.replace).not.toHaveBeenCalled()

    window.history.replaceState({}, '', '/')
  })

  it('повторный вызов ничего не делает', async () => {
    isTauriEnv.mockReturnValue(true)
    const router = fakeRouter()
    await setupDeepLinks(router)
    await setupDeepLinks(router)
    expect(onOpenUrl).toHaveBeenCalledTimes(1)
  })
})
