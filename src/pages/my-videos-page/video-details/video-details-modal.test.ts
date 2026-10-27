// Окно ролика: «Сведения» — поля с сервера, «Сохранить» только после правки,
// закрыть с правками — переспросить; «Статистика» грузится, когда её открыли,
// и показывает цифры, график и таблицу; посты открываются, ролик удаляется.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const api = vi.hoisted(() => ({
  details: vi.fn(),
  description: vi.fn(async () => 'Летом на побережье'),
  update: vi.fn(async () => {}),
  overall: vi.fn(async () => ({
    averageWatchTime: 75,
    totalWatchTime: 3900,
    totalViewers: 52,
    viewersPeak: 3,
    viewersPeakDate: null,
    countries: [
      { isoCode: 'RU', viewers: 40 },
      { isoCode: 'DE', viewers: 12 },
    ],
  })),
  timeserie: vi.fn(async () => ({
    groupInterval: '1 day',
    data: [
      { date: '2026-10-26T00:00:00.000Z', value: 10 },
      { date: '2026-10-27T00:00:00.000Z', value: 42 },
    ],
  })),
  retention: vi.fn(async () => [
    { second: 0, retentionPercent: 100 },
    { second: 30, retentionPercent: 60 },
    { second: 60, retentionPercent: 20 },
  ]),
}))

vi.mock('@/services/peertube/peertube-video-studio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getInstanceVideoDetails: api.details,
  getInstanceVideoDescription: api.description,
  updateInstanceVideo: api.update,
  getVideoStatsOverall: api.overall,
  getVideoStatsTimeserie: api.timeserie,
  getVideoStatsRetention: api.retention,
}))
vi.mock('../video-server-token', () => ({ useVideoServerToken: () => async () => 'AT' }))
vi.mock('@/services/peertube/peertube-videos', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getVideosInfo: vi.fn(async () => new Map()),
}))

import VideoDetailsModal from './video-details-modal.vue'

const VIDEO = {
  host: 'pt.host',
  id: 42,
  uuid: 'u1',
  name: 'Море',
  description: 'Летом',
  pointer: 'peertube://pt.host/u1',
  thumbnailUrl: null,
  duration: 61,
  views: 7,
  isAudio: false,
  processing: false,
  posted: true,
  posts: [{ txid: 'p1', caption: 'Море в октябре', time: 1_700_000_000_000 }],
  time: 0,
}

let wrapper: VueWrapper | null = null
const body = () => document.body
const buttonIn = (root: Element, label: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)

async function mountModal(initialTab: 'details' | 'stats' = 'details') {
  wrapper = mount(VideoDetailsModal, {
    attachTo: document.body,
    props: { video: { ...VIDEO }, initialTab },
    global: { plugins: [i18n], provide: { theme: {} } },
  })
  await flushPromises()
}

describe('VideoDetailsModal', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    api.details.mockResolvedValue({
      id: 42,
      uuid: 'u1',
      name: 'Море',
      duration: 61,
      views: 7,
      isAudio: false,
      aspectRatio: 1.7778,
      stateId: 1,
      createdAt: '2026-10-01T10:00:00.000Z',
      thumbnailPath: '/static/thumbnails/a.jpg',
      previewPath: '/lazy-static/previews/a.jpg',
      files: [{ label: '720p', height: 720, size: 31_457_280, fileUrl: 'https://pt.host/f.mp4' }],
    })
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('сведения с сервера; «Сохранить» — только после правки, уходит изменённое', async () => {
    await mountModal()
    const name = body().querySelector<HTMLInputElement>('#video-details-name')!
    const description = body().querySelector<HTMLTextAreaElement>('#video-details-description')!
    expect(name.value).toBe('Море')
    expect(description.value).toBe('Летом на побережье')
    expect(body().textContent).toContain('720p')
    expect(body().textContent).toContain('30 МБ в 720p')
    expect(body().textContent).toContain('Море в октябре')

    const save = buttonIn(body(), 'Сохранить')!
    expect(save.disabled).toBe(true)
    name.value = 'Море осенью'
    name.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(body().textContent).toContain('Есть несохранённые изменения')
    expect(save.disabled).toBe(false)
    save.click()
    await flushPromises()
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', changes: { name: 'Море осенью' } })
    )
    expect(wrapper!.emitted('changed')).toContainEqual([{ name: 'Море осенью' }])
  })

  it('закрыть с несохранённым — переспросить; без правок — сразу', async () => {
    await mountModal()
    const close = body().querySelector<HTMLButtonElement>('.ant-modal-close')!
    close.click()
    await flushPromises()
    expect(wrapper!.emitted('close')).toHaveLength(1)

    const name = body().querySelector<HTMLInputElement>('#video-details-name')!
    name.value = 'Другое'
    name.dispatchEvent(new Event('input'))
    await flushPromises()
    close.click()
    await flushPromises()
    expect(wrapper!.emitted('close')).toHaveLength(1)
    expect(body().querySelector('.ant-modal-confirm')?.textContent).toContain(
      'Закрыть без сохранения?'
    )
  })

  it('пост открывается из окна; «Удалить ролик» — наверх', async () => {
    await mountModal()
    const post = Array.from(body().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Море в октябре')
    )!
    post.click()
    expect(wrapper!.emitted('open-post')).toEqual([['p1']])
    buttonIn(body(), 'Удалить ролик')!.click()
    expect(wrapper!.emitted('remove')).toHaveLength(1)
  })

  it('статистика грузится, только когда её открыли: цифры, страны, таблица', async () => {
    await mountModal()
    expect(api.overall).not.toHaveBeenCalled()
    Array.from(body().querySelectorAll('[role="tab"]'))
      .find((tab) => tab.textContent?.includes('Статистика'))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(api.overall).toHaveBeenCalled()
    const text = body().textContent ?? ''
    expect(text).toContain('52')
    expect(text).toContain('1 ч 5 мин')
    expect(text).toContain('Россия')
    expect(text).toContain('Удержание аудитории')
    const rows = Array.from(body().querySelectorAll('table'))[0]!.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[1]!.textContent).toContain('42')
  })
})
