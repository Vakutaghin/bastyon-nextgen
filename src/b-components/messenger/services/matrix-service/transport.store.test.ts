// Кэш синка Matrix переживает перезапуск: хранилище поднимается после передачи
// клиенту. Раньше startup шёл до клиента и падал на сохранённых событиях
// присутствия — со второго запуска кэш всегда откатывался в память.
// Настоящий IndexedDBStore matrix-js-sdk поверх fake-indexeddb.

import 'fake-indexeddb/auto'
import { createClient, MatrixEvent, User } from 'matrix-js-sdk'
import { describe, expect, it, vi } from 'vitest'

import { createIndexedDbStore, startIndexedDbStore } from './transport'

const ME = '@me:matrix.pocketnet.app'

function launch() {
  const store = createIndexedDbStore(ME)!
  const client = createClient({ baseUrl: 'http://matrix.test', userId: ME, store })
  return { store, client }
}

describe('кэш синка Matrix', () => {
  it('поднимается и на следующем запуске, когда в базе уже есть присутствие', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = launch()
    expect(await startIndexedDbStore(first.store)).toBe(true)
    const ann = User.createUser('@ann:matrix.pocketnet.app', first.client)
    ann.setPresenceEvent(
      new MatrixEvent({
        type: 'm.presence',
        sender: '@ann:matrix.pocketnet.app',
        content: { presence: 'online' },
      })
    )
    first.store.storeUser(ann)
    await first.store.save(true)
    await first.store.destroy()

    // Старый порядок — startup до клиента — на такой базе падает.
    const early = createIndexedDbStore(ME)!
    await expect(early.startup()).rejects.toThrow(/after assigning it to the client/)
    await early.destroy()

    const second = launch()
    expect(await startIndexedDbStore(second.store)).toBe(true)
    expect(second.store.getUser('@ann:matrix.pocketnet.app')?.presence).toBe('online')
    await second.store.destroy()
  })

  it('не поднялось — база закрыта, вызывающий берёт клиента без хранилища', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = createIndexedDbStore(ME)!
    vi.spyOn(store, 'startup').mockRejectedValue(new Error('broken'))
    const destroy = vi.spyOn(store, 'destroy')
    expect(await startIndexedDbStore(store)).toBe(false)
    expect(destroy).toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })
})
