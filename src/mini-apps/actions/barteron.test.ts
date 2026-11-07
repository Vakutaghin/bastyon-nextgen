import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { BARTERON_ACTIONS, BARTERON_APP_ID } from './barteron'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'
import type { InstalledApp } from '../types/app'

const USER = 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM'
const HASH = 'a'.repeat(64)
const BARTERON: InstalledApp = {
  ...TEST_APP,
  manifest: { ...TEST_APP.manifest, id: BARTERON_APP_ID, name: 'Barteron' },
}

const OFFER = {
  language: 'ru-RU',
  caption: 'Велосипед',
  description: 'Почти новый',
  tag: 23,
  tags: [11, 12],
  condition: ['used'],
  images: ['https://example.org/1.jpg'],
  geohash: 'ucfv0',
  price: 150000,
  video: '',
  published: 'published',
}

const VALID: Record<string, unknown> = {
  'barteron.account': { address: USER, tags: [1], geohash: '', static: false, radius: 0 },
  'barteron.offer': OFFER,
  'barteron.removeOffer': { hash: HASH },
  'barteron.comment': { postid: HASH, msgparsed: { message: 'Хорошо', info: '5' } },
  'barteron.vote': { share: HASH, vsaddress: 'PAuthor', value: 5 },
}

const NAMES = Object.keys(VALID) as Array<keyof typeof BARTERON_ACTIONS>

function setup(overrides = {}) {
  const host = makeMockHost(overrides)
  const reg = new ActionRegistry({ host, resolver: makeResolver(), actions: BARTERON_ACTIONS })
  return { reg, host }
}

const exec = (reg: ActionRegistry, name: string, app: InstalledApp, data: unknown) =>
  reg.execute(name, app, data, new AbortController().signal)

describe('barteron actions', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  it('объявление уходит транзакцией brtoffer от имени пользователя и отвечает действием', async () => {
    const sendAppTransaction = vi.fn(async () => ({ id: 'act', transaction: 'f'.repeat(64) }))
    const { reg } = setup({ sendAppTransaction })
    const r = await exec(reg, 'barteron.offer', BARTERON, OFFER)
    expect(r).toEqual({ id: 'act', transaction: 'f'.repeat(64) })
    expect(sendAppTransaction).toHaveBeenCalledWith(
      BARTERON_APP_ID,
      'Barteron',
      expect.objectContaining({ type: 'brtoffer', message: expect.objectContaining({ s1: USER }) })
    )
  })

  it('каждое действие отдаёт свой тип транзакции', async () => {
    const sendAppTransaction = vi.fn(async () => ({}))
    const { reg } = setup({ sendAppTransaction })
    for (const name of NAMES) await exec(reg, name, BARTERON, VALID[name])
    expect(sendAppTransaction.mock.calls.map((c) => (c as unknown[])[2])).toEqual([
      expect.objectContaining({ type: 'brtaccount' }),
      expect.objectContaining({ type: 'brtoffer' }),
      expect.objectContaining({ type: 'contentDelete', message: { txidEdit: HASH } }),
      expect.objectContaining({ type: 'comment' }),
      expect.objectContaining({ type: 'upvoteShare', opReturnExtra: 'PAuthor 5' }),
    ])
  })

  it('другому приложению — отказ, даже с правом account', async () => {
    const sendAppTransaction = vi.fn()
    const { reg } = setup({ sendAppTransaction })
    for (const name of NAMES) {
      await expect(exec(reg, name, TEST_APP, VALID[name])).rejects.toThrow(/barteron_only/)
    }
    expect(sendAppTransaction).not.toHaveBeenCalled()
  })

  it('неверные данные — отказ до отправки, с полем в коде', async () => {
    const sendAppTransaction = vi.fn()
    const { reg } = setup({ sendAppTransaction })
    await expect(exec(reg, 'barteron.offer', BARTERON, { ...OFFER, geohash: '' })).rejects.toThrow(
      /brtoffer:invalid:geohash/
    )
    await expect(
      exec(reg, 'barteron.offer', BARTERON, { ...OFFER, address: 'PSomeoneElse' })
    ).rejects.toThrow(/brtoffer:invalid:address/)
    expect(sendAppTransaction).not.toHaveBeenCalled()
  })

  it('отказ ноды доходит до приложения отказом промиса', async () => {
    const { reg } = setup({
      sendAppTransaction: vi.fn(async () => {
        throw new Error('Вы уже оценили это')
      }),
    })
    await expect(exec(reg, 'barteron.vote', BARTERON, VALID['barteron.vote'])).rejects.toThrow(
      'Вы уже оценили это'
    )
  })

  it('все действия требуют входа', async () => {
    const { reg } = setup({ isUserAuthenticated: () => false })
    for (const name of NAMES) {
      await expect(exec(reg, name, BARTERON, VALID[name])).rejects.toThrow(/required_authorization/)
    }
  })

  it('все действия требуют права account', async () => {
    const host = makeMockHost()
    const reg = new ActionRegistry({
      host,
      resolver: makeResolver({ auto: false }),
      actions: BARTERON_ACTIONS,
    })
    for (const name of NAMES) {
      await expect(exec(reg, name, BARTERON, VALID[name])).rejects.toThrow(/permission_denied/)
    }
  })
})
