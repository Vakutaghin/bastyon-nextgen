import { describe, expect, it, vi } from 'vitest'

import { OfflineError } from '@/helpers/api/offline'
import { noteReachable, noteUnreachable, UnreachableError } from '@/helpers/api/reachability'
import { queryClient, shouldRetryQuery } from './query-client'

describe('shouldRetryQuery', () => {
  it('без сети не повторяет — экран сразу показывает «Нет сети»; прочие ошибки — дважды', () => {
    expect(shouldRetryQuery(0, new OfflineError('feed'))).toBe(false)
    // Сеть есть, а прокси молчат и на пинг: повтор через секунду дал бы то же.
    expect(shouldRetryQuery(0, new UnreachableError('feed'))).toBe(false)
    expect(shouldRetryQuery(0, new Error('node down'))).toBe(true)
    expect(shouldRetryQuery(1, new Error('node down'))).toBe(true)
    expect(shouldRetryQuery(2, new Error('node down'))).toBe(false)
  })
})

describe('связь вернулась', () => {
  it('сеть есть, а Bastyon молчал — ответил: упавшие видимые запросы повторяются сами', async () => {
    const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue()
    noteUnreachable()
    expect(refetch).not.toHaveBeenCalled()
    noteReachable()
    expect(refetch).toHaveBeenCalledTimes(1)
    const [filters, options] = refetch.mock.calls[0]!
    expect(filters).toMatchObject({ type: 'active' })
    expect(options).toEqual({ cancelRefetch: false })
    const predicate = (filters as { predicate: (q: unknown) => boolean }).predicate
    expect(predicate({ state: { status: 'error' } })).toBe(true)
    expect(predicate({ state: { status: 'success' } })).toBe(false)

    // Связь и не пропадала — `online` повторяет сразу, как раньше.
    window.dispatchEvent(new Event('online'))
    expect(refetch).toHaveBeenCalledTimes(2)
    refetch.mockRestore()
  })
})
