import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpcCall: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({ rpcCall: mocks.rpcCall }))

import { fetchUserBlockings, normalizeBlockings } from './user-blockings'

describe('user blockings', () => {
  it('takes addresses from strings and from objects, once each', () => {
    expect(
      normalizeBlockings(['PA', { address: 'PB' }, { adddress: 'PC' }, 'PA', '', null, 7])
    ).toEqual(['PA', 'PB', 'PC'])
    expect(normalizeBlockings(null)).toEqual([])
  })

  it('asks the node for addresses only, like the old client', async () => {
    mocks.rpcCall.mockResolvedValueOnce(['PA', 'PB'])
    await expect(fetchUserBlockings('PMe')).resolves.toEqual(['PA', 'PB'])
    expect(mocks.rpcCall).toHaveBeenCalledWith({
      method: 'getuserblockings',
      parameters: ['PMe', 1, '', '', 0, 5000],
      options: { auth: false },
    })
  })
})
