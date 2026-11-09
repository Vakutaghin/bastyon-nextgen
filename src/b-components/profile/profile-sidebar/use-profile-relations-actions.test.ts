// Кнопки отношений на сайдбаре профиля: когда видна «Подписаться» (не свой
// профиль, вошли), колокольчик уведомлений (приватная ↔ публичная подписка),
// блокировка с подтверждением и загрузка подписок/блок-листа после входа.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref, type EffectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  auth: null as null | { isAuthenticated: boolean; getUserAddress: string },
  relations: null as null | ReturnType<typeof makeRelations>,
}))

function makeRelations() {
  const s = reactive({
    blocked: new Set<string>(),
    pending: new Set<string>(),
    subscribed: new Set<string>(),
    subscribedPrivate: new Set<string>(),
    subscribePending: new Set<string>(),
    subscriptionsLoaded: true,
  })
  return Object.assign(s, {
    isBlocked: (a: string) => s.blocked.has(a),
    isPending: (a: string) => s.pending.has(a),
    isSubscribed: (a: string) => s.subscribed.has(a),
    isSubscribedPrivate: (a: string) => s.subscribedPrivate.has(a),
    isSubscribePending: (a: string) => s.subscribePending.has(a),
    isSubscriptionKnown: (a: string) => s.subscriptionsLoaded || s.subscribed.has(a),
    init: vi.fn(async () => {}),
    block: vi.fn(async (_a: string) => {}),
    unblock: vi.fn(async (_a: string) => {}),
    subscribe: vi.fn(async (_a: string) => {}),
    subscribePrivate: vi.fn(async (_a: string) => {}),
    unsubscribe: vi.fn(async (_a: string) => {}),
  })
}

vi.mock('ant-design-vue', () => ({ Modal: { confirm: mocks.confirm } }))
vi.mock('@/components/icons', () => ({ ExclamationCircleOutlined: {} }))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { success: mocks.toastSuccess, error: mocks.toastError },
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => mocks.auth }))
// Подписки и блокировки — транзакции в цепочке; стор подменён состоянием в памяти.
vi.mock('@/stores', () => ({ useUserRelationsStore: () => mocks.relations }))

import { useProfileRelationsActions } from './use-profile-relations-actions'

let scope: EffectScope | null = null

function setup(profile = 'PStar') {
  const address = ref(profile)
  scope = effectScope()
  const api = scope.run(() => useProfileRelationsActions(address))!
  return { api, address, relations: mocks.relations! }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = reactive({ isAuthenticated: true, getUserAddress: 'PMe' })
  mocks.relations = makeRelations()
})

afterEach(() => {
  scope?.stop()
  scope = null
})

describe('что показывать', () => {
  it('«Подписаться» — только вошедшему и только на чужом профиле', () => {
    const { api, address } = setup('PStar')
    expect(api.canShowSubscribe.value).toBe(true)
    expect(api.isOwnProfile.value).toBe(false)

    address.value = 'PMe'
    expect(api.canShowSubscribe.value).toBe(false)
    expect(api.isOwnProfile.value).toBe(true)

    address.value = ''
    expect(api.canShowSubscribe.value).toBe(false)
    expect(api.isOwnProfile.value).toBe(false)
  })

  it('гостю кнопка подписки не показывается', () => {
    mocks.auth!.isAuthenticated = false
    mocks.auth!.getUserAddress = ''
    const { api } = setup('PStar')
    expect(api.canShowSubscribe.value).toBe(false)
  })

  it('состояние кнопок следует за стором и за сменой профиля', () => {
    const { api, address, relations } = setup('PStar')
    expect(api.isSubscribed.value).toBe(false)
    relations.subscribed.add('PStar')
    relations.subscribedPrivate.add('PStar')
    relations.blocked.add('POther')
    relations.pending.add('POther')
    expect(api.isSubscribed.value).toBe(true)
    expect(api.isSubscribedPrivate.value).toBe(true)
    expect(api.isBlocked.value).toBe(false)

    address.value = 'POther'
    expect(api.isSubscribed.value).toBe(false)
    expect(api.isBlocked.value).toBe(true)
    expect(api.isBlockPending.value).toBe(true)
  })

  it('пока подписки не пришли с ноды, состояние подписки «неизвестно»', () => {
    mocks.relations!.subscriptionsLoaded = false
    const { api, relations } = setup('PStar')
    expect(api.isSubscriptionUnknown.value).toBe(true)
    relations.subscriptionsLoaded = true
    expect(api.isSubscriptionUnknown.value).toBe(false)
  })
})

