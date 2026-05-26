import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { CHAT_ACTIONS } from './chat'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'

function setup(hostOverrides = {}, resolverOpts = {}) {
  const host = makeMockHost(hostOverrides)
  const resolver = makeResolver(resolverOpts)
  const reg = new ActionRegistry({ host, resolver, actions: CHAT_ACTIONS })
  return { reg, host, resolver }
}

describe('chat actions', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  // ─── openRoom ──────────────────────────────────────────────────────────

  it('chat.openRoom calls host.chatOpenRoom', async () => {
    const chatOpenRoom = vi.fn(async () => {})
    const { reg } = setup({ chatOpenRoom })
    await reg.execute(
      'chat.openRoom',
      TEST_APP,
      { roomid: '!abc:matrix.org' },
      new AbortController().signal
    )
    expect(chatOpenRoom).toHaveBeenCalledWith('!abc:matrix.org')
  })

  it('chat.openRoom requires chat permission', async () => {
    const { reg } = setup({}, { auto: false })
    await expect(
      reg.execute('chat.openRoom', TEST_APP, { roomid: 'r' }, new AbortController().signal)
    ).rejects.toThrow(/permission_denied/)
  })

  it('chat.openRoom rejects empty roomid', async () => {
    const { reg } = setup()
    await expect(
      reg.execute('chat.openRoom', TEST_APP, { roomid: '' }, new AbortController().signal)
    ).rejects.toThrow(/invalid_params/)
  })

  // ─── getOrCreateRoom ───────────────────────────────────────────────────

  it('chat.getOrCreateRoom delegates to host', async () => {
    const chatGetOrCreateRoom = vi.fn(async () => ({ roomid: '!new:matrix' }))
    const { reg } = setup({ chatGetOrCreateRoom })
    const r = await reg.execute(
      'chat.getOrCreateRoom',
      TEST_APP,
      { users: ['@a:m', '@b:m'], parameters: { name: 'test' } },
      new AbortController().signal
    )
    expect(r).toEqual({ roomid: '!new:matrix' })
    expect(chatGetOrCreateRoom).toHaveBeenCalledWith(['@a:m', '@b:m'], { name: 'test' })
  })

  it('chat.getOrCreateRoom requires authorization', async () => {
    const { reg } = setup({ isUserAuthenticated: () => false })
    await expect(
      reg.execute('chat.getOrCreateRoom', TEST_APP, { users: ['x'] }, new AbortController().signal)
    ).rejects.toThrow(/required_authorization/)
  })

  it('chat.getOrCreateRoom surfaces not_implemented from host', async () => {
    const { reg } = setup({
      chatGetOrCreateRoom: vi.fn(async () => {
        throw new Error('chat_get_or_create_not_implemented')
      }),
    })
    await expect(
      reg.execute(
        'chat.getOrCreateRoom',
        TEST_APP,
        { users: ['@a:m'] },
        new AbortController().signal
      )
    ).rejects.toThrow(/not_implemented/)
  })

  // ─── send ──────────────────────────────────────────────────────────────

  it('chat.send delegates to host', async () => {
    const chatSendMessage = vi.fn(async () => ({ event_id: '$abc' }))
    const { reg } = setup({ chatSendMessage })
    const r = await reg.execute(
      'chat.send',
      TEST_APP,
      { roomid: '!r:m', content: { msgtype: 'm.text', body: 'hi' } },
      new AbortController().signal
    )
    expect(r).toEqual({ event_id: '$abc' })
    expect(chatSendMessage).toHaveBeenCalledWith('!r:m', {
      msgtype: 'm.text',
      body: 'hi',
    })
  })

  it('chat.send requires authorization', async () => {
    const { reg } = setup({ isUserAuthenticated: () => false })
    await expect(
      reg.execute(
        'chat.send',
        TEST_APP,
        { roomid: 'r', content: 'x' },
        new AbortController().signal
      )
    ).rejects.toThrow(/required_authorization/)
  })
})
