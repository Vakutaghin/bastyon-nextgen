// Подписка, отписка, (раз)блокировка: что делается сразу, а что — только после
// подтверждения (транзакция в цепочке), какие тосты по итогу и когда действие
// не запускается вовсе (идёт транзакция, подписки ещё не пришли с ноды).
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface ConfirmArgs {
  title: string
  content?: string
  okText: string
  okType: string
  onOk: () => Promise<void>
}

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  relations: {
    blocked: new Set<string>(),
    pending: new Set<string>(),
    subscribed: new Set<string>(),
    subscribePending: new Set<string>(),
    subscriptionsLoaded: true,
    isBlocked: (a: string) => mocks.relations.blocked.has(a),
    isPending: (a: string) => mocks.relations.pending.has(a),
    isSubscribed: (a: string) => mocks.relations.subscribed.has(a),
    isSubscribePending: (a: string) => mocks.relations.subscribePending.has(a),
    isSubscriptionKnown: (a: string) =>
      mocks.relations.subscriptionsLoaded || mocks.relations.subscribed.has(a),
    block: vi.fn(async (_a: string) => {}),
    unblock: vi.fn(async (_a: string) => {}),
    subscribe: vi.fn(async (_a: string) => {}),
    unsubscribe: vi.fn(async (_a: string) => {}),
  },
}))

vi.mock('ant-design-vue', () => ({ Modal: { confirm: mocks.confirm } }))
vi.mock('@/components/icons', () => ({ ExclamationCircleOutlined: {} }))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { success: mocks.toastSuccess, error: mocks.toastError },
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
// Действия отношений — транзакции в цепочке; стор подменён состоянием в памяти.
vi.mock('@/stores', () => ({ useUserRelationsStore: () => mocks.relations }))

import { useRelationActions } from './use-relation-actions'

/** Аргументы последнего показанного диалога подтверждения. */
const lastDialog = (): ConfirmArgs =>
  mocks.confirm.mock.calls[mocks.confirm.mock.calls.length - 1]![0] as ConfirmArgs

beforeEach(() => {
  vi.clearAllMocks()
  const r = mocks.relations
  r.blocked.clear()
  r.pending.clear()
  r.subscribed.clear()
  r.subscribePending.clear()
  r.subscriptionsLoaded = true
  for (const fn of [r.block, r.unblock, r.subscribe, r.unsubscribe]) {
    fn.mockImplementation(async () => {})
  }
})

