import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePermissionsStore } from './permissions-store'
import { seedPreinstalledGrants } from './apps-permission-sync'
import { createMemoryStore, type KeyValueStore } from '../storage/key-value-store'
import type { BuiltInApp } from '../registry/built-in'

const BUILT_IN: BuiltInApp = {
  id: 'barteron.pocketnet.app',
  scope: 'barteron.club',
  name: 'Barteron',
  version: '1.0.0',
  cantdelete: true,
  grantedPermissions: ['account', 'chat'],
}

/** Новый «запуск приложения» поверх того же KV — как после перезагрузки. */
async function boot(kv: KeyValueStore) {
  setActivePinia(createPinia())
  const store = usePermissionsStore()
  store.configure({ kv })
  await store.init()
  await seedPreinstalledGrants(store, BUILT_IN)
  return store
}

describe('seedPreinstalledGrants', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('выдаёт предустановленные разрешения при первом запуске', async () => {
    const store = await boot(createMemoryStore())

    expect(store.stateOf(BUILT_IN.id, 'account')).toBe('granted')
    expect(store.forApp(BUILT_IN.id)[0]?.source).toBe('preinstalled')
  })

  it('пишет origin built-in в грант (V24)', async () => {
    const store = await boot(createMemoryStore())

    expect(store.forApp(BUILT_IN.id).every((g) => g.origin === 'https://barteron.club')).toBe(true)
  })

  // S45: без маркера «уже засеяно» отзыв откатывался на следующем запуске.
  it('не возвращает разрешение, отозванное пользователем', async () => {
    const kv = createMemoryStore()
    const first = await boot(kv)
    await first.revoke(BUILT_IN.id, 'chat')

    const second = await boot(kv)
    expect(second.stateOf(BUILT_IN.id, 'chat')).toBeNull()
    expect(second.stateOf(BUILT_IN.id, 'account')).toBe('granted')
  })

  it('не возвращает разрешения после «отозвать все»', async () => {
    const kv = createMemoryStore()
    const first = await boot(kv)
    await first.revokeAll(BUILT_IN.id)

    const second = await boot(kv)
    expect(second.forApp(BUILT_IN.id)).toHaveLength(0)
  })

  it('не перезаписывает явный отказ пользователя', async () => {
    const kv = createMemoryStore()
    const first = await boot(kv)
    await first.set(BUILT_IN.id, 'chat', 'denied', 'user', 'https://barteron.club')

    const second = await boot(kv)
    expect(second.stateOf(BUILT_IN.id, 'chat')).toBe('denied')
  })
})
