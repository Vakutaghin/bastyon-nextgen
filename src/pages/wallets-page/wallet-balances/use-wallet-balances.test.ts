// Вкладка «Балансы»: основной кошелёк — getuserprofile (иначе txunspent),
// дополнительные — txunspent, всё в сатоши. Свежий баланс важнее профиля с
// момента входа (S47). Кошелёк, который не ответил, показывается прочерком и
// делает сумму неизвестной, а не нулём; если не ответил никто — ошибка.
// Добавление кошелька, дефолтные три и переименование ярлыка.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  auth: null as unknown as {
    getUserAddress: string | null
    getUserProfile: { balance?: number } | null
    isUserAuthenticated: boolean
    getKeyPair: { privateKey: string } | null
  },
  wallets: {} as Record<string, string[]>,
  labels: {} as Record<string, string>,
  getByPRC: vi.fn(),
  getByPRCWithAuth: vi.fn(),
  addOneWalletAddress: vi.fn(),
  ensureDefaultAdditionalWallet: vi.fn(),
  setWalletLabel: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/blockchain', () => ({
  useAuthStore: () => mocks.auth,
  getAdditionalWalletAddressesList: (main: string) => [...(mocks.wallets[main] ?? [])],
  addOneWalletAddress: mocks.addOneWalletAddress,
  ensureDefaultAdditionalWallet: mocks.ensureDefaultAdditionalWallet,
  getWalletLabel: (_main: string, addr: string) => mocks.labels[addr] ?? '',
  setWalletLabel: mocks.setWalletLabel,
}))
vi.mock('@/helpers/api/request', () => ({
  getByPRC: mocks.getByPRC,
  getByPRCWithAuth: mocks.getByPRCWithAuth,
}))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: mocks.toastError } }))

import { useWalletBalances } from './use-wallet-balances'

const MAIN = 'PMain'
const SAT = 100_000_000

/** Ответ txunspent: у каждого адреса свои UTXO в сатоши; адрес из failing — ошибка. */
function answerTxUnspent(byAddress: Record<string, number>, failing: string[] = []) {
  mocks.getByPRC.mockImplementation(async (req: { method: string; parameters: [string[]] }) => {
    const addr = req.parameters[0][0]!
    if (req.method === 'txunspent') {
      if (failing.includes(addr)) throw new Error('node timeout')
      return { result: 'success', data: [{ amountSat: byAddress[addr] ?? 0 }] }
    }
    return { data: [] }
  })
}

