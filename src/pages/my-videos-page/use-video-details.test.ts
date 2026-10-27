// Окно ролика, «Сведения»: что видеосервер знает о ролике, правки копятся и
// уходят по «Сохранить» — текст, потом обложка; сбой обложки не теряет текст.

import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'

import type { InstanceVideoDetails } from '@/services/peertube/peertube-video-studio'
import type { ServerVideo } from './use-server-videos'
import { framesFile, useVideoDetails, type VideoDetailsDeps } from './use-video-details'

const VIDEO: ServerVideo = {
  host: 'pt.host',
  id: 42,
  uuid: 'u1',
  name: 'Море',
  description: 'Коротко',
  pointer: 'peertube://pt.host/u1',
  thumbnailUrl: 'https://pt.host/static/thumbnails/old.jpg',
  duration: 61,
  views: 3,
  isAudio: false,
  processing: false,
  posted: true,
  posts: [],
  time: 0,
}

const DETAILS: InstanceVideoDetails = {
  id: 42,
  uuid: 'u1',
  name: 'Море',
  duration: 61,
  views: 7,
  isAudio: false,
  aspectRatio: 1.7778,
  stateId: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  thumbnailPath: '/static/thumbnails/old.jpg',
  previewPath: '/lazy-static/previews/old.jpg',
  files: [
    { label: '1080p', height: 1080, size: 50, fileUrl: 'https://pt.host/f1080.mp4' },
    { label: '720p', height: 720, size: 30, fileUrl: 'https://pt.host/f720.mp4' },
  ],
}

function setup(over: Partial<VideoDetailsDeps> = {}) {
  const defaults = {
    getDetails: vi.fn<VideoDetailsDeps['getDetails']>(async () => DETAILS),
    getDescription: vi.fn<VideoDetailsDeps['getDescription']>(async () => 'Летом на побережье'),
    update: vi.fn<VideoDetailsDeps['update']>(async () => {}),
    setCover: vi.fn<VideoDetailsDeps['setCover']>(async () => {}),
    token: vi.fn<VideoDetailsDeps['token']>(async () => 'AT'),
    refreshNode: vi.fn<VideoDetailsDeps['refreshNode']>(async () => new Map()),
  }
  // Подмены в тестах — тоже vi.fn.
  const deps = { ...defaults, ...over } as typeof defaults
  const onChanged = vi.fn()
  const scope = effectScope()
  const details = scope.run(() => useVideoDetails(ref({ ...VIDEO }), { deps, onChanged }))!
  return { details, deps, onChanged, scope }
}

