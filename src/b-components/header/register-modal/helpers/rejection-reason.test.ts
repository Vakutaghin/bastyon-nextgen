import { beforeAll, describe, expect, it } from 'vitest'
import { setI18nLocale } from '@/i18n'
import { registrationRejectionReason } from './rejection-reason'

beforeAll(() => setI18nLocale('ru'))

describe('registrationRejectionReason', () => {
  it('код 18 и NicknameDouble — имя занято', () => {
    expect(registrationRejectionReason('{"code":18,"message":"x"}')).toBe('это имя уже занято')
    expect(registrationRejectionReason('NicknameDouble')).toBe('это имя уже занято')
  })

  it('код 19 и NicknameLong — имя длинное', () => {
    expect(registrationRejectionReason('code: 19')).toBe('имя длиннее 20 символов')
    expect(registrationRejectionReason('NicknameLong')).toBe('имя длиннее 20 символов')
  })

  it('прочее — как пришло; код 180 не путает с 18', () => {
    expect(registrationRejectionReason('{"code":180}')).toBe('{"code":180}')
    expect(registrationRejectionReason('boom')).toBe('boom')
  })
})
