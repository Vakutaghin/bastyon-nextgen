// Прод-сборка HostContext (createDefaultHostContext): что хост делает по
// просьбе мини-приложения — какие сторы читает, куда ведёт роутер, что уходит
// в сеть без подписи пользователя, что доступно гостю. Замоканы сторы, роутер,
// сеть, окна (модалки) и нативные слои; методы доменов — настоящие.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import { _resetAppActionsForTests } from '../tx/app-actions'
import { removeObject } from '../tx/legacy-objects'

const mocks = vi.hoisted(() => ({
  ui: { language: 'ru' },
  dark: false,
  auth: {
    isUserAuthenticated: true,
    address: 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM' as string | undefined,
    keyPair: { kp: 1 } as unknown,
    getKeyPair: { kp: 1 } as unknown,
  },
  torReady: false,
  tauri: false,
  capacitor: false,
  mobile: false,
  pendingItems: [] as Array<{ txid: string }>,
  generateApiSignature: vi.fn(),
  getWalletAddressesList: vi.fn(),
  getByPRC: vi.fn(),
  fetchHttp: vi.fn(),
  uploadImages: vi.fn(),
  removeVideoByPointer: vi.fn(),
  getVideosInfo: vi.fn(),
  thumbnailOf: vi.fn(),
  fetchPeertubeHostAllowlist: vi.fn(),
  confirmVideoRemoval: vi.fn(),
  sendLegacyTx: vi.fn(),
  modalStore: {
    postComposerModal: { share: null as unknown },
    openPostComposerModal: vi.fn(),
    openAuthModal: vi.fn(),
  },
  shareToChatOpen: vi.fn(),
  openComplainDialog: vi.fn(),
  openVideoDialog: vi.fn(),
  openExternal: vi.fn(),
  openPaymentModal: vi.fn(),
  notifyMerchant: vi.fn(),
  appFetch: vi.fn(),
  toastWarning: vi.fn(),
}))

vi.mock('@/stores/ui-store', () => ({ useUIStore: () => mocks.ui }))
vi.mock('@/composables/use-theme', () => ({
  useTheme: () => ({ isDark: { value: mocks.dark } }),
}))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/stores/tor-store', () => ({ useTorStore: () => ({ isReady: mocks.torReady }) }))
vi.mock('@/b-components/video-uploader/utils/environment', () => ({
  isTauri: () => mocks.tauri,
  isCapacitor: () => mocks.capacitor,
}))
vi.mock('@/blockchain/core/signatures/api-signature', () => ({
  generateApiSignature: mocks.generateApiSignature,
}))
vi.mock('@/blockchain/storage', () => ({ getWalletAddressesList: mocks.getWalletAddressesList }))
vi.mock('@/helpers/api/request', () => ({ getByPRC: mocks.getByPRC, fetchHttp: mocks.fetchHttp }))
vi.mock('@/services/image-upload-service', () => ({ uploadImages: mocks.uploadImages }))
vi.mock('@/services/peertube/peertube-videos', () => ({
  removeVideoByPointer: mocks.removeVideoByPointer,
  getVideosInfo: mocks.getVideosInfo,
}))
vi.mock('@/services/media/media-info', () => ({ thumbnailOf: mocks.thumbnailOf }))
vi.mock('@/services/peertube/peertube-host', () => ({
  fetchPeertubeHostAllowlist: mocks.fetchPeertubeHostAllowlist,
}))
vi.mock('./host-context-methods/confirm-video-removal', () => ({
  confirmVideoRemoval: mocks.confirmVideoRemoval,
}))
vi.mock('../tx/send-legacy-tx', () => ({ sendLegacyTx: mocks.sendLegacyTx }))
// Настоящий isConfirmed, стор ожиданий — заглушка; WS ему не нужен.
vi.mock('@/blockchain/ws/ws-service', () => ({ wsService: {} }))
vi.mock('@/stores/pending-transactions-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/pending-transactions-store')>()),
  usePendingTransactionsStore: () => ({ items: mocks.pendingItems }),
}))
vi.mock('@/stores/modal-store', () => ({ useModalStore: () => mocks.modalStore }))
vi.mock('@mobile/utils/platform', () => ({ isMobile: () => mocks.mobile }))
vi.mock('@/stores/share-to-chat-store', () => ({
  useShareToChatStore: () => ({ open: mocks.shareToChatOpen }),
}))
vi.mock('../ui/complain-dialog-controller', () => ({
  openComplainDialog: mocks.openComplainDialog,
}))
vi.mock('../ui/video-dialog-controller', () => ({ openVideoDialog: mocks.openVideoDialog }))
vi.mock('@/helpers/common/open-external', () => ({ openExternal: mocks.openExternal }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('../ui/payment-modal-controller', () => ({
  openPaymentModal: mocks.openPaymentModal,
  paymentModalBusy: () => false,
}))
vi.mock('../tx/ext-callback', () => ({ notifyMerchant: mocks.notifyMerchant }))
vi.mock('@/helpers/api/fetch-strategies', () => ({ appFetch: mocks.appFetch }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { warning: mocks.toastWarning } }))

import { createDefaultHostContext, type DefaultHostContextOptions } from './host-context'

const ME = 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM'
const TX = 'd'.repeat(64)

function makeRouter() {
  return { push: vi.fn(async () => {}) }
}

async function makeHost(over: Partial<DefaultHostContextOptions> = {}) {
  const router = makeRouter()
  const host = await createDefaultHostContext({
    router: router as unknown as Router,
    ...over,
  })
  return { host, router }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  _resetAppActionsForTests()
  mocks.ui.language = 'ru'
  mocks.dark = false
  mocks.auth.isUserAuthenticated = true
  mocks.auth.address = ME
  mocks.auth.keyPair = { kp: 1 }
  mocks.auth.getKeyPair = { kp: 1 }
  mocks.torReady = false
  mocks.tauri = false
  mocks.capacitor = false
  mocks.mobile = false
  mocks.pendingItems = []
  mocks.modalStore.postComposerModal.share = null
  for (const fn of Object.values(mocks)) {
    if (vi.isMockFunction(fn)) fn.mockReset()
  }
  mocks.modalStore.openPostComposerModal.mockReset()
  mocks.modalStore.openAuthModal.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.style.removeProperty('--app-margin-top')
})

