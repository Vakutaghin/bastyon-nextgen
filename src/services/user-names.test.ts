import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

const getByPRC = vi.fn()
vi.mock('@/helpers/api/request', () => ({ getByPRC: (...args: unknown[]) => getByPRC(...args) }))

import { t } from '@/i18n'
import {
  __resetUserNamesForTests,
  rememberUsers,
  shortAddress,
  userAvatar,
  userName,
  userNameIfKnown,
} from './user-names'

const ALICE = 'PJFaWLSPKfRDe4m8gsXg4zfigcVA5yZU2B'
const BOB = 'PRuxZhBhmbDHkefswAWi37yN7b7hFgFEfQ'
const GONE = 'PA3Qfzifv5gVYtRZEdpuWJB5n3BdS3mfs6'

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(50)
}

beforeEach(() => {
  vi.useFakeTimers()
  getByPRC.mockReset()
  __resetUserNamesForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('userName', () => {
  it('имя, пришедшее с данными, — сразу и без запроса', () => {
    expect(userName(ALICE, 'SergiyKir')).toBe('SergiyKir')
    expect(userName(ALICE, { address: ALICE, name: 'SergiyKir' })).toBe('SergiyKir')
    expect(getByPRC).not.toHaveBeenCalled()
  })

  it('адрес на месте имени за имя не считается: короткий адрес, потом ник', async () => {
    getByPRC.mockResolvedValue([{ address: ALICE, name: 'SergiyKir', i: 'https://x/a.jpg' }])
    const label = computed(() => userName(ALICE, ALICE))
    expect(label.value).toBe(shortAddress(ALICE))
    await settle()
    expect(label.value).toBe('SergiyKir')
    expect(userAvatar(ALICE)).toBe('https://x/a.jpg')
  })

  it('подписи одного экрана уходят одним лёгким запросом', async () => {
    getByPRC.mockResolvedValue([
      { address: ALICE, name: 'SergiyKir' },
      { address: BOB, name: 'Leo5591' },
    ])
    userName(ALICE)
    userName(BOB)
    userName(ALICE)
    await settle()
    expect(getByPRC).toHaveBeenCalledTimes(1)
    expect(getByPRC.mock.calls[0]![0]).toMatchObject({
      method: 'getuserprofile',
      parameters: [[ALICE, BOB], '1'],
      options: { auth: false },
    })
    expect(userName(BOB)).toBe('Leo5591')
  })

  it('удалённый аккаунт — «Аккаунт удалён», как в старом клиенте', async () => {
    expect(userName(GONE, { address: GONE, deleted: true })).toBe(t('common.deletedAccount'))
    getByPRC.mockResolvedValue([{ address: GONE, deleted: true }])
    expect(userName(GONE)).toBe(shortAddress(GONE))
    await settle()
    expect(userName(GONE)).toBe(t('common.deletedAccount'))
  })

  it('адрес без профиля спрашивается один раз', async () => {
    getByPRC.mockResolvedValue([])
    userName(BOB)
    await settle()
    userName(BOB)
    await settle()
    expect(getByPRC).toHaveBeenCalledTimes(1)
    expect(userName(BOB)).toBe(shortAddress(BOB))
  })

  it('сбой сети не запоминается: следующий показ спросит снова', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getByPRC.mockRejectedValueOnce(new Error('offline'))
    userName(ALICE)
    await settle()
    getByPRC.mockResolvedValueOnce([{ address: ALICE, name: 'SergiyKir' }])
    userName(ALICE)
    await settle()
    expect(getByPRC).toHaveBeenCalledTimes(2)
    expect(userName(ALICE)).toBe('SergiyKir')
    warn.mockRestore()
  })

  it('больше 50 адресов — несколько запросов', async () => {
    getByPRC.mockResolvedValue([])
    for (let i = 0; i < 70; i++) userName(`P${String(i).padStart(33, 'x')}`)
    await settle()
    await settle()
    expect(getByPRC).toHaveBeenCalledTimes(2)
    expect(getByPRC.mock.calls[0]![0].parameters[0]).toHaveLength(50)
    expect(getByPRC.mock.calls[1]![0].parameters[0]).toHaveLength(20)
  })
})

describe('userAvatar', () => {
  it('без аватара в данных — из профиля, который догрузил userName; сам не запрашивает', async () => {
    getByPRC.mockResolvedValue([{ address: ALICE, name: 'SergiyKir', i: 'https://x/a.jpg' }])
    expect(userAvatar(ALICE)).toBeNull()
    await settle()
    expect(getByPRC).not.toHaveBeenCalled()
    userName(ALICE)
    await settle()
    expect(userAvatar(ALICE)).toBe('https://x/a.jpg')
    expect(userAvatar(ALICE, 'https://y/own.jpg')).toBe('https://y/own.jpg')
  })
})

describe('rememberUsers', () => {
  it('профили из ленты избавляют от запроса', () => {
    rememberUsers([{ address: ALICE, name: ' SergiyKir ' }, null, { name: 'без адреса' }])
    expect(userName(ALICE, ALICE)).toBe('SergiyKir')
    expect(getByPRC).not.toHaveBeenCalled()
  })

  it('заглушка удалённого аккаунта из комментариев тоже запоминается', () => {
    rememberUsers([{ address: GONE, deleted: true }])
    expect(userName(GONE)).toBe(t('common.deletedAccount'))
  })
})

describe('userNameIfKnown', () => {
  it('для обращения в ответе — только настоящее имя, без короткого адреса', async () => {
    getByPRC.mockResolvedValue([{ address: ALICE, name: 'SergiyKir' }])
    expect(userNameIfKnown(ALICE, ALICE)).toBe('')
    await settle()
    expect(userNameIfKnown(ALICE, ALICE)).toBe('SergiyKir')
  })
})
