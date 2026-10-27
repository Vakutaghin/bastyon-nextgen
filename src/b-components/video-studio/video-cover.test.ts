// Обложка видео: по умолчанию первый кадр, выбор человека важнее; сервер
// получает её, когда видео загружено, и каждый следующий выбор — по очереди.

import { describe, expect, it, vi } from 'vitest'

import { createVideoCover, type VideoCoverTarget } from './video-cover'

const VIDEO = new File([new Uint8Array(4)], 'clip.mp4', { type: 'video/mp4' })
const TARGET: VideoCoverTarget = { host: 'pt.host', uuid: 'uuid1' }
const jpeg = (label: string) => new Blob([label], { type: 'image/jpeg' })
const flush = () => new Promise((r) => setTimeout(r, 0))

/** Сохранение, которое тест отпускает сам. */
function controllableSave() {
  const calls: { target: VideoCoverTarget; image: File; done: (ok: boolean) => void }[] = []
  const save = vi.fn(
    (target: VideoCoverTarget, image: File) =>
      new Promise<void>((resolve, reject) => {
        calls.push({
          target,
          image,
          done: (ok) => (ok ? resolve() : reject(new Error('peertube_video_cover_500'))),
        })
      })
  )
  return { save, calls }
}

describe('createVideoCover', () => {
  it('первый кадр — обложка по умолчанию, ждёт загрузки видео', async () => {
    const { save, calls } = controllableSave()
    const cover = createVideoCover({ save, firstFrame: async () => jpeg('first') })
    cover.begin(VIDEO)
    expect(cover.state.busy).toBe(true)
    await flush()
    expect(cover.state).toMatchObject({ source: 'first', time: 0, status: 'pending', busy: false })
    expect(cover.state.url).toMatch(/^blob:/)
    expect(save).not.toHaveBeenCalled()

    cover.attach(TARGET)
    expect(cover.state).toMatchObject({ status: 'saving', busy: true })
    expect(calls[0]!.target).toEqual(TARGET)
    expect(calls[0]!.image).toMatchObject({ name: 'cover.jpg', type: 'image/jpeg' })
    expect(await calls[0]!.image.text()).toBe('first')
    calls[0]!.done(true)
    await flush()
    expect(cover.state).toMatchObject({ status: 'saved', busy: false })
  })

  it('кадр не снялся — обложку выбирает сервер, сохранять нечего', async () => {
    const { save } = controllableSave()
    const cover = createVideoCover({ save, firstFrame: async () => null })
    cover.begin(VIDEO)
    cover.attach(TARGET)
    await cover.flush()
    expect(cover.state).toMatchObject({ status: 'none', source: null, url: '' })
    expect(save).not.toHaveBeenCalled()
  })

  it('выбор человека не затирается поздним первым кадром', async () => {
    let grab: (b: Blob) => void = () => {}
    const { save } = controllableSave()
    const cover = createVideoCover({
      save,
      firstFrame: () => new Promise<Blob>((resolve) => (grab = resolve)),
    })
    cover.begin(VIDEO)
    cover.set(jpeg('mine'), 'image')
    grab(jpeg('first'))
    await flush()
    expect(cover.state.source).toBe('image')
  })

  it('новый выбор во время сохранения уходит следом; последним остаётся последний', async () => {
    const { save, calls } = controllableSave()
    const cover = createVideoCover({ save, firstFrame: async () => null })
    cover.attach(TARGET)
    cover.set(jpeg('a'), 'frame', 3)
    cover.set(jpeg('b'), 'frame', 7)
    cover.set(jpeg('c'), 'frame', 12)
    // Одно сохранение за раз.
    expect(calls).toHaveLength(1)
    calls[0]!.done(true)
    await flush()
    expect(calls).toHaveLength(2)
    expect(await calls[1]!.image.text()).toBe('c')
    expect(cover.state.status).toBe('saving')
    calls[1]!.done(true)
    await cover.flush()
    expect(cover.state).toMatchObject({ status: 'saved', source: 'frame', time: 12, busy: false })
  })

  it('сбой — «Повторить» отправляет ту же обложку', async () => {
    const { save, calls } = controllableSave()
    const cover = createVideoCover({ save, firstFrame: async () => null })
    cover.set(jpeg('a'), 'frame', 3)
    cover.attach(TARGET)
    calls[0]!.done(false)
    await flush()
    expect(cover.state.status).toBe('error')
    cover.retry()
    expect(calls).toHaveLength(2)
    expect(await calls[1]!.image.text()).toBe('a')
    calls[1]!.done(true)
    await cover.flush()
    expect(cover.state.status).toBe('saved')
  })

  it('flush ждёт и снимок первого кадра, и сохранение', async () => {
    const save = vi.fn(async () => {})
    const cover = createVideoCover({ save, firstFrame: async () => jpeg('first') })
    cover.attach(TARGET)
    cover.begin(VIDEO)
    await cover.flush()
    expect(save).toHaveBeenCalledTimes(1)
    expect(cover.state.status).toBe('saved')
  })

  it('dispose освобождает картинку и больше ничего не принимает', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const cover = createVideoCover({ save: vi.fn(async () => {}), firstFrame: async () => null })
    cover.set(jpeg('a'), 'image')
    const url = cover.state.url
    cover.dispose()
    expect(revoke).toHaveBeenCalledWith(url)
    expect(cover.state.url).toBe('')
    cover.set(jpeg('b'), 'image')
    expect(cover.state.url).toBe('')
    revoke.mockRestore()
  })

  it('своей обложки нет — после загрузки видна та, что сделал сервер; своя её заменяет', async () => {
    const { save, calls } = controllableSave()
    const serverCover = vi.fn(async () => 'https://pt.host/lazy-static/previews/x.jpg')
    const cover = createVideoCover({ save, firstFrame: async () => null, serverCover })
    cover.begin(VIDEO)
    await flush()
    cover.attach(TARGET)
    await flush()
    expect(serverCover).toHaveBeenCalledWith(TARGET)
    expect(cover.state).toMatchObject({
      source: 'server',
      status: 'none',
      url: 'https://pt.host/lazy-static/previews/x.jpg',
    })
    expect(save).not.toHaveBeenCalled()

    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    cover.set(jpeg('mine'), 'image')
    expect(revoke).not.toHaveBeenCalled()
    expect(cover.state).toMatchObject({ source: 'image', status: 'saving' })
    expect(calls).toHaveLength(1)
    revoke.mockRestore()
  })

  it('звук: кадр не снимается, картинку свою можно', async () => {
    const firstFrame = vi.fn(async () => jpeg('frame'))
    const save = vi.fn(async () => {})
    const cover = createVideoCover({ save, firstFrame }, { audio: true })
    cover.begin(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    expect(firstFrame).not.toHaveBeenCalled()
    expect(cover.state).toMatchObject({ audio: true, status: 'none', busy: false })
    cover.set(jpeg('art'), 'image')
    cover.attach(TARGET, { audio: true })
    await cover.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('сервер сказал «это звук» — снятый «кадр» не отправляется, обложку берёт сервер', async () => {
    const save = vi.fn(async () => {})
    const serverCover = vi.fn(async () => 'https://pt.host/art.jpg')
    const cover = createVideoCover({ save, firstFrame: async () => jpeg('first'), serverCover })
    cover.begin(VIDEO)
    await flush()
    expect(cover.state.source).toBe('first')
    cover.attach(TARGET, { audio: true })
    await flush()
    expect(save).not.toHaveBeenCalled()
    expect(cover.state).toMatchObject({
      audio: true,
      source: 'server',
      url: 'https://pt.host/art.jpg',
    })
  })
})
