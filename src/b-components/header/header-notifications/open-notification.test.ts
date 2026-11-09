// Куда ведёт клик по уведомлению каждого типа: комментарий и пост — окно поста
// с переходом к комментарию (или страница поста, если нода его не отдала),
// подписка — профиль, монеты — кошелёк, ссылка — по правилам open-redirect.
// Догрузка комментария/поста — до перехода; список закрывается только при уходе.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Router } from 'vue-router'
import type {
  NotificationCommentSnapshot,
  NotificationItem,
  NotificationPostSnapshot,
} from '@/stores/notifications-store'

type CachedPost = NotificationPostSnapshot & Record<string, unknown>

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  openExternal: vi.fn(async () => true),
  /** Что «есть на ноде»: догрузка кладёт это в кеш стора. */
  nodeComments: {} as Record<string, { id: string; postid?: string; parentid?: string }>,
  nodePosts: {} as Record<string, Record<string, unknown>>,
  store: null as null | {
    commentCache: Record<string, unknown>
    postCache: Record<string, unknown>
    ensureComment: ReturnType<typeof vi.fn>
    ensurePost: ReturnType<typeof vi.fn>
    getEnrichment: (item: NotificationItem) => { comment: unknown }
  },
}))

// Стор уведомлений ходит на ноду — подменяем его кешем с «нодой» в памяти.
vi.mock('@/stores', () => ({ useNotificationsStore: () => mocks.store }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: mocks.toastError } }))
vi.mock('@/helpers/common/open-external', () => ({ openExternal: mocks.openExternal }))
vi.mock('@/i18n', () => ({ t: (k: string) => k, tn: (k: string) => k }))
// Настоящая адаптация поста, но с возможностью уронить её в одном тесте.
vi.mock('@/helpers/common/adapt-post', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/common/adapt-post')>()
  return { ...actual, adaptPostData: vi.fn(actual.adaptPostData) }
})

import { adaptPostData } from '@/helpers/common/adapt-post'
import { useModalStore } from '@/stores/modal-store'
import { openNotification } from './open-notification'

function makeStore() {
  const store = {
    commentCache: {} as Record<string, NotificationCommentSnapshot>,
    postCache: {} as Record<string, CachedPost>,
    ensureComment: vi.fn(async (id: string) => {
      const c = mocks.nodeComments[id]
      if (c) store.commentCache[id] = c
      return !!store.commentCache[id]?.postid
    }),
    ensurePost: vi.fn(async (id: string) => {
      const p = mocks.nodePosts[id]
      if (p) store.postCache[id] = p as CachedPost
      return !!store.postCache[id]?.address
    }),
    getEnrichment: (item: NotificationItem) => ({
      comment: item.commentSnapshot ?? store.commentCache[item.commentId ?? item.id],
    }),
  }
  return store
}

const POST = { txid: 'p1', address: 'PAuthor', c: 'Title', m: 'Body', time: 1, type: 'share' }

const notif = (over: Partial<NotificationItem>): NotificationItem => ({
  id: 'n1',
  type: 'other',
  title: '',
  time: 0,
  seen: false,
  ...over,
})

let router: Router & { push: ReturnType<typeof vi.fn> }
let onLeave: ReturnType<typeof vi.fn>

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mocks.nodeComments = {}
  mocks.nodePosts = {}
  mocks.store = makeStore()
  router = { push: vi.fn(async () => undefined) } as unknown as typeof router
  onLeave = vi.fn()
})

