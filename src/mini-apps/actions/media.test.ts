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

  // ─── images.upload / videos.* — stubs ─────────────────────────────────

  it('images.upload returns not_implemented stub', async () => {
    const { reg } = setup()
    await expect(
      reg.execute('images.upload', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/images_upload_not_implemented/)
  })

  it('videos.opendialog returns not_implemented stub', async () => {
    const { reg } = setup()
    await expect(
      reg.execute('videos.opendialog', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/videos_opendialog_not_implemented/)
  })

  it('videos.remove returns not_implemented stub', async () => {
    const { reg } = setup()
    await expect(
      reg.execute('videos.remove', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/videos_remove_not_implemented/)
  })
})
