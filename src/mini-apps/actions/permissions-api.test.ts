import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { PERMISSIONS_API_ACTIONS } from './permissions-api'
import { PermissionResolver } from '../core/permission-resolver'
import { usePermissionsStore } from '../store/permissions-store'
import { TEST_APP, makeMockHost, setupTestPinia } from './__test-helpers'

function setupReg(promptResult: 'granted' | 'denied' = 'granted') {
  const host = makeMockHost()
  const resolver = new PermissionResolver({
    promptUser: vi.fn().mockResolvedValue(promptResult),
  })
  const reg = new ActionRegistry({ host, resolver, actions: PERMISSIONS_API_ACTIONS })
  return { reg, host, resolver }
}

describe('checkPermission', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  it('returns false for not-set permission', async () => {
    const { reg } = setupReg()
    const r = await reg.execute(
      'checkPermission',
      TEST_APP,
      { permission: 'account' },
      new AbortController().signal
    )
    expect(r).toBe(false)
  })

  it('returns true when permission is granted in store', async () => {
    const store = usePermissionsStore()
    await store.set(TEST_APP.manifest.id, 'account', 'granted', 'user')
    const { reg } = setupReg()
    const r = await reg.execute(
      'checkPermission',
      TEST_APP,
      { permission: 'account' },
      new AbortController().signal
    )
    expect(r).toBe(true)
  })

  it('returns false for unknown permission name', async () => {
    const { reg } = setupReg()
    const r = await reg.execute(
      'checkPermission',
      TEST_APP,
      { permission: 'totally-fake' },
      new AbortController().signal
    )
    expect(r).toBe(false)
  })

  it('rejects empty permission name at schema', async () => {
    const { reg } = setupReg()
    await expect(
      reg.execute('checkPermission', TEST_APP, { permission: '' }, new AbortController().signal)
    ).rejects.toThrow(/invalid_params/)
  })
})

describe('requestPermissions', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  it('returns array of granted permission ids on success', async () => {
    const { reg } = setupReg('granted')
    const r = (await reg.execute(
      'requestPermissions',
      TEST_APP,
      { permissions: ['account', 'chat'] },
      new AbortController().signal
    )) as string[]

    expect(r.sort()).toEqual(['account', 'chat'])
  })

  it('rejects with notexist error for unknown permission name', async () => {
    const { reg } = setupReg()
    await expect(
      reg.execute(
        'requestPermissions',
        TEST_APP,
        { permissions: ['account', 'fakeperm'] },
        new AbortController().signal
      )
    ).rejects.toThrow(/notexist:fakeperm/)
  })

  it('rejects with uniq error for sign/payment', async () => {
    const { reg } = setupReg()
    await expect(
      reg.execute(
        'requestPermissions',
        TEST_APP,
        { permissions: ['sign'] },
        new AbortController().signal
      )
    ).rejects.toThrow(/uniq:sign/)
  })

  it('rejects when prompt denies even one', async () => {
    const { reg } = setupReg('denied')
    await expect(
      reg.execute(
        'requestPermissions',
        TEST_APP,
        { permissions: ['account'] },
        new AbortController().signal
      )
    ).rejects.toThrow(/permission:denied:account/)
  })

  it('rejects empty array', async () => {
    const { reg } = setupReg()
    await expect(
      reg.execute('requestPermissions', TEST_APP, { permissions: [] }, new AbortController().signal)
    ).rejects.toThrow(/permissions:empty/)
  })
})

describe('registerForNotifications', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  it('returns true (stub implementation)', async () => {
    const store = usePermissionsStore()
    await store.set(TEST_APP.manifest.id, 'notifications', 'granted', 'user')
    const { reg } = setupReg()
    const r = await reg.execute(
      'registerForNotifications',
      TEST_APP,
      {},
      new AbortController().signal
    )
    expect(r).toBe(true)
  })

  it('requires authorization', async () => {
    const host = makeMockHost({ isUserAuthenticated: () => false })
    const resolver = new PermissionResolver({
      promptUser: vi.fn().mockResolvedValue('granted'),
    })
    const reg = new ActionRegistry({ host, resolver, actions: PERMISSIONS_API_ACTIONS })
    await expect(
      reg.execute('registerForNotifications', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/required_authorization/)
  })

  it('requires notifications permission', async () => {
    const { reg } = setupReg('denied')
    await expect(
      reg.execute('registerForNotifications', TEST_APP, {}, new AbortController().signal)
    ).rejects.toThrow(/permission_denied/)
  })
})