describe('комментарий и ответ', () => {
  it('открывает окно поста с переходом к комментарию в его ветке', async () => {
    mocks.nodePosts.p1 = POST
    await openNotification(notif({ type: 'comment', id: 'c1', shareId: 'p1', parentId: 'root1' }), {
      router,
      onLeave,
    })
    const modal = useModalStore()
    expect(modal.postModal.isOpen).toBe(true)
    expect((modal.postModal.post as unknown as { txid: string }).txid).toBe('p1')
    expect(modal.postModal.target).toEqual({ commentId: 'c1', parentId: 'root1', reply: false })
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(router.push).not.toHaveBeenCalled()
  })

  it('«Ответить» — окно сразу с формой ответа', async () => {
    mocks.nodePosts.p1 = POST
    await openNotification(notif({ type: 'comment', id: 'c1', shareId: 'p1', parentId: '' }), {
      router,
      reply: true,
    })
    expect(useModalStore().postModal.target).toEqual({
      commentId: 'c1',
      parentId: undefined,
      reply: true,
    })
  })

  it('нода поста не отдала — страница поста с комментарием и веткой в адресе', async () => {
    await openNotification(notif({ type: 'comment', id: 'c1', shareId: 'p1', parentId: 'root1' }), {
      router,
      onLeave,
      reply: true,
    })
    expect(useModalStore().postModal.isOpen).toBe(false)
    expect(router.push).toHaveBeenCalledWith({
      name: 'post',
      params: { txid: 'p1' },
      query: { commentid: 'c1', parentid: 'root1' },
      state: { reply: true },
    })
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('корневой комментарий без «Ответить» — без parentid и без state', async () => {
    await openNotification(notif({ type: 'comment', id: 'c1', shareId: 'p1', parentId: '' }), {
      router,
    })
    expect(router.push).toHaveBeenCalledWith({
      name: 'post',
      params: { txid: 'p1' },
      query: { commentid: 'c1' },
    })
  })

  it('пост не адаптировался — тоже страница поста, а не тишина', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.nodePosts.p1 = POST
    vi.mocked(adaptPostData).mockImplementationOnce(() => {
      throw new Error('bad post')
    })
    await openNotification(notif({ type: 'comment', id: 'c1', shareId: 'p1', parentId: '' }), {
      router,
      onLeave,
    })
    expect(useModalStore().postModal.isOpen).toBe(false)
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ name: 'post' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('список закрывается только после догрузки поста, а не в момент клика', async () => {
    let release!: () => void
    mocks.store!.ensurePost.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          release = () => {
            mocks.store!.postCache.p1 = POST
            resolve(true)
          }
        })
    )
    const opening = openNotification(notif({ type: 'comment', id: 'c1', shareId: 'p1' }), {
      router,
      onLeave,
    })
    await Promise.resolve()
    expect(onLeave).not.toHaveBeenCalled()
    release()
    await opening
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(useModalStore().postModal.isOpen).toBe(true)
  })
})

