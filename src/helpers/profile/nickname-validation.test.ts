import { describe, it, expect, vi } from 'vitest'

vi.mock('@/i18n', () => ({
  t: (key: string) => key,
}))

import {
  containsReservedName,
  validateProfileNickname,
  validateRegistrationNickname,
} from './nickname-validation'

describe('validateRegistrationNickname', () => {
  it('принимает латиницу, цифры и подчёркивание до 20 символов', () => {
    expect(validateRegistrationNickname('alice_42')).toBeNull()
  })

  it('отвергает пустое имя, чужие символы и слишком длинное', () => {
    expect(validateRegistrationNickname('  ')).toBe('accountMsg.enterNickname')
    expect(validateRegistrationNickname('a/b')).toBe('accountMsg.nicknameInvalidChars')
    expect(validateRegistrationNickname('x'.repeat(21))).toBe('accountMsg.nicknameTooLong')
  })

  it('отвергает имя со словом bastyon или pocketnet, как старый клиент', () => {
    expect(validateRegistrationNickname('Bastyon_team')).toBe('accountMsg.nicknameReserved')
    expect(validateRegistrationNickname('pocket_net1')).toBe('accountMsg.nicknameReserved')
  })
})

describe('containsReservedName', () => {
  it('сравнивает только буквы — разделители не помогают обойти', () => {
    expect(containsReservedName('bas_ty_on')).toBe(true)
    expect(containsReservedName('b4styon')).toBe(false)
  })
})

describe('validateProfileNickname (N26)', () => {
  it('новое имя проверяется по правилам регистрации: «a/b» ломал бы /:userName', () => {
    expect(validateProfileNickname('a/b', 'alice')).toBe('accountMsg.nicknameInvalidChars')
  })

  it('неизменённое имя не мешает сохранить остальные поля профиля', () => {
    // Официальный аккаунт со словом «bastyon» или имя по старым правилам.
    expect(validateProfileNickname('Bastyon', 'Bastyon')).toBeNull()
  })

  it('пустое имя не проходит, даже если прежнего не было', () => {
    expect(validateProfileNickname('', undefined)).toBe('accountMsg.enterNickname')
  })
})
