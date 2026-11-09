import { describe, expect, it } from 'vitest'

import { OfflineError } from '@/helpers/api/offline'
import { shouldRetryQuery } from './query-client'

describe('shouldRetryQuery', () => {
  it('без сети не повторяет — экран сразу показывает «Нет сети»; прочие ошибки — дважды', () => {
    expect(shouldRetryQuery(0, new OfflineError('feed'))).toBe(false)
    expect(shouldRetryQuery(0, new Error('node down'))).toBe(true)
    expect(shouldRetryQuery(1, new Error('node down'))).toBe(true)
    expect(shouldRetryQuery(2, new Error('node down'))).toBe(false)
  })
})