describe('оценка вашего комментария', () => {
  it('пост неизвестен — сначала догружает комментарий, потом ведёт к нему', async () => {
    mocks.nodeComments.my1 = { id: 'my1', postid: 'p1', parentid: 'root1' }
    mocks.nodePosts.p1 = POST
    await openNotification(notif({ type: 'rating', mesType: 'upvoteComment', commentId: 'my1' }), {
      router,
      onLeave,
    })
    expect(mocks.store!.ensureComment).toHaveBeenCalledWith('my1')
    expect(useModalStore().postModal.target).toEqual({
      commentId: 'my1',
      parentId: 'root1',
      reply: false,
    })
  })

  it('комментарий удалён с ноды — сообщает и остаётся на месте', async () => {
    await openNotification(notif({ type: 'rating', mesType: 'upvoteComment', commentId: 'gone' }), {
      router,
      onLeave,
    })
    expect(mocks.toastError).toHaveBeenCalledWith({ message: 'header.commentNotFound' })
    expect(router.push).not.toHaveBeenCalled()
    expect(useModalStore().postModal.isOpen).toBe(false)
    // Список не закрывается — пользователь остаётся там же.
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('комментарий уже в кеше — без повторной догрузки', async () => {
    mocks.store!.commentCache.my1 = { id: 'my1', postid: 'p1' }
    mocks.nodePosts.p1 = POST
    await openNotification(notif({ type: 'rating', mesType: 'upvoteComment', commentId: 'my1' }), {
      router,
    })
    expect(mocks.store!.ensureComment).not.toHaveBeenCalled()
    expect(useModalStore().postModal.isOpen).toBe(true)
  })
})

describe('пост, профиль, кошелёк, платные подписки', () => {
  it('оценка/репост поста — окно поста без перехода к комментарию', async () => {
    mocks.nodePosts.p1 = POST
    await openNotification(notif({ type: 'rating', mesType: 'upvoteShare', shareId: 'p1' }), {
      router,
    })
    expect(useModalStore().postModal.isOpen).toBe(true)
    expect(useModalStore().postModal.target).toBeNull()
  })

  it('пост недоступен — страница поста без query и state', async () => {
    await openNotification(notif({ type: 'repost', shareId: 'p1' }), { router, reply: true })
    expect(router.push).toHaveBeenCalledWith({ name: 'post', params: { txid: 'p1' }, query: {} })
  })

  it('подписка — профиль подписавшегося (адрес из снимка, если нет from)', async () => {
    await openNotification(notif({ type: 'subscribe', from: 'PFan' }), { router, onLeave })
    expect(router.push).toHaveBeenCalledWith('/PFan')
    expect(onLeave).toHaveBeenCalledTimes(1)

    await openNotification(notif({ type: 'subscribe', fromSnapshot: { address: 'PSnap' } }), {
      router,
    })
    expect(router.push).toHaveBeenLastCalledWith('/PSnap')
  })

  it('перевод и выигрыш — кошелёк', async () => {
    await openNotification(notif({ type: 'tip', shareId: 'p1' }), { router, onLeave })
    expect(router.push).toHaveBeenCalledWith({ name: 'wallets' })
    await openNotification(notif({ type: 'other', mesType: 'win' }), { router })
    expect(router.push).toHaveBeenLastCalledWith({ name: 'wallets' })
    expect(mocks.store!.ensurePost).not.toHaveBeenCalled()
  })

  it('оплата платной подписки — список своих платных подписчиков', async () => {
    await openNotification(notif({ type: 'tip', mesType: 'paidSubscription' }), {
      router,
      onLeave,
    })
    expect(router.push).toHaveBeenCalledWith({
      name: 'paid-subscriptions',
      query: { tab: 'subscribers' },
    })
  })

  it('без поста, ссылки и отправителя — никуда не ведёт и список не закрывает', async () => {
    await openNotification(notif({ type: 'other' }), { router, onLeave })
    expect(router.push).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
    expect(useModalStore().postModal.isOpen).toBe(false)
  })
})

describe('ссылка из уведомления', () => {
  const originalLocation = window.location
  let fakeLocation: { href: string }

  beforeEach(() => {
    fakeLocation = { href: 'http://localhost/' }
    Object.defineProperty(window, 'location', {
      value: fakeLocation,
      configurable: true,
      writable: true,
    })
  })
  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true,
    })
  })

  it('относительный путь — роутером', async () => {
    await openNotification(notif({ link: '/wallets/history' }), { router, onLeave })
    expect(router.push).toHaveBeenCalledWith('/wallets/history')
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('доверенный хост Bastyon — в той же вкладке', async () => {
    await openNotification(notif({ link: 'https://bastyon.com/post?s=1' }), { router })
    expect(fakeLocation.href).toBe('https://bastyon.com/post?s=1')
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  it('чужой сайт — только во внешнем окне, приложение не подменяется', async () => {
    await openNotification(notif({ link: 'http://evil.example/login' }), { router })
    expect(mocks.openExternal).toHaveBeenCalledWith('http://evil.example/login')
    expect(fakeLocation.href).toBe('http://localhost/')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('javascript: и protocol-relative — игнорируются', async () => {
    for (const link of ['javascript:alert(1)', '//evil.example/x']) {
      await openNotification(notif({ link }), { router })
    }
    expect(fakeLocation.href).toBe('http://localhost/')
    expect(mocks.openExternal).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('пост в уведомлении важнее ссылки', async () => {
    await openNotification(notif({ shareId: 'p1', link: 'https://example.com' }), { router })
    expect(mocks.openExternal).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ name: 'post' }))
  })
})
