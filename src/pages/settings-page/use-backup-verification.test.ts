// Проверка бэкапа (VP-7/VP-8): три случайных слова из 12 или хвост ключа,
// успех отмечается для адреса, ошибка стирает ответы, а dispose убирает
// секрет из памяти. Сам разбор ответов — helpers/backup (свои тесты), здесь
// он настоящий: важно, что композибл спрашивает именно выбранные позиции.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getUserAddress: 'PA' as string | null },
  loadAccountSecret: vi.fn(),
}))
vi.mock('@/stores', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('./load-account-secret', () => ({ loadAccountSecret: mocks.loadAccountSecret }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { CHALLENGE_WORDS, KEY_TAIL_CHARS } from '@/helpers/backup/backup-verification'
import { useBackupVerification } from './use-backup-verification'

const WORDS = [
  'abandon',
  'ability',
  'able',
  'about',
  'above',
  'absent',
  'absorb',
  'abstract',
  'absurd',
  'abuse',
  'access',
  'accident',
]
const KEY = 'L1aW4aubDFB7yfras2S1mN3bqg9nwySY8nkoLmJebSLD5BWv3ENZ'

function answerFor(positions: number[]): string[] {
  return positions.map((p) => WORDS[p - 1]!)
}

describe('useBackupVerification', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.auth.getUserAddress = 'PA'
    mocks.loadAccountSecret.mockReset().mockResolvedValue({
      format: 'mnemonic',
      raw: WORDS.join(' '),
    })
  })

  it('без отметки бэкап считается непроверенным', () => {
    expect(useBackupVerification().status.value).toEqual({ state: 'never', verifiedAt: null })
  })

  it('мнемоника: спрашивает разные слова по возрастанию, пока все поля не заполнены — отправить нельзя', async () => {
    const b = useBackupVerification()
    await expect(b.start()).resolves.toBe(true)

    expect(b.kind.value).toBe('words')
    expect(b.positions.value).toHaveLength(CHALLENGE_WORDS)
    expect(new Set(b.positions.value).size).toBe(CHALLENGE_WORDS)
    expect([...b.positions.value].sort((x, y) => x - y)).toEqual(b.positions.value)
    for (const p of b.positions.value) expect(p).toBeGreaterThanOrEqual(1)
    for (const p of b.positions.value) expect(p).toBeLessThanOrEqual(WORDS.length)
    expect(b.canSubmit.value).toBe(false)

    b.answers.value = answerFor(b.positions.value).map((w, i) => (i === 0 ? '  ' : w))
    expect(b.canSubmit.value).toBe(false)
    b.answers.value = answerFor(b.positions.value)
    expect(b.canSubmit.value).toBe(true)
  })

  it('верные слова (регистр и пробелы не важны) отмечают бэкап проверенным для этого адреса', async () => {
    const b = useBackupVerification()
    await b.start()
    b.answers.value = answerFor(b.positions.value).map((w) => ` ${w.toUpperCase()} `)

    expect(b.submit()).toBe(true)
    expect(b.error.value).toBe('')
    expect(b.status.value.state).toBe('ok')

    mocks.auth.getUserAddress = 'PB'
    expect(useBackupVerification().status.value.state).toBe('never')
  })

  it('неверное слово: ошибка, ответы стёрты, отметки нет', async () => {
    const b = useBackupVerification()
    await b.start()
    const answers = answerFor(b.positions.value)
    answers[answers.length - 1] = 'zoo'
    b.answers.value = answers

    expect(b.submit()).toBe(false)
    expect(b.error.value).toBe('vault.backupWordsWrong')
    expect(b.answers.value).toEqual(answers.map(() => ''))
    expect(b.status.value.state).toBe('never')
  })

  it('аккаунт по ключу: спрашивает последние символы ключа', async () => {
    mocks.loadAccountSecret.mockResolvedValue({ format: 'wif', raw: KEY })
    const b = useBackupVerification()
    await b.start()

    expect(b.kind.value).toBe('key')
    expect(b.positions.value).toEqual([])
    expect(b.answers.value).toEqual([''])
    expect(b.keyTailChars).toBe(KEY_TAIL_CHARS)

    b.answers.value = ['xxxxxx']
    expect(b.submit()).toBe(false)
    expect(b.error.value).toBe('vault.backupKeyWrong')

    b.answers.value = [KEY.slice(-KEY_TAIL_CHARS).toLowerCase()]
    expect(b.submit()).toBe(true)
    expect(b.status.value.state).toBe('ok')
  })

  it.each([
    ['нет активного аккаунта', () => (mocks.auth.getUserAddress = null), 'noActiveAccount'],
    [
      'секрет не сохранён',
      () => mocks.loadAccountSecret.mockResolvedValue(null),
      'noSavedSeedOrKey',
    ],
    [
      'секрет в неизвестном формате',
      () => mocks.loadAccountSecret.mockRejectedValue(new Error('unknown-format')),
      'unknownDataFormat',
    ],
  ])('%s: start() не начинает проверку и объясняет почему', async (_name, arrange, key) => {
    arrange()
    const b = useBackupVerification()
    await expect(b.start()).resolves.toBe(false)
    expect(b.error.value).toBe(`accountMsg.${key}`)
    expect(b.loading.value).toBe(false)
  })

  it('dispose стирает секрет: после него прежние ответы не проходят', async () => {
    const b = useBackupVerification()
    await b.start()
    const positions = [...b.positions.value]
    b.dispose()

    expect(b.answers.value).toEqual([])
    expect(b.positions.value).toEqual([])

    b.positions.value = positions
    b.answers.value = answerFor(positions)
    expect(b.submit()).toBe(false)
    expect(b.status.value.state).toBe('never')
  })
})
