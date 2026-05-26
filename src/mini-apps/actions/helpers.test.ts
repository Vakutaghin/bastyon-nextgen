import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { HELPER_ACTIONS } from './helpers'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'

function setup(hostOverrides = {}, resolverOpts = {}) {
  const host = makeMockHost(hostOverrides)
  const resolver = makeResolver(resolverOpts)
  const reg = new ActionRegistry({ host, resolver, actions: HELPER_ACTIONS })
  return { reg, host, resolver }
}

describe('helper actions', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  // ─── appinfo ──────────────────────────────────────────────────────────────

  describe('appinfo', () => {
    it('returns complete metadata bundle', async () => {
      const { reg } = setup()
      const r = (await reg.execute('appinfo', TEST_APP, {}, new AbortController().signal)) as {
        device: string
        version: string
        production: boolean
        locale: string
        theme: { rootid: string }
        application: { id: string }
        project: { url: string }
        transactionsApiVersion: number
        alttransport: boolean
        pkoin: boolean
        margintop: string
      }

      expect(r.device).toBe('browser')
      expect(r.version).toBe('1.0.0')
      expect(r.production).toBe(false)
      expect(r.locale).toBe('en')
      expect(r.theme.rootid).toBe('light')
      expect(r.application.id).toBe('test.app')
      expect(r.project.url).toBe('bastyon.com')
      expect(r.transactionsApiVersion).toBe(8)
      expect(r.alttransport).toBe(false)
      expect(r.pkoin).toBe(true)
      expect(r.margintop).toBe('0px')
    })

    it('reflects tor active in alttransport', async () => {
      const { reg } = setup({ isTorActive: () => true })
      const r = (await reg.execute('appinfo', TEST_APP, {}, new AbortController().signal)) as {
        alttransport: boolean
      }
      expect(r.alttransport).toBe(true)
    })

    it('reflects current theme reactively', async () => {
      const themeRef = { current: 'light' }
      const { reg } = setup({ getTheme: () => ({ rootid: themeRef.current }) })

      const r1 = (await reg.execute('appinfo', TEST_APP, {}, new AbortController().signal)) as {
        theme: { rootid: string }
      }
      expect(r1.theme.rootid).toBe('light')

      themeRef.current = 'dark'
      const r2 = (await reg.execute('appinfo', TEST_APP, {}, new AbortController().signal)) as {
        theme: { rootid: string }
      }
      expect(r2.theme.rootid).toBe('dark')
    })
  })

  // ─── alert ────────────────────────────────────────────────────────────────

  describe('alert', () => {
    it('shows message via host', async () => {
      const showAlert = vi.fn(async () => {})
      const { reg } = setup({ showAlert })
      await reg.execute('alert', TEST_APP, { message: 'hi' }, new AbortController().signal)
      expect(showAlert).toHaveBeenCalledWith('hi')
    })

    it('rejects when message missing', async () => {
      const { reg } = setup()
      await expect(
        reg.execute('alert', TEST_APP, {}, new AbortController().signal)
      ).rejects.toThrow(/invalid_params/)
    })
  })

  // ─── userstate ────────────────────────────────────────────────────────────

  describe('userstate', () => {
    it('returns authentication status', async () => {
      const { reg } = setup({ isUserAuthenticated: () => true })
      const r = await reg.execute('userstate', TEST_APP, {}, new AbortController().signal)
      expect(r).toBe(true)
    })

    it('returns false when not authed', async () => {
      const { reg } = setup({ isUserAuthenticated: () => false })
      const r = await reg.execute('userstate', TEST_APP, {}, new AbortController().signal)
      expect(r).toBe(false)
    })
  })

  // ─── currency ─────────────────────────────────────────────────────────────

  describe('currency', () => {
    it('delegates to host.fetchCurrencyRates', async () => {
      const fetchCurrencyRates = vi.fn(async () => ({ USD: { value: 0.01 } }))
      const { reg } = setup({ fetchCurrencyRates })
      const r = await reg.execute('currency', TEST_APP, {}, new AbortController().signal)
      expect(r).toEqual({ USD: { value: 0.01 } })
    })

    it('passes signal through', async () => {
      const ctrl = new AbortController()
      const fetchCurrencyRates = vi.fn(async (signal) => {
        expect(signal).toBe(ctrl.signal)
        return {}
      })
      const { reg } = setup({ fetchCurrencyRates })
      await reg.execute('currency', TEST_APP, {}, ctrl.signal)
      expect(fetchCurrencyRates).toHaveBeenCalledOnce()
    })
  })

  // ─── registration ─────────────────────────────────────────────────────────

  describe('registration', () => {
    it('opens registration via host', async () => {
      const openRegistration = vi.fn(async () => {})
      const { reg } = setup({ openRegistration })
      await reg.execute('registration', TEST_APP, {}, new AbortController().signal)
      expect(openRegistration).toHaveBeenCalledOnce()
    })
  })

  // ─── channel ──────────────────────────────────────────────────────────────

  describe('channel', () => {
    it('opens profile by address', async () => {
      const openProfile = vi.fn(async () => {})
      const { reg } = setup({ openProfile })
      await reg.execute(
        'channel',
        TEST_APP,
        { address: 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82' },
        new AbortController().signal
      )
      expect(openProfile).toHaveBeenCalledWith('PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82')
    })

    it('rejects when address missing', async () => {
      const { reg } = setup()
      await expect(
        reg.execute('channel', TEST_APP, {}, new AbortController().signal)
      ).rejects.toThrow(/invalid_params/)
    })
  })

  // ─── opensettings ─────────────────────────────────────────────────────────

  describe('opensettings', () => {
    it('opens settings via host', async () => {
      const openSettings = vi.fn(async () => {})
      const { reg } = setup({ openSettings })
      await reg.execute('opensettings', TEST_APP, {}, new AbortController().signal)
      expect(openSettings).toHaveBeenCalledOnce()
    })
  })

  // ─── geolocation ──────────────────────────────────────────────────────────

  describe('geolocation', () => {
    it('returns coordinates from host', async () => {
      const getGeolocation = vi.fn(async () => ({ latitude: 50.1, longitude: 30.5 }))
      const { reg } = setup({ getGeolocation })
      const r = await reg.execute('geolocation', TEST_APP, {}, new AbortController().signal)
      expect(r).toEqual({ latitude: 50.1, longitude: 30.5 })
    })

    it('blocks without geolocation permission (prompt denies)', async () => {
      const getGeolocation = vi.fn()
      const { reg } = setup({ getGeolocation }, { auto: false })
      await expect(
        reg.execute('geolocation', TEST_APP, {}, new AbortController().signal)
      ).rejects.toThrow(/permission_denied/)
      expect(getGeolocation).not.toHaveBeenCalled()
    })
  })
})
