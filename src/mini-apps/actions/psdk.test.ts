import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { PSDK_ACTIONS } from './psdk'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'

function setup(hostOverrides = {}) {
  const host = makeMockHost(hostOverrides)
  const resolver = makeResolver()
  const reg = new ActionRegistry({ host, resolver, actions: PSDK_ACTIONS })
  return { reg, host }
}

describe('psdk actions', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  it('psdk.userInfoLoad calls getuserprofile RPC with addresses array', async () => {
    const profiles = [{ address: 'a', name: 'Alice' }]
    const callRpc = vi.fn(async () => profiles)
    const { reg } = setup({ callRpc })

    const res = await reg.execute(
      'psdk.userInfoLoad',
      TEST_APP,
      { addresses: ['a', 'b'] },
      new AbortController().signal
    )

    expect(callRpc).toHaveBeenCalledWith(
      'getuserprofile',
      [['a', 'b']],
      { auth: false },
      expect.anything()
    )
    expect(res).toEqual(profiles)
  })

  it('psdk.userInfoLoad coerces non-array response to []', async () => {
    const callRpc = vi.fn(async () => ({ unexpected: 'shape' }))
    const { reg } = setup({ callRpc })

    const res = await reg.execute(
      'psdk.userInfoLoad',
      TEST_APP,
      { addresses: ['a'] },
      new AbortController().signal
    )

    expect(res).toEqual([])
  })

  it('psdk.userInfoLoad accepts optional light/update params (currently ignored)', async () => {
    const callRpc = vi.fn(async () => [])
    const { reg } = setup({ callRpc })

    await reg.execute(
      'psdk.userInfoLoad',
      TEST_APP,
      { addresses: ['a'], light: true, update: false },
      new AbortController().signal
    )

    expect(callRpc).toHaveBeenCalledWith(
      'getuserprofile',
      [['a']],
      { auth: false },
      expect.anything()
    )
  })

  it('psdk.userInfoLoad rejects when addresses is missing', async () => {
    const { reg } = setup()
    await expect(
      reg.execute(
        'psdk.userInfoLoad',
        TEST_APP,
        {} as unknown as { addresses: string[] },
        new AbortController().signal
      )
    ).rejects.toThrow(/invalid_params/)
  })
})