describe('useWalletBalances', () => {
  beforeEach(() => {
    mocks.auth = reactive({
      getUserAddress: MAIN,
      getUserProfile: null,
      isUserAuthenticated: true,
      getKeyPair: { privateKey: 'priv' },
    })
    mocks.wallets = { [MAIN]: ['PZ1', 'PZ2'] }
    mocks.labels = { PZ1: 'Копилка' }
    mocks.getByPRC.mockReset()
    mocks.getByPRCWithAuth.mockReset().mockResolvedValue({ data: [{ balance: 5 * SAT }] })
    mocks.addOneWalletAddress.mockReset()
    mocks.ensureDefaultAdditionalWallet.mockReset().mockResolvedValue(undefined)
    mocks.setWalletLabel.mockReset().mockReturnValue({ success: true })
    mocks.toastError.mockReset()
    answerTxUnspent({ PZ1: 2 * SAT, PZ2: SAT / 2 })
  })

  it('основной баланс из getuserprofile, дополнительные из txunspent, суммы в сатоши', async () => {
    const w = useWalletBalances()
    await w.loadBalances()

    expect(mocks.getByPRCWithAuth).toHaveBeenCalledWith({
      method: 'getuserprofile',
      parameters: [[MAIN]],
    })
    expect(w.accountBalance.value).toBe(5 * SAT)
    expect(w.sumWalletsBalance.value).toBe(2.5 * SAT)
    expect(w.totalBalance.value).toBe(7.5 * SAT)
    expect(w.mainTableRows.value).toEqual([{ address: MAIN, balance: 5 * SAT }])
    expect(w.additionalTableRows.value).toEqual([
      { address: 'PZ1', balance: 2 * SAT, label: 'Копилка' },
      { address: 'PZ2', balance: SAT / 2, label: '' },
    ])
    expect(w.allAddresses.value).toEqual([MAIN, 'PZ1', 'PZ2'])
    expect(w.error.value).toBeNull()
    expect(w.loading.value).toBe(false)
  })

  it('гость спрашивает профиль без подписи', async () => {
    mocks.auth.isUserAuthenticated = false
    mocks.wallets = {}
    mocks.getByPRC.mockResolvedValue({ data: [{ balance: SAT }] })
    const w = useWalletBalances()
    await w.loadBalances()
    expect(mocks.getByPRCWithAuth).not.toHaveBeenCalled()
    expect(mocks.getByPRC).toHaveBeenCalledWith({
      method: 'getuserprofile',
      parameters: [[MAIN]],
      options: { auth: false },
    })
    expect(w.accountBalance.value).toBe(SAT)
  })

  it('профиль без баланса — основной считается по txunspent', async () => {
    mocks.getByPRCWithAuth.mockResolvedValue({ data: [{}] })
    answerTxUnspent({ [MAIN]: 3 * SAT, PZ1: 0, PZ2: 0 })
    const w = useWalletBalances()
    await w.loadBalances()
    expect(w.accountBalance.value).toBe(3 * SAT)
  })

  it('свежий баланс важнее баланса из профиля на момент входа (S47)', async () => {
    mocks.auth.getUserProfile = { balance: 9 * SAT }
    const w = useWalletBalances()
    expect(w.accountBalance.value).toBe(9 * SAT)
    await w.loadBalances()
    expect(w.accountBalance.value).toBe(5 * SAT)
  })

  it('кошелёк, который не ответил, — прочерк, а сумма и итог неизвестны, не занижены', async () => {
    answerTxUnspent({ PZ1: 2 * SAT }, ['PZ2'])
    const w = useWalletBalances()
    await w.loadBalances()

    expect(w.error.value).toBeNull()
    expect(w.additionalTableRows.value.map((r) => r.balance)).toEqual([2 * SAT, null])
    expect(w.sumWalletsBalance.value).toBeNull()
    expect(w.totalBalance.value).toBeNull()
    expect(w.formatBalance(w.sumWalletsBalance.value)).toBe('—')
    expect(w.accountBalance.value).toBe(5 * SAT)
  })

  it('не ответил никто — ошибка загрузки вместо нулевых балансов', async () => {
    mocks.getByPRCWithAuth.mockRejectedValue(new Error('offline'))
    answerTxUnspent({}, [MAIN, 'PZ1', 'PZ2'])
    const w = useWalletBalances()
    await w.loadBalances()

    expect(w.error.value).toBe('wallet.errorLoadBalances')
    expect(w.additionalTableRows.value.every((r) => r.balance === null)).toBe(true)
    expect(w.totalBalance.value).toBeNull()
  })

  it('без адреса нечего грузить', async () => {
    mocks.auth.getUserAddress = null
    const w = useWalletBalances()
    await w.loadBalances()
    expect(w.hasAddresses.value).toBe(false)
    expect(w.mainTableRows.value).toEqual([])
    expect(w.loading.value).toBe(false)
    expect(mocks.getByPRC).not.toHaveBeenCalled()
  })

  it('formatBalance: сатоши в PKOIN, пусто — прочерк', () => {
    const w = useWalletBalances()
    expect(w.formatBalance(null)).toBe('—')
    expect(w.formatBalance(undefined)).toBe('—')
    expect(w.formatBalance(250_000_000)).toBe('2.5 PKOIN')
  })

  it('добавление кошелька: ключом аккаунта, потом список и балансы обновляются', async () => {
    mocks.addOneWalletAddress.mockImplementation(async () => {
      mocks.wallets[MAIN]!.push('PZ3')
      return { success: true }
    })
    const w = useWalletBalances()
    await w.onAddWallet()
    expect(mocks.addOneWalletAddress).toHaveBeenCalledWith(MAIN, 'priv')
    expect(w.allAddresses.value).toEqual([MAIN, 'PZ1', 'PZ2', 'PZ3'])
    expect(w.additionalTableRows.value.map((r) => r.address)).toContain('PZ3')
    expect(w.addingWallet.value).toBe(false)
  })

  it('ошибка добавления видна, лимит — 20 дополнительных кошельков', async () => {
    mocks.addOneWalletAddress.mockResolvedValue({ success: false })
    const w = useWalletBalances()
    await w.onAddWallet()
    expect(w.error.value).toBe('wallet.errorAddWallet')

    mocks.wallets[MAIN] = Array.from({ length: 20 }, (_, i) => `PZ${i}`)
    const full = useWalletBalances()
    expect(full.canAddWallet.value).toBe(false)
    mocks.addOneWalletAddress.mockClear()
    await full.onAddWallet()
    expect(mocks.addOneWalletAddress).not.toHaveBeenCalled()
  })

  it('при открытии досоздаёт дефолтные кошельки, если их меньше трёх', async () => {
    const w = useWalletBalances()
    await w.initBalances()
    expect(mocks.ensureDefaultAdditionalWallet).toHaveBeenCalledWith(MAIN, 'priv')

    mocks.ensureDefaultAdditionalWallet.mockClear()
    mocks.wallets[MAIN] = ['PZ1', 'PZ2', 'PZ3']
    await useWalletBalances().initBalances()
    expect(mocks.ensureDefaultAdditionalWallet).not.toHaveBeenCalled()
  })

  it('переименование: сохранённый ярлык сразу виден в таблице', () => {
    mocks.setWalletLabel.mockImplementation((_m: string, addr: string, label: string) => {
      mocks.labels[addr] = label
      return { success: true }
    })
    const w = useWalletBalances()
    w.openRename('PZ2', '')
    expect(w.renameOpen.value).toBe(true)
    w.renameLabel.value = 'Отпуск'
    w.saveRename()

    expect(mocks.setWalletLabel).toHaveBeenCalledWith(MAIN, 'PZ2', 'Отпуск')
    expect(w.renameOpen.value).toBe(false)
    expect(w.additionalTableRows.value.find((r) => r.address === 'PZ2')?.label).toBe('Отпуск')
  })

  it('неудачное переименование: тост, окно остаётся открытым', () => {
    mocks.setWalletLabel.mockReturnValue({ success: false })
    const w = useWalletBalances()
    w.openRename('PZ1', 'Копилка')
    w.saveRename()
    expect(mocks.toastError).toHaveBeenCalledWith({ message: 'wallet.renameFailed' })
    expect(w.renameOpen.value).toBe(true)
  })

  it('смена аккаунта закрывает переименование, чтобы ярлык не лёг на чужой кошелёк', async () => {
    const w = useWalletBalances()
    w.openRename('PZ1', 'Копилка')
    mocks.auth.getUserAddress = 'POther'
    await nextTick()
    expect(w.renameOpen.value).toBe(false)
    expect(w.renameLabel.value).toBe('')
  })
})
