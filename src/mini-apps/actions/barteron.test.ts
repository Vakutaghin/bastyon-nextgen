import { beforeEach, describe, expect, it } from 'vitest'
import { ActionRegistry } from './registry'
import { BARTERON_ACTIONS } from './barteron'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'

function setup() {
  const host = makeMockHost()
  const reg = new ActionRegistry({ host, resolver: makeResolver(), actions: BARTERON_ACTIONS })
  return { reg, host }
}

const BARTERON_ACTION_NAMES = [
  'barteron.account',
  'barteron.offer',
  'barteron.removeOffer',
  'barteron.comment',
  'barteron.vote',
] as const

describe('barteron stub actions', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  for (const name of BARTERON_ACTION_NAMES) {
    it(`${name} returns rejected action with not_implemented reason`, async () => {
      const { reg } = setup()
      const r = (await reg.execute(name, TEST_APP, {}, new AbortController().signal)) as {
        rejected: boolean
        reason: string
      }
      expect(r.rejected).toBe(true)
      expect(r.reason).toContain('not_implemented')
    })
  }

  it('all barteron actions require authorization', async () => {
    const host = makeMockHost({ isUserAuthenticated: () => false })
    const reg = new ActionRegistry({
      host,
      resolver: makeResolver(),
      actions: BARTERON_ACTIONS,
    })

    for (const name of BARTERON_ACTION_NAMES) {
      await expect(reg.execute(name, TEST_APP, {}, new AbortController().signal)).rejects.toThrow(
        /required_authorization/
      )
    }
  })

  it('all barteron actions require account permission', async () => {
    const host = makeMockHost()
    const reg = new ActionRegistry({
      host,
      resolver: makeResolver({ auto: false }),
      actions: BARTERON_ACTIONS,
    })

    for (const name of BARTERON_ACTION_NAMES) {
      await expect(reg.execute(name, TEST_APP, {}, new AbortController().signal)).rejects.toThrow(
        /permission_denied/
      )
    }
  })
})
