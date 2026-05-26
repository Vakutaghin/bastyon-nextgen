import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { ACCOUNT_ACTIONS } from './account'
import {
  TEST_APP,
  makeMockHost,
  setupTestPinia,
  makeResolver,
  FAKE_SIGNATURE,
} from './__test-helpers'

function setup(hostOverrides = {}, resolverOpts = {}) {
  const host = makeMockHost(hostOverrides)
  const resolver = makeResolver(resolverOpts)
  const reg = new ActionRegistry({ host, resolver, actions: ACCOUNT_ACTIONS })
  return { reg, host, resolver }
}

describe('account action', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  it('returns address + signature + status', async () => {
    const { reg, host } = setup()
    const r = (await reg.execute('account', TEST_APP, {}, new AbortController().signal)) as {
      address: string
      signature: typeof FAKE_SIGNATURE
      status: unknown
    }

    expect(r.address).toBe('PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM')
    expect(r.signature).toEqual(FAKE_SIGNATURE)
    expect(host.signApiMessage).toHaveBeenCalledWith('test.app')
    expect(host.getCurrentAccountStatus).toHaveBeenCalledOnce()
  })

  it('requires authorization', async () => {
    const { reg } = setup({ isUserAuthenticated: () => false })
    await expect(
      reg.execute('account', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/required_authorization/)
  })

  it('requires account permission (denied → permission_denied)', async () => {
    const { reg } = setup({}, { auto: false })
    await expect(
      reg.execute('account', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/permission_denied/)
  })

  it('throws not_authenticated if signing returns null', async () => {
    const { reg } = setup({ getUserAddress: () => null })
    await expect(
      reg.execute('account', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/not_authenticated/)
  })
})

describe('sign action', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  it('signs <manifest.id> when no string param', async () => {
    const { reg, host } = setup()
    const r = await reg.execute('sign', TEST_APP, {}, new AbortController().signal)
    expect(r).toEqual(FAKE_SIGNATURE)
    expect(host.signApiMessage).toHaveBeenCalledWith('test.app')
  })

  it('signs <string>/<manifest.id> when string param given', async () => {
    const { reg, host } = setup()
    await reg.execute(
      'sign',
      TEST_APP,
      { string: 'login-challenge-42' },
      new AbortController().signal
    )
    expect(host.signApiMessage).toHaveBeenCalledWith('login-challenge-42/test.app')
  })

  it('throws not_authenticated when signing impossible', async () => {
    const { reg } = setup({ signApiMessage: vi.fn(() => null) })
    await expect(reg.execute('sign', TEST_APP, {}, new AbortController().signal)).rejects.toThrow(
      /not_authenticated/
    )
  })
})

describe('zaddress action', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  it('throws broken:zaddresses (feature deferred in nextgen)', async () => {
    const { reg } = setup()
    await expect(
      reg.execute('zaddress', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/broken:zaddresses/)
  })

  it('still requires authorization (gate before throw)', async () => {
    const { reg } = setup({ isUserAuthenticated: () => false })
    await expect(
      reg.execute('zaddress', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/required_authorization/)
  })
})

describe('authFetch action', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setupTestPinia()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs JSON with signature appended to body', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: 'ok' }) })
    const { reg } = setup()
    const r = await reg.execute(
      'authFetch',
      TEST_APP,
      { url: 'https://api.miniapp.com/me', data: { hello: 'world' } },
      new AbortController().signal
    )

    expect(r).toEqual({ result: 'ok' })
    expect(fetchMock).toHaveBeenCalledOnce()
    const firstCall = fetchMock.mock.calls[0]!
    const [url, init] = firstCall as [string, RequestInit]
    expect(url).toBe('https://api.miniapp.com/me')
    expect(init.method).toBe('POST')
    const sentBody = JSON.parse(init.body as string)
    expect(sentBody.hello).toBe('world')
    expect(sentBody.signature).toEqual(FAKE_SIGNATURE)
  })

  it('uses new signature format by default', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    const { reg, host } = setup()
    await reg.execute(
      'authFetch',
      TEST_APP,
      { url: 'https://api.miniapp.com/x' },
      new AbortController().signal
    )
    expect(host.signApiMessage).toHaveBeenCalledWith('test.app', { useOldFormat: false })
  })

  it('switches to legacy format when useOldFormat:true', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    const { reg, host } = setup()
    await reg.execute(
      'authFetch',
      TEST_APP,
      { url: 'https://api.miniapp.com/x', useOldFormat: true },
      new AbortController().signal
    )
    expect(host.signApiMessage).toHaveBeenCalledWith('test.app', { useOldFormat: true })
  })

  it('throws on non-2xx response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
    const { reg } = setup()
    await expect(
      reg.execute(
        'authFetch',
        TEST_APP,
        { url: 'https://api.miniapp.com/x' },
        new AbortController().signal
      )
    ).rejects.toThrow(/authFetch_http_403/)
  })

  it('rejects non-http(s) url at schema validation', async () => {
    const { reg } = setup()
    await expect(
      reg.execute(
        'authFetch',
        TEST_APP,
        { url: 'javascript:alert(1)' },
        new AbortController().signal
      )
    ).rejects.toThrow(/invalid_params/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes abort signal to fetch', async () => {
    const ctrl = new AbortController()
    fetchMock.mockImplementation(async (_url, init) => {
      expect(init.signal).toBe(ctrl.signal)
      return { ok: true, json: async () => ({}) }
    })
    const { reg } = setup()
    await reg.execute('authFetch', TEST_APP, { url: 'https://api.miniapp.com/x' }, ctrl.signal)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
