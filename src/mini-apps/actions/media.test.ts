import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { MEDIA_ACTIONS } from './media'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'

function setup(hostOverrides = {}, resolverOpts = {}) {
  const host = makeMockHost(hostOverrides)
  const resolver = makeResolver(resolverOpts)
  const reg = new ActionRegistry({ host, resolver, actions: MEDIA_ACTIONS })
  return { reg, host, resolver }
}

describe('media actions', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  // ─── mobile.camera ─────────────────────────────────────────────────────

  it('mobile.camera delegates to host.takePhoto', async () => {
    const takePhoto = vi.fn(async () => ({
      images: [{ image: 'BASE64DATA' }],
    }))
    const { reg } = setup({ takePhoto })
    const res = await reg.execute('mobile.camera', TEST_APP, {}, new AbortController().signal)
    expect(takePhoto).toHaveBeenCalled()
    expect(res).toEqual({ images: [{ image: 'BASE64DATA' }] })
  })

  it('mobile.camera surfaces unsupported error from host', async () => {
    const takePhoto = vi.fn(async () => {
      throw new Error('mobile:camera:notsupported')
    })
    const { reg } = setup({ takePhoto })
    await expect(
      reg.execute('mobile.camera', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/mobile:camera:notsupported/)
  })

  it('mobile.camera surfaces cancel from host', async () => {
    const takePhoto = vi.fn(async () => {
      throw new Error('mobile:camera:cancel')
    })
    const { reg } = setup({ takePhoto })
    await expect(
      reg.execute('mobile.camera', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/mobile:camera:cancel/)
  })

  // ─── images.upload ─────────────────────────────────────────────────────

  it('images.upload delegates to host.uploadImages and wraps into [{url}]', async () => {
    const uploadImages = vi.fn(async (imgs: string[]) => imgs.map((_, i) => `https://cdn/${i}.jpg`))
    const { reg } = setup({ uploadImages })
    const res = await reg.execute(
      'images.upload',
      TEST_APP,
      { images: ['data:image/png;base64,AAA', 'data:image/png;base64,BBB'] },
      new AbortController().signal
    )
    expect(uploadImages).toHaveBeenCalledWith([
      'data:image/png;base64,AAA',
      'data:image/png;base64,BBB',
    ])
    expect(res).toEqual([{ url: 'https://cdn/0.jpg' }, { url: 'https://cdn/1.jpg' }])
  })

  it('images.upload rejects more than 10 images', async () => {
    const { reg } = setup()
    await expect(
      reg.execute(
        'images.upload',
        TEST_APP,
        { images: Array.from({ length: 11 }, () => 'x') },
        new AbortController().signal
      )
    ).rejects.toThrow(/images:max:10/)
  })

  it('images.upload requires authorization', async () => {
    const { reg } = setup({ isUserAuthenticated: () => false })
    await expect(
      reg.execute('images.upload', TEST_APP, { images: [] }, new AbortController().signal)
    ).rejects.toThrow(/required_authorization/)
  })

  // ─── videos.remove ─────────────────────────────────────────────────────

  it('videos.remove delegates to host.removeVideo with the pointer', async () => {
    const removeVideo = vi.fn(async () => {})
    const { reg } = setup({ removeVideo })
    const res = await reg.execute(
      'videos.remove',
      TEST_APP,
      { url: 'peertube://h.app/VID' },
      new AbortController().signal
    )
    expect(removeVideo).toHaveBeenCalledWith('peertube://h.app/VID')
    expect(res).toEqual({ removed: true })
  })

  it('videos.remove without url throws', async () => {
    const { reg } = setup()
    await expect(
      reg.execute('videos.remove', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/videos:remove:no_url/)
  })

  // ─── videos.opendialog — still a stub (needs shared uploader UI) ────────

  it('videos.opendialog returns not_implemented stub', async () => {
    const { reg } = setup()
    await expect(
      reg.execute('videos.opendialog', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/videos_opendialog_not_implemented/)
  })
})