describe('загрузка отношений', () => {
  it('вошедшему подписки и блок-лист грузятся сразу', () => {
    setup()
    expect(mocks.relations!.init).toHaveBeenCalledTimes(1)
  })

  it('гостю — после входа, не раньше', async () => {
    mocks.auth!.isAuthenticated = false
    setup()
    expect(mocks.relations!.init).not.toHaveBeenCalled()
    mocks.auth!.isAuthenticated = true
    await nextTick()
    expect(mocks.relations!.init).toHaveBeenCalledTimes(1)
  })
})

describe('кнопки', () => {
  it('основная кнопка: не подписан — подписка сразу', async () => {
    const { api, relations } = setup('PStar')
    await api.onPrimaryClick()
    expect(relations.subscribe).toHaveBeenCalledWith('PStar')
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('основная кнопка: подписан — диалог отписки', async () => {
    const { api, relations } = setup('PStar')
    relations.subscribed.add('PStar')
    await api.onPrimaryClick()
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(relations.unsubscribe).not.toHaveBeenCalled()
  })

  it('блокировка — через диалог; во время транзакции кнопка не реагирует', async () => {
    const { api, relations } = setup('PStar')
    api.onBlockClick()
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    const { onOk } = mocks.confirm.mock.calls[0]![0] as { onOk: () => Promise<void> }
    await onOk()
    expect(relations.block).toHaveBeenCalledWith('PStar')

    relations.pending.add('PStar')
    api.onBlockClick()
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
  })

  it('колокольчик без приватной подписки — включает уведомления', async () => {
    const { api, relations } = setup('PStar')
    await api.onBellClick()
    expect(relations.subscribePrivate).toHaveBeenCalledWith('PStar')
    expect(relations.subscribe).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith({
      message: 'subscriptions.notificationsEnabledToast',
    })
  })

  it('колокольчик при приватной подписке — выключает уведомления, оставаясь подписанным', async () => {
    const { api, relations } = setup('PStar')
    relations.subscribed.add('PStar')
    relations.subscribedPrivate.add('PStar')
    await api.onBellClick()
    expect(relations.subscribe).toHaveBeenCalledWith('PStar')
    expect(relations.unsubscribe).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalledWith({
      message: 'subscriptions.notificationsDisabledToast',
    })
  })

  it('ошибка колокольчика — тост с текстом, без текста — общий', async () => {
    const { api, relations } = setup('PStar')
    relations.subscribePrivate.mockRejectedValueOnce(new Error('Лимит'))
    await api.onBellClick()
    expect(mocks.toastError).toHaveBeenLastCalledWith({ message: 'Лимит' })
    relations.subscribePrivate.mockRejectedValueOnce('?')
    await api.onBellClick()
    expect(mocks.toastError).toHaveBeenLastCalledWith({ message: 'subscriptions.errFailed' })
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('колокольчик молчит без адреса, во время транзакции и пока подписки неизвестны', async () => {
    const { api, address, relations } = setup('')
    await api.onBellClick()
    address.value = 'PStar'
    relations.subscribePending.add('PStar')
    await api.onBellClick()
    relations.subscribePending.clear()
    relations.subscriptionsLoaded = false
    await api.onBellClick()
    expect(relations.subscribe).not.toHaveBeenCalled()
    expect(relations.subscribePrivate).not.toHaveBeenCalled()
  })
})