describe('useVideoDetails', () => {
  it('сведения и описание целиком — с сервера; текущая обложка — превью', async () => {
    const { details, deps, onChanged } = setup()
    expect(details.status.value).toBe('loading')
    await flushPromises()
    expect(deps.getDetails).toHaveBeenCalledWith({ host: 'pt.host', id: 'u1' })
    expect(details.status.value).toBe('ready')
    expect(details.form).toEqual({ name: 'Море', description: 'Летом на побережье' })
    expect(details.cover).toMatchObject({
      url: 'https://pt.host/lazy-static/previews/old.jpg',
      source: 'current',
    })
    expect(details.framesUrl.value).toBe('https://pt.host/f720.mp4')
    expect(details.dirty.value).toBe(false)
    // Список узнаёт свежее число просмотров.
    expect(onChanged).toHaveBeenCalledWith({ views: 7 })
  })

  it('ролика нет — «нет на сервере»; сервер не ответил — ошибка и «Повторить»', async () => {
    const gone = setup({ getDetails: vi.fn(async () => null) })
    await flushPromises()
    expect(gone.details.status.value).toBe('gone')

    const failing = setup({ getDescription: vi.fn(async () => Promise.reject(new Error('x'))) })
    await flushPromises()
    expect(failing.details.status.value).toBe('error')
    failing.deps.getDescription.mockResolvedValueOnce('ok')
    await failing.details.load()
    expect(failing.details.status.value).toBe('ready')
  })

  it('пределы: название от 3 знаков, описание пустое или от 3', async () => {
    const { details } = setup()
    await flushPromises()
    details.form.name = ' Мо '
    details.form.description = 'ок'
    await nextTick()
    expect(details.nameError.value).toBe('nameShort')
    expect(details.descriptionError.value).toBe('descriptionShort')
    expect(details.canSave.value).toBe(false)
    details.form.name = 'Мор'
    details.form.description = ''
    await nextTick()
    expect(details.canSave.value).toBe(true)
  })

  it('«Сохранить»: только изменённое, пустое описание — null; список обновляется', async () => {
    const { details, deps, onChanged } = setup()
    await flushPromises()
    onChanged.mockClear()
    details.form.name = '  Море летом  '
    details.form.description = '  '
    expect(await details.save()).toBe('saved')
    expect(deps.update).toHaveBeenCalledWith({
      host: 'pt.host',
      id: 'u1',
      accessToken: 'AT',
      changes: { name: 'Море летом', description: null },
    })
    expect(deps.setCover).not.toHaveBeenCalled()
    expect(onChanged).toHaveBeenCalledWith({ name: 'Море летом', description: '' })
    expect(deps.refreshNode).toHaveBeenCalledWith('peertube://pt.host/u1')
    expect(details.dirty.value).toBe(false)
    expect(await details.save()).toBe('unchanged')
  })

  it('обложка уходит после текста; новая миниатюра — в список', async () => {
    const fresh = { ...DETAILS, thumbnailPath: '/static/thumbnails/new.jpg' }
    const { details, deps, onChanged } = setup()
    await flushPromises()
    deps.getDetails.mockResolvedValue(fresh)
    details.pickCover(new Blob(['jpg'], { type: 'image/jpeg' }), 'frame', 12)
    expect(details.cover).toMatchObject({ source: 'frame', time: 12 })
    expect(details.dirty.value).toBe(true)
    expect(await details.save()).toBe('saved')
    const [params] = deps.setCover.mock.calls[0]!
    expect(params.id).toBe('u1')
    expect(params.image.type).toBe('image/jpeg')
    expect(onChanged).toHaveBeenLastCalledWith({
      thumbnailUrl: 'https://pt.host/static/thumbnails/new.jpg',
    })
    expect(details.cover.source).toBe('current')
    expect(details.dirty.value).toBe(false)
  })

  it('текст ушёл, обложка нет — текст сохранён, обложка ждёт повторного «Сохранить»', async () => {
    const { details, deps } = setup()
    await flushPromises()
    deps.setCover.mockRejectedValueOnce(new Error('413'))
    details.form.name = 'Новое'
    details.pickCover(new Blob(['jpg']), 'image')
    expect(await details.save()).toBe('coverFailed')
    expect(details.form.name).toBe('Новое')
    expect(details.dirty.value).toBe(true)
    expect(await details.save()).toBe('saved')
    expect(deps.update).toHaveBeenCalledTimes(1)
    expect(deps.setCover).toHaveBeenCalledTimes(2)
  })

  it('менялась одна обложка и не сохранилась — просто «не сохранилось»', async () => {
    const { details, deps } = setup()
    await flushPromises()
    deps.setCover.mockRejectedValueOnce(new Error('500'))
    details.pickCover(new Blob(['jpg']), 'image')
    expect(await details.save()).toBe('failed')
  })

  it('«Отменить изменения» возвращает текст и текущую обложку', async () => {
    const { details } = setup()
    await flushPromises()
    details.form.name = 'Другое'
    details.pickCover(new Blob(['jpg']), 'image')
    details.reset()
    expect(details.form.name).toBe('Море')
    expect(details.cover.source).toBe('current')
    expect(details.dirty.value).toBe(false)
  })

  it('у звука кадров нет', async () => {
    const { details } = setup({ getDetails: vi.fn(async () => ({ ...DETAILS, isAudio: true })) })
    await flushPromises()
    expect(details.cover.audio).toBe(true)
    expect(details.framesUrl.value).toBeNull()
  })
})

describe('framesFile', () => {
  it('лучший не выше 720p; все выше — самый лёгкий; звук — нет', () => {
    expect(framesFile(DETAILS.files)?.height).toBe(720)
    expect(
      framesFile([
        { label: '2160p', height: 2160, size: 9, fileUrl: 'a' },
        { label: '1080p', height: 1080, size: 5, fileUrl: 'b' },
      ])?.height
    ).toBe(1080)
    expect(framesFile([{ label: 'Audio', height: 0, size: 1, fileUrl: 'a' }])).toBeNull()
  })
})
