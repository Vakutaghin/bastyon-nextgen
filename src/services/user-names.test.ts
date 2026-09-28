import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

const getByPRC = vi.fn()
vi.mock('@/helpers/api/request', () => ({ getByPRC: (...args: unknown[]) => getByPRC(...args) }))

import { t } from '@/i18n'
import {
  __resetUserNamesForTests,
  preloadUserNames,
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

describe('сбои и повторы', () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  it('имя, не пришедшее с первого раза, догружается само: подпись не залипает на адресе', async () => {
    getByPRC.mockRejectedValueOnce(new Error('node down'))
    getByPRC.mockResolvedValueOnce([{ address: ALICE, name: 'SergiyKir' }])
    // Подпись в шаблоне — computed: сам по себе он userName больше не вызовет.
    const label = computed(() => userName(ALICE, ALICE))
    expect(label.value).toBe(shortAddress(ALICE))
    await settle()
    expect(label.value).toBe(shortAddress(ALICE))

    await vi.advanceTimersByTimeAsync(2_000)
    await settle()
    expect(getByPRC).toHaveBeenCalledTimes(2)
    expect(label.value).toBe('SergiyKir')
  })

  it('ответ не того вида — сбой, а не «профиля нет»: имя всё равно придёт', async () => {
    getByPRC.mockResolvedValueOnce({ error: 'busy' })
    getByPRC.mockResolvedValueOnce({ data: [{ address: ALICE, name: 'SergiyKir' }] })
    const label = computed(() => userName(ALICE))
    expect(label.value).toBe(shortAddress(ALICE))
    await settle()
    await vi.advanceTimersByTimeAsync(2_000)
    await settle()
    expect(label.value).toBe('SergiyKir')
  })

  it('после пяти повторов перестаёт спрашивать, а следующий показ начинает заново', async () => {
    getByPRC.mockRejectedValue(new Error('offline'))
    userName(ALICE)
    await settle()
    // Паузы 2, 5, 15, 30 и 60 с, плюс сборка пачки перед каждым запросом.
    await vi.advanceTimersByTimeAsync(113_000)
    expect(getByPRC).toHaveBeenCalledTimes(6)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(getByPRC).toHaveBeenCalledTimes(6)

    getByPRC.mockReset()
    getByPRC.mockResolvedValueOnce([{ address: ALICE, name: 'SergiyKir' }])
    userName(ALICE)
    await settle()
    expect(userName(ALICE)).toBe('SergiyKir')
  })
})

describe('preloadUserNames', () => {
  it('недостающие имена — одним запросом сразу, промис выполняется, когда они пришли', async () => {
    rememberUsers([{ address: BOB, name: 'Leo5591' }])
    const gate: { release?: (value: unknown) => void } = {}
    getByPRC.mockReturnValueOnce(
      new Promise((resolve) => {
        gate.release = resolve
      })
    )
    let done = false
    const preload = preloadUserNames([ALICE, BOB, ALICE, null, undefined, '']).then(() => {
      done = true
    })
    await Promise.resolve()
    expect(getByPRC).toHaveBeenCalledTimes(1)
    expect(getByPRC.mock.calls[0]![0].parameters).toEqual([[ALICE], '1'])
    expect(done).toBe(false)

    gate.release?.([{ address: ALICE, name: 'SergiyKir' }])
    await preload
    expect(userName(ALICE)).toBe('SergiyKir')
    expect(getByPRC).toHaveBeenCalledTimes(1)
  })

  it('ждёт и уже летящий запрос, не повторяя его, но не дольше таймаута', async () => {
    getByPRC.mockReturnValueOnce(new Promise(() => {}))
    userName(ALICE)
    await settle()
    let done = false
    void preloadUserNames([ALICE], 3_000).then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(2_900)
    expect(done).toBe(false)
    expect(getByPRC).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(200)
    expect(done).toBe(true)
  })

  it('известные имена и удалённые аккаунты не спрашивает', async () => {
    rememberUsers([
      { address: ALICE, name: 'SergiyKir' },
      { address: GONE, deleted: true },
    ])
    await preloadUserNames([ALICE, GONE])
    expect(getByPRC).not.toHaveBeenCalled()
  })
})