describe('createDefaultHostContext: окружение', () => {
  it('устройство: заданное явно важнее определения по среде', async () => {
    mocks.tauri = true
    expect((await makeHost()).host.device).toBe('tauri')
    expect((await makeHost({ device: 'capacitor_ios' })).host.device).toBe('capacitor_ios')
    mocks.tauri = false
    expect((await makeHost()).host.device).toBe('browser')
  })

  it('язык, тема, отступ и Tor читаются на каждый вызов — приложение видит актуальное', async () => {
    const { host } = await makeHost()
    expect(host.getLocale()).toBe('ru')
    expect(host.getTheme()).toEqual({ rootid: 'light' })
    expect(host.getMarginTop()).toBe('0px')
    expect(host.isTorActive()).toBe(false)

    mocks.ui.language = 'en'
    mocks.dark = true
    mocks.torReady = true
    document.documentElement.style.setProperty('--app-margin-top', '24px')

    expect(host.getLocale()).toBe('en')
    expect(host.getTheme()).toEqual({ rootid: 'dark' })
    expect(host.getMarginTop()).toBe('24px')
    expect(host.isTorActive()).toBe(true)
  })

  it('проект отдаёт список архивных PeerTube-серверов массивом (legacy SDK зовёт .map без проверки)', async () => {
    const { host } = await makeHost()
    const project = host.getProject()
    expect(project).toMatchObject({ url: 'bastyon.com', name: 'Bastyon', protocol: 'bastyon' })
    expect(Array.isArray(project.archivedPeertubeServers)).toBe(true)
    expect(project.archivedPeertubeServers!.length).toBeGreaterThan(0)
  })
})

