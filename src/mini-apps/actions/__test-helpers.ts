/**
 * Shared test fixtures для actions/* тестов.
 */

import { vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { InstalledApp } from '../types/app'
import type { ParsedManifest } from '../types/manifest'
import { usePermissionsStore } from '../store/permissions-store'
import { createMemoryStore } from '../storage/key-value-store'
import { PermissionResolver } from '../core/permission-resolver'
import type { HostContext } from './host-context'

export const TEST_APP: InstalledApp = {
  manifest: {
    id: 'test.app',
    name: 'Test App',
    version: 1_000_000,
    versionText: '1.0.0',
    description: '',
    descriptions: {},
    author: 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM',
    develop: false,
    permissions: [],
  } as ParsedManifest,
  scope: 'test.app.com',
  icon: '',
  source: 'built-in',
  installedAt: 0,
}

export const FAKE_SIGNATURE = {
  nonce: 'date=2026-01-01T00:00:00.000Z,exp=360,s=deadbeef',
  signature: 'aa'.repeat(32),
  pubkey: 'bb'.repeat(33),
  address: 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM',
  v: 1 as const,
}

export function makeMockHost(overrides: Partial<HostContext> = {}): HostContext {
  return {
    appVersion: '1.0.0',
    isProduction: false,
    device: 'browser',
    transactionsApiVersion: 8,
    getLocale: () => 'en',
    getTheme: () => ({ rootid: 'light' }),
    getMarginTop: () => '0px',
    isTorActive: () => false,
    isUserAuthenticated: () => true,
    getUserAddress: () => 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM',
    getUserWalletAddresses: () => ['Pwallet0', 'Pwallet1', 'Pwallet2'],
    getProject: () => ({
      url: 'bastyon.com',
      name: 'Bastyon',
      protocol: 'bastyon',
      archivedPeertubeServers: [],
    }),
    navigate: vi.fn(),
    showAlert: vi.fn(async () => {}),
    openSettings: vi.fn(async () => {}),
    openRegistration: vi.fn(async () => {}),
    openProfile: vi.fn(async () => {}),
    getGeolocation: vi.fn(async () => ({ latitude: 0, longitude: 0 })),
    fetchCurrencyRates: vi.fn(async () => ({})),
    signApiMessage: vi.fn(() => FAKE_SIGNATURE),
    getCurrentAccountStatus: vi.fn(() => undefined),
    callRpc: vi.fn(async () => null),
    getUserBalance: vi.fn(async () => ({})),
    getCurrentBlockHeight: vi.fn(async () => 1_000_000),
    // 5.5
    openPaymentDialog: vi.fn(async () => ({ rejected: true, reason: 'not_implemented' })),
    openExternalPayment: vi.fn(async () => {
      throw new Error('ext_payment_not_implemented')
    }),
    // 5.6
    openPost: vi.fn(async () => {}),
    openDonation: vi.fn(async () => {}),
    openExternalLink: vi.fn(async () => {}),
    share: vi.fn(async () => {}),
    openComplain: vi.fn(async () => {}),
    getPendingActions: vi.fn(() => []),
    // 5.7
    chatOpenRoom: vi.fn(async () => {}),
    chatGetOrCreateRoom: vi.fn(async () => {
      throw new Error('chat_get_or_create_not_implemented')
    }),
    chatSendMessage: vi.fn(async () => {
      throw new Error('chat_send_not_implemented')
    }),
    // 5.8
    takePhoto: vi.fn(async () => ({ images: [] })),
    ...overrides,
  }
}

export function setupTestPinia() {
  setActivePinia(createPinia())
  const perms = usePermissionsStore()
  perms.configure({ kv: createMemoryStore() })
  return { perms }
}

export function makeResolver(opts: { auto?: boolean } = {}) {
  return new PermissionResolver({
    promptUser: vi.fn().mockResolvedValue(opts.auto === false ? 'denied' : 'granted'),
  })
}
