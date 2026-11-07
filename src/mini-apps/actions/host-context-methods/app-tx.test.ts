import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import { createAppTxMethods, type AppTxDeps } from './app-tx'
import { _resetAppActionsForTests, NOT_CONFIRMED } from '../../tx/app-actions'
import { removeObject } from '../../tx/legacy-objects'

const APP = 'barteron.pocketnet.app'
const TX = 'd'.repeat(64)

function setup(over: Partial<AppTxDeps> = {}) {
  const deps: AppTxDeps = {
    getUserAddress: () => 'PUser',
    send: vi.fn(async () => TX),
    isStillPending: vi.fn(() => true),
    isConfirmedOnNode: vi.fn(async () => false),
    ...over,
  }
  return { deps, methods: createAppTxMethods(deps) }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  _resetAppActionsForTests()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('createAppTxMethods', () => {
  it('отправляет с подписью-именем приложения и отвечает действием с txid', async () => {
    const { deps, methods } = setup()
    const obj = removeObject('a'.repeat(64))
    const action = await methods.sendAppTransaction(APP, 'Barteron', obj)
    expect(deps.send).toHaveBeenCalledWith(obj, { title: 'Barteron' })
    expect(action).toMatchObject({
      transaction: TX,
      completed: false,
      expObject: { txidEdit: 'a'.repeat(64), type: 'contentDelete' },
    })
    expect(await methods.getAppActions(APP)).toEqual([action])
    expect(await methods.getAppAction(APP, action.id as string)).toEqual(action)
  })

  it('ошибка отправки — наверх, действие не записано', async () => {
    const { methods } = setup({
      send: vi.fn(async () => {
        throw new Error('нода отказала')
      }),
    })
    await expect(
      methods.sendAppTransaction(APP, 'Barteron', removeObject('a'.repeat(64)))
    ).rejects.toThrow('нода отказала')
    expect(await methods.getAppActions(APP)).toEqual([])
  })

  it('часы о транзакции забыли, а нода видит её в блоке — действие завершено', async () => {
    const { deps, methods } = setup()
    await methods.sendAppTransaction(APP, 'Barteron', removeObject('a'.repeat(64)))
    vi.mocked(deps.isStillPending).mockReturnValue(false)
    vi.mocked(deps.isConfirmedOnNode).mockResolvedValue(true)
    const [action] = await methods.getAppActions(APP)
    expect(action).toMatchObject({ completed: true, rejected: null })
  })

  it('час прошёл, блока нет — отказ; пока ждём — нода не мучается', async () => {
    vi.useFakeTimers()
    const { deps, methods } = setup()
    await methods.sendAppTransaction(APP, 'Barteron', removeObject('a'.repeat(64)))
    await methods.getAppActions(APP)
    expect(deps.isConfirmedOnNode).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60 * 60 * 1000 + 1)
    const [action] = await methods.getAppActions(APP)
    expect(action).toMatchObject({ completed: false, rejected: NOT_CONFIRMED })
  })

  it('без входа — пусто и отказ отправки', async () => {
    const { methods } = setup({ getUserAddress: () => null })
    expect(await methods.getAppActions(APP)).toEqual([])
    await expect(
      methods.sendAppTransaction(APP, 'Barteron', removeObject('a'.repeat(64)))
    ).rejects.toThrow('required_authorization')
  })
})
