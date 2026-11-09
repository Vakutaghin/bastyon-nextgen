import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { CONTENT_ACTIONS } from './content'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'
import { USER_WAIT_TIMEOUT_MS } from './types'

function setup(hostOverrides = {}) {
  const host = makeMockHost(hostOverrides)
  const reg = new ActionRegistry({ host, resolver: makeResolver(), actions: CONTENT_ACTIONS })
  return { reg, host }
}

describe('content actions', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  // ─── RPC fetchers ────────────────────────────────────────────────────────

  it('get.feed delegates to RPC', async () => {
    const callRpc = vi.fn(async () => ({ items: [1, 2] }))
    const { reg } = setup({ callRpc })
    const r = await reg.execute(
      'get.feed',
      TEST_APP,
      { topHeight: 100 },
      new AbortController().signal
    )
    expect(r).toEqual({ items: [1, 2] })
    const [method] = callRpc.mock.calls[0] as unknown as [string, ...unknown[]]
    expect(method).toBe('getfeed')
  })

  it('get.videos — сведения о роликах от хоста, с флагом update', async () => {
    const getVideosInfo = vi.fn(async () => [null, null])
    const { reg } = setup({ getVideosInfo })
    const r = await reg.execute(
      'get.videos',
      TEST_APP,
      { urls: ['a', 'b'], update: true },
      new AbortController().signal
    )
    expect(getVideosInfo).toHaveBeenCalledWith(['a', 'b'], true)
    expect(r).toEqual([null, null])
  })

  it('get.videos: больше 200 ссылок за раз — отказ схемы', async () => {
    const { reg } = setup()
    const urls = Array.from({ length: 201 }, (_, i) => `peertube://h/${i}`)
    await expect(
      reg.execute('get.videos', TEST_APP, { urls }, new AbortController().signal)
    ).rejects.toThrow()
  })

  // ─── navigation ──────────────────────────────────────────────────────────

  it('open.post navigates by txid', async () => {
    const openPost = vi.fn(async () => {})
    const { reg } = setup({ openPost })
    await reg.execute('open.post', TEST_APP, { txid: 't1' }, new AbortController().signal)
    expect(openPost).toHaveBeenCalledWith('t1')
  })

  it('open.donation navigates to receiver profile', async () => {
    const openDonation = vi.fn(async () => {})
    const { reg } = setup({ openDonation })
    await reg.execute(
      'open.donation',
      TEST_APP,
      { receiver: 'PR7...' },
      new AbortController().signal
    )
    expect(openDonation).toHaveBeenCalledWith('PR7...')
  })

  it('open.profile with type=address opens profile', async () => {
    const openProfile = vi.fn(async () => {})
    const { reg } = setup({ openProfile })
    await reg.execute(
      'open.profile',
      TEST_APP,
      { type: 'address', data: 'PR7...' },
      new AbortController().signal
    )
    expect(openProfile).toHaveBeenCalledWith('PR7...')
  })

  it('open.profile with unknown type throws', async () => {
    const { reg } = setup()
    await expect(
      reg.execute(
        'open.profile',
        TEST_APP,
        { type: 'garbage', data: 'x' },
        new AbortController().signal
      )
    ).rejects.toThrow(/open_profile_invalid_type/)
  })

  it('openExternalLink delegates and requires externallink permission', async () => {
    const openExternalLink = vi.fn(async () => {})
    const { reg } = setup({ openExternalLink })
    await reg.execute(
      'openExternalLink',
      TEST_APP,
      { url: 'https://example.com' },
      new AbortController().signal
    )
    expect(openExternalLink).toHaveBeenCalledWith('https://example.com')
  })

  it('openExternalLink rejects javascript: URL at schema', async () => {
    const { reg } = setup()
    await expect(
      reg.execute(
        'openExternalLink',
        TEST_APP,
        { url: 'javascript:alert(1)' },
        new AbortController().signal
      )
    ).rejects.toThrow(/invalid_params/)
  })

  // ─── sharing ─────────────────────────────────────────────────────────────

  it('share calls host with onBastyon:false', async () => {
    const share = vi.fn(async () => {})
    const { reg } = setup({ share })
    await reg.execute('share', TEST_APP, { path: 'post/123' }, new AbortController().signal)
    expect(share).toHaveBeenCalledWith(
      { path: 'post/123', url: undefined, sharing: undefined },
      { onBastyon: false, appId: TEST_APP.manifest.id, appName: TEST_APP.manifest.name }
    )
  })

  it('shareOnBastyon calls host with onBastyon:true', async () => {
    const share = vi.fn(async () => {})
    const { reg } = setup({ share })
    await reg.execute(
      'shareOnBastyon',
      TEST_APP,
      { path: 'post/123' },
      new AbortController().signal
    )
    expect(share).toHaveBeenCalledWith(
      { path: 'post/123', url: undefined, sharing: undefined },
      { onBastyon: true, appId: TEST_APP.manifest.id, appName: TEST_APP.manifest.name }
    )
  })

  // ─── complain ────────────────────────────────────────────────────────────

  it('complain — окно жалобы хоста с именем приложения', async () => {
    const openComplain = vi.fn(async () => {})
    const { reg } = setup({ openComplain })
    const data = { entityLink: '/application?id=x', entityTxid: 't', entityType: 'offer' }
    await reg.execute('complain', TEST_APP, data, new AbortController().signal)
    expect(openComplain).toHaveBeenCalledWith(data, TEST_APP.manifest.name, expect.any(AbortSignal))
  })

  it('complain ждёт человека дольше общего тайм-аута моста', () => {
    const { reg } = setup()
    expect(reg.timeoutFor('complain')).toBe(USER_WAIT_TIMEOUT_MS)
  })

  // ─── pending actions ─────────────────────────────────────────────────────

  it('getaction без id — null, как у прежнего клиента (SDK id не шлёт)', async () => {
    const getAppAction = vi.fn(async () => ({ id: 'x' }))
    const { reg } = setup({ getAppAction })
    const r = await reg.execute('getaction', TEST_APP, undefined, new AbortController().signal)
    expect(r).toBeNull()
    expect(getAppAction).not.toHaveBeenCalled()
  })

  it('getaction с id — действие этого приложения', async () => {
    const getAppAction = vi.fn(async () => ({ id: 'x', transaction: 'tx' }))
    const { reg } = setup({ getAppAction })
    const r = await reg.execute('getaction', TEST_APP, { id: 'x' }, new AbortController().signal)
    expect(r).toEqual({ id: 'x', transaction: 'tx' })
    expect(getAppAction).toHaveBeenCalledWith(TEST_APP.manifest.id, 'x')
  })

  it('getactions — действия этого приложения', async () => {
    const list = [{ id: 'a' }, { id: 'b' }]
    const getAppActions = vi.fn(async () => list)
    const { reg } = setup({ getAppActions })
    const r = await reg.execute('getactions', TEST_APP, undefined, new AbortController().signal)
    expect(r).toEqual(list)
    expect(getAppActions).toHaveBeenCalledWith(TEST_APP.manifest.id)
  })
})