describe('createDefaultHostContext: гость и вошедший', () => {
  it('гостю: не авторизован, адреса нет, подписи нет, кошельков и баланса нет — и в сеть не ходим', async () => {
    mocks.auth.isUserAuthenticated = false
    mocks.auth.address = undefined
    mocks.auth.keyPair = null
    const { host } = await makeHost()

    expect(host.isUserAuthenticated()).toBe(false)
    expect(host.getUserAddress()).toBeNull()
    expect(host.signApiMessage('test.app')).toBeNull()
    expect(host.getUserWalletAddresses()).toEqual([])
    expect(await host.getUserBalance()).toEqual({})
    expect(mocks.generateApiSignature).not.toHaveBeenCalled()
    expect(mocks.getByPRC).not.toHaveBeenCalled()
  })

  it('вошедшему: подпись данных приложения его ключом; формат подписи выбирает не приложение', async () => {
    const signature = { signature: 'aa', v: 1 }
    mocks.generateApiSignature.mockReturnValue(signature)
    const { host } = await makeHost()

    expect(host.signApiMessage('order/test.app', { expiration: 60 })).toBe(signature)
    expect(mocks.generateApiSignature).toHaveBeenCalledWith({ kp: 1 }, ME, {
      data: 'order/test.app',
      expiration: 60,
    })
  })

  it('адрес пользователя меняется вместе со стором (выход из аккаунта)', async () => {
    const { host } = await makeHost()
    expect(host.getUserAddress()).toBe(ME)
    mocks.auth.address = undefined
    expect(host.getUserAddress()).toBeNull()
  })
})

describe('createDefaultHostContext: навигация и окна', () => {
  it('путь, настройки, профиль и пост открываются роутером приложения', async () => {
    const { host, router } = await makeHost()
    host.navigate('/apps/test.app')
    await host.openSettings()
    await host.openProfile('PUUAaAByj6BEey5CSYxJoGXr1KishVyC3A')
    await host.openPost(TX)

    expect(router.push.mock.calls).toEqual([
      ['/apps/test.app'],
      ['/settings'],
      ['/PUUAaAByj6BEey5CSYxJoGXr1KishVyC3A'],
      [{ path: '/', query: { p: TX } }],
    ])
  })

  it('alert — своей реализацией, если передана; иначе системным окном', async () => {
    const alertImpl = vi.fn(async () => {})
    await (await makeHost({ alertImpl })).host.showAlert('Готово')
    expect(alertImpl).toHaveBeenCalledWith('Готово')

    const systemAlert = vi.fn()
    vi.stubGlobal('alert', systemAlert)
    await (await makeHost()).host.showAlert('Привет')
    expect(systemAlert).toHaveBeenCalledWith('Привет')
  })

  it('«поделиться в ленте» на телефоне — страница /compose с заготовкой, на компьютере — окно поста', async () => {
    const data = { url: 'https://shop.example/item/1', sharing: { title: 'Распродажа' } }

    mocks.mobile = true
    const phone = await makeHost()
    await phone.host.share(data, { onBastyon: true, appName: 'Shop' })
    const share = mocks.modalStore.postComposerModal.share as { message: string; tags: string[] }
    expect(share.message).toBe('Распродажа\n\nhttps://shop.example/item/1')
    expect(share.tags).toEqual(['Shop'])
    expect(phone.router.push).toHaveBeenCalledWith({ name: 'compose' })
    expect(mocks.modalStore.openPostComposerModal).not.toHaveBeenCalled()

    mocks.mobile = false
    const desktop = await makeHost()
    await desktop.host.share(data, { onBastyon: true, appName: 'Shop' })
    expect(mocks.modalStore.openPostComposerModal).toHaveBeenCalledWith({ share })
    expect(desktop.router.push).not.toHaveBeenCalled()
  })

  it('«поделиться»: вошедшему — окно «Поделиться» Bastyon, гостю — системное меню', async () => {
    const nativeShare = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, share: nativeShare })
    const data = { url: 'https://shop.example/item/1' }

    const { host } = await makeHost()
    await host.share(data, { appName: 'Shop' })
    expect(mocks.shareToChatOpen).toHaveBeenCalledWith({
      link: 'https://shop.example/item/1',
      title: 'Shop',
    })
    expect(nativeShare).not.toHaveBeenCalled()

    mocks.auth.isUserAuthenticated = false
    await host.share(data, { appName: 'Shop' })
    expect(mocks.shareToChatOpen).toHaveBeenCalledTimes(1)
    expect(nativeShare).toHaveBeenCalledWith({ url: 'https://shop.example/item/1' })
  })

  it('жалоба: окно получает проверенную сущность и имя приложения; ответ — когда окно закрыли', async () => {
    let closeDialog: (sent: boolean) => void = () => {}
    mocks.openComplainDialog.mockImplementation(
      () =>
        new Promise<boolean>((r) => {
          closeDialog = r
        })
    )
    const { host } = await makeHost()
    const ctrl = new AbortController()
    let answered = false
    const pending = host
      .openComplain(
        { entityLink: ' https://shop.example/x ', entityType: 'item' },
        'Shop',
        ctrl.signal
      )
      .then(() => {
        answered = true
      })

    await vi.waitFor(() => expect(mocks.openComplainDialog).toHaveBeenCalled())
    expect(mocks.openComplainDialog).toHaveBeenCalledWith(
      { appName: 'Shop', entity: { link: 'https://shop.example/x', txid: '', type: 'item' } },
      ctrl.signal
    )
    expect(answered).toBe(false)
    closeDialog(true)
    await pending
    expect(answered).toBe(true)
  })

  it('жалоба без ссылки и txid отклоняется, окно не открывается', async () => {
    const { host } = await makeHost()
    await expect(host.openComplain({ entityType: 'item' }, 'Shop')).rejects.toThrow(
      'complain:invalid'
    )
    expect(mocks.openComplainDialog).not.toHaveBeenCalled()
  })
})

