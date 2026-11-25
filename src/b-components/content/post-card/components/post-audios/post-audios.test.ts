// Аудио-пост с несколькими записями: список, игра через очередь мини-плеера,
// продолжение с записи, на которой остановились, место и перемотка в карточке.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  state: null as unknown as Record<string, unknown>,
  toggle: vi.fn(),
  seek: vi.fn(),
  accept: vi.fn(),
  info: vi.fn(),
}))
vi.mock('@/blockchain', () => ({ useAuthStore: () => ({ getUserAddress: 'PMe' }) }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ currentRoute: { value: { name: 'home', params: {} } }, push: vi.fn() }),
}))
vi.mock('@/services/media/audio-engine', () => ({
  get audioState() {
    return mocks.state
  },
  toggle: mocks.toggle,
  seek: mocks.seek,
  acceptTorBypass: mocks.accept,
}))
vi.mock('@/services/media/media-info', () => ({ fetchMediaInfo: mocks.info }))
vi.mock('@/services/user-names', () => ({ userName: (_a: string, name: string) => name }))

import { rememberPart } from '@/services/media/audio-positions'
import { usePlaybackQueueStore } from '@/stores/playback-queue-store'
import type { AdaptedPost } from '@/types/adapted-post'
import PostAudios from './post-audios.vue'

const url = (n: number) => `peertube://pt.example/u${n}/audio`
const audiosOf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    url: url(i + 1),
    title: i === 1 ? '' : `Глава ${i + 1}`,
    duration: 60,
  }))

function render(count = 3, props: Record<string, unknown> = {}): VueWrapper {
  const audios = audiosOf(count)
  return mount(PostAudios, {
    props: {
      post: {
        txid: 'tx1',
        type: 'audio',
        title: 'Книга',
        videoUrl: url(1),
        audios,
        author: { address: 'PA', name: 'Автор' },
      } as unknown as AdaptedPost,
      audios,
      title: 'Книга',
      ...props,
    },
    global: { plugins: [i18n], provide: { theme: {} } },
  })
}

const rows = (w: VueWrapper) => w.findAll('[data-testid="post-audio-row"]')
const main = (w: VueWrapper) => w.find('[data-testid="post-audios-play"]')

beforeAll(async () => {
  await setI18nLocale('ru')
})
beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  mocks.state = reactive({
    playing: false,
    loading: false,
    position: 0,
    duration: 0,
    error: null,
    torBlocked: false,
  })
  for (const fn of [mocks.toggle, mocks.seek, mocks.accept]) fn.mockReset()
  mocks.info
    .mockReset()
    .mockResolvedValue(new Map([[url(1), { thumbnail: 'https://t/1.jpg', duration: 1, views: 0 }]]))
})

