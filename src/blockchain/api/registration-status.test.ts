import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from 'vue'
import { getRegistrationStatus, isRegistrationInProgress } from './registration-status'

// ---------------------------------------------------------------------------
// auth-store держим reactive — ветка ожидания использует vue `watch` по
// isFetchingUserState. rpcCall и unspents-manager (динамический импорт) мокаем.
// ---------------------------------------------------------------------------

const { mockAuth, _rpcCall, _getUnspents, _filterAvailableUnspents } = vi.hoisted(() => ({
  mockAuth: { getUserAddress: '' as string | null, isFetchingUserState: false, userProfile: null as unknown },
  _rpcCall: vi.fn(),
  _getUnspents: vi.fn(),
  _filterAvailableUnspents: vi.fn(),
}))

const auth = reactive(mockAuth)

vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => auth }))
vi.mock('@/helpers/api/request', () => ({ rpcCall: _rpcCall }))
vi.mock('@/helpers/api/rpc-endpoints', () => ({ rpcEndpoints: { getUserProfile: 'getuserprofile' } }))
vi.mock('@/blockchain/core/transactions/unspents-manager', () => ({
  getUnspents: _getUnspents,
  filterAvailableUnspents: _filterAvailableUnspents,
}))

let errSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  _rpcCall.mockReset()
  _getUnspents.mockReset().mockResolvedValue([])
  _filterAvailableUnspents.mockReset().mockReturnValue([])
  auth.getUserAddress = 'PUserAddr'
  auth.isFetchingUserState = false
  auth.userProfile = null
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errSpy.mockRestore()
})

describe('getRegistrationStatus', () => {
  it('без адреса возвращает not_in_progress_no_processing', async () => {
    auth.getUserAddress = null
    expect(await getRegistrationStatus()).toBe('not_in_progress_no_processing')
    expect(_rpcCall).not.toHaveBeenCalled()
  })

  it('returns registered, если профиль уже загружен (адрес совпадает, есть id) — без RPC', async () => {
    auth.userProfile = { address: 'PUserAddr', id: 42 }

    expect(await getRegistrationStatus()).toBe('registered')
    expect(_rpcCall).not.toHaveBeenCalled()
  })

  it('делает RPC при профиле с id=0 (stub после регистрации)', async () => {
    auth.userProfile = { address: 'PUserAddr', id: 0 }
    _rpcCall.mockResolvedValue([{ address: 'PUserAddr', id: 7 }])

    expect(await getRegistrationStatus()).toBe('registered')
    expect(_rpcCall).toHaveBeenCalled()
  })

  it('returns registered, если getuserprofile вернул непустой массив', async () => {
    _rpcCall.mockResolvedValue([{ address: 'PUserAddr', id: 1 }])

    expect(await getRegistrationStatus()).toBe('registered')
    expect(_rpcCall).toHaveBeenCalledWith({
      method: 'getuserprofile',
      parameters: [['PUserAddr']],
      options: { auth: false },
    })
  })

  it('пустой профиль + есть unspents → in_progress_transaction', async () => {
    _rpcCall.mockResolvedValue([])
    _filterAvailableUnspents.mockReturnValue([{ txid: 't', vout: 0, amount: 1 }])

    expect(await getRegistrationStatus()).toBe('in_progress_transaction')
  })

  it('пустой профиль + нет unspents → in_progress_wait_unspents', async () => {
    _rpcCall.mockResolvedValue([])
    _filterAvailableUnspents.mockReturnValue([])

    expect(await getRegistrationStatus()).toBe('in_progress_wait_unspents')
  })

  // P2-10: сетевой сбой getuserprofile больше НЕ понижает статус до in_progress —
  // иначе зарегистрированному показывали бы ложные часики регистрации. Отдаём
  // not_in_progress и не проваливаемся в unspents-проверку.
  it('ошибка getuserprofile → not_in_progress (не in_progress по unspents)', async () => {
    _rpcCall.mockRejectedValueOnce(new Error('network fail'))
    _filterAvailableUnspents.mockReturnValue([{ txid: 't', vout: 0, amount: 1 }])

    expect(await getRegistrationStatus()).toBe('not_in_progress')
  })

  it('ошибка getuserprofile → not_in_progress даже без unspents-инфо', async () => {
    _rpcCall.mockRejectedValueOnce(new Error('rpc fail'))

    expect(await getRegistrationStatus()).toBe('not_in_progress')
    // unspents-проверка не должна вызываться при сбое профиля.
    expect(_getUnspents).not.toHaveBeenCalled()
  })

  it('ждёт завершения isFetchingUserState, затем продолжает проверку', async () => {
    auth.isFetchingUserState = true
    _rpcCall.mockResolvedValue([{ address: 'PUserAddr', id: 1 }])

    const promise = getRegistrationStatus()

    // Пока флаг true — RPC ещё не должен был отработать до снятия флага.
    await Promise.resolve()
    auth.isFetchingUserState = false

    expect(await promise).toBe('registered')
    expect(_rpcCall).toHaveBeenCalled()
  })
})

describe('isRegistrationInProgress', () => {
  it.each([
    'in_progress_transaction',
    'in_progress_hasUnspents',
    'in_progress_wait_unspents',
    'undefined_status',
  ] as const)('true для %s', (status) => {
    expect(isRegistrationInProgress(status)).toBe(true)
  })

  it.each(['registered', 'not_in_progress', 'not_in_progress_no_processing'] as const)(
    'false для %s',
    (status) => {
      expect(isRegistrationInProgress(status)).toBe(false)
    }
  )
})
