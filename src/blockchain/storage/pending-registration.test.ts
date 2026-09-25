import { describe, it, expect, beforeEach, vi } from 'vitest'

import { memStorage } from './vault/test-mem-storage'
import {
  clearPendingRegistrationFor,
  loadPendingRegistration,
  markPendingRegistrationStep,
  peekPendingRegistration,
  savePendingRegistration,
} from './pending-registration'
import { clearAllUserData } from './storage-manager'

const rec = { nickname: 'bob', address: 'PB', step: 1, timestamp: Date.now() }

beforeEach(() => vi.stubGlobal('localStorage', memStorage()))

describe('pending-registration (X10)', () => {
  it('save/peek/load; протухшая запись удаляется только load-ом', () => {
    savePendingRegistration({ ...rec, timestamp: Date.now() - 31 * 60_000 })
    expect(peekPendingRegistration()).toMatchObject({ address: 'PB', step: 1 })
    expect(loadPendingRegistration()).toBeNull()
    expect(peekPendingRegistration()).toBeNull()
  })

  it('запись с отказом ноды не протухает: повтор идёт с её ключами', () => {
    const old = Date.now() - 2 * 24 * 60 * 60_000
    savePendingRegistration({ ...rec, step: 2, timestamp: old, error: 'NicknameDouble' })
    expect(loadPendingRegistration()).toMatchObject({ address: 'PB', error: 'NicknameDouble' })
  })

  it('clearPendingRegistrationFor чистит только запись своего адреса', () => {
    savePendingRegistration(rec)
    clearPendingRegistrationFor('POTHER')
    expect(peekPendingRegistration()).not.toBeNull()
    clearPendingRegistrationFor('PB')
    expect(peekPendingRegistration()).toBeNull()
    expect(localStorage.getItem('pending_nickname')).toBeNull()
  })

  it('markPendingRegistrationStep сохраняет остальные поля; битый JSON → null', () => {
    savePendingRegistration(rec)
    markPendingRegistrationStep(3)
    expect(peekPendingRegistration()).toMatchObject({ nickname: 'bob', address: 'PB', step: 3 })
    localStorage.setItem('pending_registration', '{oops')
    expect(peekPendingRegistration()).toBeNull()
  })

  it('clearAllUserData снимает брошенную регистрацию (V8)', () => {
    savePendingRegistration(rec)
    clearAllUserData()
    expect(peekPendingRegistration()).toBeNull()
  })
})
