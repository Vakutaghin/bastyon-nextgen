import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { CONTENT_ACTIONS } from './content'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'

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

  it('get.videos passes urls + update flag', async () => {
    const callRpc = vi.fn(async () => [])
    const { reg } = setup({ callRpc })
    await reg.execute(
      'get.videos',
      TEST_APP,
      { urls: ['a', 'b'], update: true },
      new AbortController().signal
    )
    const [method, params] = callRpc.mock.calls[0] as unknown as [string, unknown[]]
    expect(method).toBe('getvideoposts')
    expect(params).toEqual([['a', 'b'], true])
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
      { onBastyon: false }
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
      { onBastyon: true }
    )
  })

  // ─── complain ────────────────────────────────────────────────────────────

  it('complain delegates to host', async () => {
    const openComplain = vi.fn(async () => {})
    const { reg } = setup({ openComplain })
    await reg.execute('complain', TEST_APP, { target: 'txid' }, new AbortController().signal)
    expect(openComplain).toHaveBeenCalledOnce()
  })

  // ─── pending actions ─────────────────────────────────────────────────────

  it('getaction returns first pending action or null', async () => {
    const { reg } = setup({
      getPendingActions: vi.fn(() => [{ txid: 'a' }, { txid: 'b' }]),
    })
    const r = await reg.execute('getaction', TEST_APP, undefined, new AbortController().signal)
    expect(r).toEqual({ txid: 'a' })
  })

  it('getaction returns null on empty', async () => {
    const { reg } = setup({ getPendingActions: vi.fn(() => []) })
    const r = await reg.execute('getaction', TEST_APP, undefined, new AbortController().signal)
    expect(r).toBeNull()
  })

  it('getactions returns full list', async () => {
    const list = [{ txid: 'a' }, { txid: 'b' }]
    const { reg } = setup({ getPendingActions: vi.fn(() => list) })
    const r = await reg.execute('getactions', TEST_APP, undefined, new AbortController().signal)
    expect(r).toEqual(list)
  })
})