describe('PostAudios', () => {
  it('до игры: обложка, сколько записей и сколько длятся, без названия — номер', async () => {
    const w = render()
    await flushPromises()
    expect(w.find('img').attributes('src')).toBe('https://t/1.jpg')
    expect(w.text()).toContain('3 записи · 3:00')
    expect(rows(w).map((r) => r.find('.title').text())).toEqual(['Глава 1', 'Запись 2', 'Глава 3'])
    // Длительности в посте есть — у ноды спрашиваем только обложку.
    expect(mocks.info).toHaveBeenCalledWith([url(1)])
  })

  it('нажатие на запись — очередь из всего поста с неё, «Перемешать» снято', async () => {
    const w = render()
    const queue = usePlaybackQueueStore()
    queue.toggleShuffle()
    await rows(w)[1]!.trigger('click')
    expect(queue.items.map((x) => x.id)).toEqual(['tx1#u1', 'tx1#u2', 'tx1#u3'])
    expect(queue.current?.id).toBe('tx1#u2')
    expect(queue.shuffle).toBe(false)
    expect(queue.upcoming.map((x) => x.id)).toEqual(['tx1#u3'])
    expect(queue.source).toEqual({ title: 'Книга', path: '/post/tx1' })
  })

  it('играющая запись: отметка, место, перемотка; повторное нажатие — пауза', async () => {
    const w = render()
    await rows(w)[2]!.trigger('click')
    Object.assign(mocks.state, { playing: true, position: 15, duration: 60 })
    await flushPromises()
    expect(rows(w)[2]!.attributes('aria-current')).toBe('true')
    expect(w.find('.now').text()).toBe('Глава 3')
    expect(w.text()).toContain('0:15 / 1:00')
    const seek = w.find('input[type="range"]')
    ;(seek.element as HTMLInputElement).value = '40'
    await seek.trigger('input')
    expect(mocks.seek).toHaveBeenCalledWith(40)

    await rows(w)[2]!.trigger('click')
    await main(w).trigger('click')
    expect(mocks.toggle).toHaveBeenCalledTimes(2)
    expect(usePlaybackQueueStore().generation).toBe(1)
  })

  it('продолжает с записи, на которой остановились, и говорит об этом', async () => {
    rememberPart('PMe', 'tx1', 'tx1#u3')
    const w = render()
    expect(w.find('.now').text()).toBe('Продолжить: Глава 3')
    await main(w).trigger('click')
    expect(usePlaybackQueueStore().current?.id).toBe('tx1#u3')
  })

  it('включили другое — карточка помнит, на чём остановились здесь', async () => {
    const w = render()
    await rows(w)[2]!.trigger('click')
    // Мини-плеер запоминает запись, когда включает её.
    rememberPart('PMe', 'tx1', 'tx1#u3')
    usePlaybackQueueStore().clear()
    await flushPromises()
    expect(w.find('.now').text()).toBe('Продолжить: Глава 3')
  })

  it('автор убрал ту запись — с первой', async () => {
    rememberPart('PMe', 'tx1', 'tx1#gone')
    const w = render()
    await main(w).trigger('click')
    expect(usePlaybackQueueStore().current?.id).toBe('tx1#u1')
  })

  it('играет другой пост — эта карточка спокойна', async () => {
    const queue = usePlaybackQueueStore()
    const item = {
      type: 'audio' as const,
      url: url(9),
      title: 'x',
      artist: '',
      address: '',
      cover: null,
      duration: 1,
    }
    queue.play([{ ...item, id: 'tx2#u9', postId: 'tx2' }])
    Object.assign(mocks.state, { playing: true })
    const w = render()
    expect(w.find('input[type="range"]').exists()).toBe(false)
    expect(main(w).attributes('aria-label')).toBe('Играть')
  })

  it('длинный список свёрнут, «Показать все» раскрывает; на странице поста — весь', async () => {
    const w = render(12)
    expect(rows(w)).toHaveLength(5)
    await w
      .findAll('button')
      .find((b) => b.text() === 'Показать все: 12')!
      .trigger('click')
    expect(rows(w)).toHaveLength(12)
    expect(rows(render(12, { expanded: true }))).toHaveLength(12)
    // Одна лишняя строка не прячется.
    expect(rows(render(6))).toHaveLength(6)
  })

  it('играющая запись видна и в свёрнутом списке', async () => {
    rememberPart('PMe', 'tx1', 'tx1#u8')
    const w = render(12)
    await main(w).trigger('click')
    expect(rows(w)).toHaveLength(8)
    expect(rows(w)[7]!.attributes('aria-current')).toBe('true')
  })

  it('пост открыли «играть» — начинает сам', () => {
    render(3, { autoplay: true })
    expect(usePlaybackQueueStore().current?.id).toBe('tx1#u1')
  })

  it('сбой и Tor — в карточке: мини-плеер бывает закрыт окном поста', async () => {
    const w = render()
    await rows(w)[0]!.trigger('click')
    Object.assign(mocks.state, { torBlocked: true })
    await flushPromises()
    const ok = w.findAll('button').find((b) => b.text() === i18n.global.t('torMedia.audioBypassOk'))
    await ok!.trigger('click')
    expect(mocks.accept).toHaveBeenCalled()
    Object.assign(mocks.state, { torBlocked: false, error: 'Сервер не отвечает' })
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toBe('Сервер не отвечает')
  })
})