describe('блокировка', () => {
  it('сначала переспрашивает, блокирует только после подтверждения', async () => {
    const { confirmBlock } = useRelationActions()
    confirmBlock('PBad')
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(lastDialog()).toMatchObject({
      title: 'commentsMsg.blockConfirmTitle',
      okType: 'danger',
    })
    expect(mocks.relations.block).not.toHaveBeenCalled()

    await lastDialog().onOk()
    expect(mocks.relations.block).toHaveBeenCalledWith('PBad')
    expect(mocks.toastSuccess).toHaveBeenCalledWith({ message: 'commentsMsg.blockSuccess' })
  })

  it('диалог ждёт транзакцию: onOk завершается только вместе с блокировкой', async () => {
    let finish!: () => void
    mocks.relations.block.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)))
    useRelationActions().confirmBlock('PBad')
    let done = false
    const ok = lastDialog()
      .onOk()
      .then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)
    finish()
    await ok
    expect(done).toBe(true)
  })

  it('ошибка транзакции — тост с её текстом, без «успеха»', async () => {
    mocks.relations.block.mockRejectedValueOnce(new Error('Недостаточно средств'))
    useRelationActions().confirmBlock('PBad')
    await lastDialog().onOk()
    expect(mocks.toastError).toHaveBeenCalledWith({ message: 'Недостаточно средств' })
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('ошибка без текста — общий тост «не удалось заблокировать»', async () => {
    mocks.relations.block.mockRejectedValueOnce('boom')
    await useRelationActions().block('PBad')
    expect(mocks.toastError).toHaveBeenCalledWith({ message: 'commentsMsg.blockError' })
  })

  it('без адреса или пока идёт прошлая транзакция — диалог не показывается', () => {
    mocks.relations.pending.add('PBusy')
    const { confirmBlock, confirmUnblock } = useRelationActions()
    confirmBlock('')
    confirmBlock('PBusy')
    confirmUnblock('PBusy')
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('разблокировка — тоже с подтверждением, но без «опасной» кнопки', async () => {
    useRelationActions().confirmUnblock('PBad')
    expect(lastDialog()).toMatchObject({
      title: 'commentsMsg.unblockConfirmTitle',
      okType: 'primary',
    })
    await lastDialog().onOk()
    expect(mocks.relations.unblock).toHaveBeenCalledWith('PBad')
    expect(mocks.toastSuccess).toHaveBeenCalledWith({ message: 'commentsMsg.unblockSuccess' })
  })

  it('ошибка разблокировки без текста — общий тост', async () => {
    mocks.relations.unblock.mockRejectedValueOnce(null)
    await useRelationActions().unblock('PBad')
    expect(mocks.toastError).toHaveBeenCalledWith({ message: 'commentsMsg.unblockError' })
  })

  it('переключатель: заблокированного предлагает разблокировать, иначе — заблокировать', async () => {
    const { toggleBlock } = useRelationActions()
    toggleBlock('PNew')
    await lastDialog().onOk()
    expect(mocks.relations.block).toHaveBeenCalledWith('PNew')

    mocks.relations.blocked.add('POld')
    toggleBlock('POld')
    await lastDialog().onOk()
    expect(mocks.relations.unblock).toHaveBeenCalledWith('POld')
  })
})

describe('подписка', () => {
  it('не подписан — подписывается сразу, без диалога', async () => {
    await useRelationActions().toggleFollow('PStar')
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.relations.subscribe).toHaveBeenCalledWith('PStar')
    expect(mocks.toastSuccess).toHaveBeenCalledWith({ message: 'subscriptions.subscribedToast' })
  })

  it('ошибка подписки — тост с текстом ошибки', async () => {
    mocks.relations.subscribe.mockRejectedValueOnce(new Error('Нет сети'))
    await useRelationActions().toggleFollow('PStar')
    expect(mocks.toastError).toHaveBeenCalledWith({ message: 'Нет сети' })
  })

  it('подписан — переспрашивает; отписка только после подтверждения', async () => {
    mocks.relations.subscribed.add('PStar')
    await useRelationActions().toggleFollow('PStar')
    expect(mocks.relations.unsubscribe).not.toHaveBeenCalled()
    expect(lastDialog().title).toBe('subscriptions.unsubscribeConfirmTitle')

    await lastDialog().onOk()
    expect(mocks.relations.unsubscribe).toHaveBeenCalledWith('PStar')
    expect(mocks.toastSuccess).toHaveBeenCalledWith({ message: 'subscriptions.unsubscribedToast' })
  })

  it('ошибка отписки без текста — общий тост «не удалось»', async () => {
    mocks.relations.subscribed.add('PStar')
    mocks.relations.unsubscribe.mockRejectedValueOnce({})
    await useRelationActions().toggleFollow('PStar')
    await lastDialog().onOk()
    expect(mocks.toastError).toHaveBeenCalledWith({ message: 'subscriptions.errFailed' })
  })

  it('подписки ещё не пришли с ноды — ничего не делает (иначе повторная транзакция)', async () => {
    mocks.relations.subscriptionsLoaded = false
    await useRelationActions().toggleFollow('PStar')
    expect(mocks.relations.subscribe).not.toHaveBeenCalled()
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('пока идёт транзакция подписки или без адреса — ничего не делает', async () => {
    mocks.relations.subscribePending.add('PStar')
    const { toggleFollow } = useRelationActions()
    await toggleFollow('PStar')
    await toggleFollow('')
    expect(mocks.relations.subscribe).not.toHaveBeenCalled()
    expect(mocks.relations.unsubscribe).not.toHaveBeenCalled()
    expect(mocks.confirm).not.toHaveBeenCalled()
  })
})