describe('createDefaultHostContext: сеть и данные', () => {
  it('курсы валют берутся у прокси без подписи пользователя', async () => {
    mocks.fetchHttp.mockResolvedValue({ prices: {} })
    const { host } = await makeHost()
    await host.fetchCurrencyRates()
    expect(mocks.fetchHttp).toHaveBeenCalledWith({
      path: 'exchanges/history',
      data: {},
      options: { auth: false },
    })
  })

  it('транзакция приложения: отправка с именем приложения; подтверждение сверяется с нодой без подписи', async () => {
    mocks.sendLegacyTx.mockResolvedValue(TX)
    const { host } = await makeHost()
    const obj = removeObject('a'.repeat(64))

    const sent = await host.sendAppTransaction('shop.app', 'Shop', obj)
    expect(mocks.sendLegacyTx).toHaveBeenCalledWith(obj, { title: 'Shop' })
    expect(sent).toMatchObject({ transaction: TX, completed: false })

    // Пока транзакция в «песочных часах» — ноду не спрашиваем.
    mocks.pendingItems = [{ txid: TX }]
    expect(await host.getAppActions('shop.app')).toMatchObject([{ completed: false }])
    expect(mocks.getByPRC).not.toHaveBeenCalled()

    // Часы о ней забыли — сверяемся с нодой: в блоке, значит действие завершено.
    mocks.pendingItems = []
    mocks.getByPRC.mockResolvedValue({ result: 'success', data: { txid: TX, confirmations: 2 } })
    expect(await host.getAppActions('shop.app')).toMatchObject([
      { transaction: TX, completed: true },
    ])
    expect(mocks.getByPRC).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'getrawtransaction',
        parameters: [TX, 1],
        options: { auth: false },
      })
    )
  })

  it('чужой txid в ответе ноды не считается подтверждением', async () => {
    mocks.sendLegacyTx.mockResolvedValue(TX)
    mocks.getByPRC.mockResolvedValue({ data: { txid: 'e'.repeat(64), confirmations: 9 } })
    const { host } = await makeHost()
    await host.sendAppTransaction('shop.app', 'Shop', removeObject('a'.repeat(64)))

    expect(await host.getAppActions('shop.app')).toMatchObject([{ completed: false }])
  })

  it('гость не может отправить транзакцию от имени приложения', async () => {
    mocks.auth.address = undefined
    const { host } = await makeHost()
    await expect(
      host.sendAppTransaction('shop.app', 'Shop', removeObject('a'.repeat(64)))
    ).rejects.toThrow('required_authorization')
    expect(mocks.sendLegacyTx).not.toHaveBeenCalled()
  })

  it('сведения о видео: превью и миниатюра — только когда нода знает путь к картинке', async () => {
    const url = 'peertube://video.example/uuid-1'
    mocks.getVideosInfo.mockResolvedValue(
      new Map([[url, { uuid: 'uuid-1', thumbnailPath: '/static/t.jpg', views: 5 }]])
    )
    mocks.thumbnailOf.mockImplementation(
      (u: string, o: { thumbnailPath: string }) => `thumb:${u}${o.thumbnailPath}`
    )
    const { host } = await makeHost()

    const [item, missing] = await host.getVideosInfo([url, 'peertube://video.example/x'], true)
    expect(mocks.getVideosInfo).toHaveBeenCalledWith({
      urls: [url, 'peertube://video.example/x'],
      update: true,
    })
    expect(item?.data).toMatchObject({
      image: null,
      thumbnail: `thumb:${url}/static/t.jpg`,
      views: 5,
    })
    expect(missing).toBeNull()
  })

  it('удаление видео: хост не из списка ноды — отказ без вопроса; подтвердил — удаление ключом пользователя', async () => {
    mocks.fetchPeertubeHostAllowlist.mockResolvedValue(new Set(['video.example']))
    mocks.confirmVideoRemoval.mockResolvedValue(true)
    const { host } = await makeHost()

    await expect(
      host.removeVideo('peertube://evil.example/uuid-1', { appName: 'Shop' })
    ).rejects.toThrow('videos:remove:host_not_allowed')
    expect(mocks.confirmVideoRemoval).not.toHaveBeenCalled()

    await host.removeVideo('peertube://Video.Example/uuid-1', { appName: 'Shop' })
    expect(mocks.confirmVideoRemoval).toHaveBeenCalledWith({
      appName: 'Shop',
      host: 'video.example',
      videoId: 'uuid-1',
    })
    expect(mocks.removeVideoByPointer).toHaveBeenCalledWith({
      pointer: 'peertube://Video.Example/uuid-1',
      keyPair: { kp: 1 },
      address: ME,
    })
  })

  describe('оплата по ссылке магазина', () => {
    /** Хэш ссылки, как его собирает SDK (`PaymentHash.makeURLHash`): JSON → hex. */
    function extHash(params: Record<string, unknown>): string {
      const json = JSON.stringify(params)
      let out = ''
      for (let i = 0; i < json.length; i++) out += json.charCodeAt(i).toString(16).padStart(2, '0')
      return '_' + out
    }
    const SHOP = 'PUUAaAByj6BEey5CSYxJoGXr1KishVyC3A'
    const link = { a: 'p', ad: SHOP, v: 2, c: 'https://shop.test/paid', h: '42' }

    it('после перевода магазину сообщают через сетевой слой приложения, с адресом плательщика', async () => {
      mocks.openPaymentModal.mockResolvedValue({ transaction: TX, completed: true, contacts: {} })
      mocks.notifyMerchant.mockImplementation(
        async (
          _p: unknown,
          _tx: string,
          _c: unknown,
          _a: unknown,
          io: { fetch: typeof fetch; openExternal: (u: string) => Promise<void> }
        ) => {
          await io.fetch('https://shop.test/paid', { method: 'POST' })
          await io.openExternal('https://shop.test/thanks')
        }
      )
      const { host } = await makeHost()

      await expect(host.openExternalPayment(extHash(link), 'Shop', 'shop.app')).resolves.toBe(
        'application:ext:opened'
      )
      await vi.waitFor(() => expect(mocks.openExternal).toHaveBeenCalled())
      expect(mocks.notifyMerchant).toHaveBeenCalledWith(
        expect.objectContaining({ address: SHOP, value: 2 }),
        TX,
        {},
        ME,
        expect.any(Object)
      )
      // appFetch, а не голый fetch: в Tauri запрос магазину идёт через Tor.
      expect(mocks.appFetch).toHaveBeenCalledWith('https://shop.test/paid', { method: 'POST' })
      expect(mocks.openExternal).toHaveBeenCalledWith('https://shop.test/thanks')
      expect(mocks.toastWarning).not.toHaveBeenCalled()
    })

    it('магазин не ответил — человек видит предупреждение (деньги уже ушли)', async () => {
      mocks.openPaymentModal.mockResolvedValue({ transaction: TX, completed: true })
      mocks.notifyMerchant.mockRejectedValue(new Error('merchant_http_500'))
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { host } = await makeHost()

      await host.openExternalPayment(extHash(link), 'Shop', 'shop.app')
      await vi.waitFor(() =>
        expect(mocks.toastWarning).toHaveBeenCalledWith({ message: 'miniapps.extMerchantFailed' })
      )
    })
  })

  it('окно загрузки видео открывается с именем приложения и сигналом отмены', async () => {
    mocks.openVideoDialog.mockResolvedValue({ link: 'peertube://video.example/u', name: 'clip' })
    const { host } = await makeHost()
    const ctrl = new AbortController()
    await expect(host.openVideoUploadDialog('Shop', ctrl.signal)).resolves.toEqual({
      link: 'peertube://video.example/u',
      name: 'clip',
    })
    expect(mocks.openVideoDialog).toHaveBeenCalledWith('Shop', ctrl.signal)
  })
})
