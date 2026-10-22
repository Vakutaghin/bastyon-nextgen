import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { CHAIN_INFO_MAX_DEPTH, useChainInfoStore } from './chain-info-store'

const TX = 'a'.repeat(64)
const TX2 = 'b'.repeat(64)

describe('chain-info-store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('open начинает заново, push идёт вглубь, back возвращает', () => {
    const store = useChainInfoStore()
    expect(store.isOpen).toBe(false)

    store.open({ kind: 'post', txid: TX })
    store.push({ kind: 'tx', txid: TX2 })
    store.push({ kind: 'account', address: 'PAddr' })
    expect(store.current).toEqual({ kind: 'account', address: 'PAddr' })
    expect(store.canGoBack).toBe(true)

    store.back()
    expect(store.current).toEqual({ kind: 'tx', txid: TX2 })

    store.open({ kind: 'tx', txid: TX })
    expect(store.stack).toEqual([{ kind: 'tx', txid: TX }])
    expect(store.canGoBack).toBe(false)
    store.back()
    expect(store.isOpen).toBe(true)
  })

  it('та же запись повторно не кладётся, пустые не открываются', () => {
    const store = useChainInfoStore()
    store.open({ kind: 'tx', txid: '' })
    store.open({ kind: 'comment', id: TX, postId: '' })
    expect(store.isOpen).toBe(false)

    store.open({ kind: 'tx', txid: TX })
    store.push({ kind: 'tx', txid: TX })
    expect(store.stack).toHaveLength(1)
  })

  it('стопка не растёт бесконечно', () => {
    const store = useChainInfoStore()
    store.open({ kind: 'tx', txid: TX })
    for (let i = 0; i < CHAIN_INFO_MAX_DEPTH + 5; i++) {
      store.push({ kind: 'account', address: `P${i}` })
    }
    expect(store.stack).toHaveLength(CHAIN_INFO_MAX_DEPTH)
    expect(store.current).toEqual({ kind: 'account', address: `P${CHAIN_INFO_MAX_DEPTH + 4}` })
  })

  it('leave закрывает и зовёт onLeave, close — нет', () => {
    const store = useChainInfoStore()
    const onLeave = vi.fn()

    store.open({ kind: 'tx', txid: TX }, { onLeave })
    store.close()
    expect(onLeave).not.toHaveBeenCalled()

    store.open({ kind: 'tx', txid: TX }, { onLeave })
    store.leave()
    expect(store.isOpen).toBe(false)
    expect(onLeave).toHaveBeenCalledTimes(1)

    // Новое открытие без колбэка не наследует прежний.
    store.open({ kind: 'tx', txid: TX })
    store.leave()
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
