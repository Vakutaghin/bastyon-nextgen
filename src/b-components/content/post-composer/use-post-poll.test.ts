import { describe, it, expect } from 'vitest'

import { MAX_POLL_OPTIONS } from './consts'
import { usePostPoll } from './use-post-poll'

describe('usePostPoll', () => {
  it('неактивный опрос → cleanedPoll undefined; активный → trim + отсев пустых', () => {
    const p = usePostPoll()
    expect(p.cleanedPoll.value).toBeUndefined()
    p.togglePoll(true)
    p.setPollTitle('  Вопрос ')
    p.setPollOption(0, ' да ')
    p.setPollOption(1, '')
    expect(p.cleanedPoll.value).toEqual({ title: 'Вопрос', list: ['да'] })
  })

  it('варианты: не меньше 2 и не больше MAX_POLL_OPTIONS', () => {
    const p = usePostPoll()
    p.removePollOption(0)
    expect(p.pollOptions.value).toHaveLength(2)
    for (let i = 0; i < 10; i++) p.addPollOption()
    expect(p.pollOptions.value).toHaveLength(MAX_POLL_OPTIONS)
    p.setPollOption(2, 'c')
    p.removePollOption(2)
    expect(p.pollOptions.value).toHaveLength(MAX_POLL_OPTIONS - 1)
    expect(p.pollOptions.value).not.toContain('c')
  })

  it('выключение и reset очищают состояние', () => {
    const p = usePostPoll()
    p.togglePoll(true)
    p.setPollTitle('t')
    p.addPollOption()
    p.togglePoll(false)
    expect(p.pollActive.value).toBe(false)
    expect(p.pollTitle.value).toBe('')
    expect(p.pollOptions.value).toEqual(['', ''])
    p.togglePoll(true)
    p.setPollOption(0, 'x')
    p.resetPoll()
    expect(p.pollActive.value).toBe(false)
    expect(p.pollOptions.value).toEqual(['', ''])
  })
})
