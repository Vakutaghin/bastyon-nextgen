// Правка своего профиля до блока: нода отдаёт прежние имя и аватар, а
// показывается новое — пока транзакция не в блоке, нода не догнала или не
// прошёл час.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notifyTransactionSettled } from '../core/transactions/broadcast-events'
import { holdProfileEdit, withPendingProfileEdit } from './pending-profile-edit'

const ME = 'PMe'
const OLD = { address: ME, name: 'Alice', i: 'https://img/old.jpg', reputation: 12 }

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('withPendingProfileEdit', () => {
  it('новый аватар поверх прежнего профиля с ноды, прочие поля — с ноды', () => {
    holdProfileEdit(ME, 'tx1', { name: 'Alice', i: 'https://img/new.jpg' })
    expect(withPendingProfileEdit(OLD)).toEqual({ ...OLD, i: 'https://img/new.jpg' })
    // Чужой профиль не трогает.
    expect(withPendingProfileEdit({ ...OLD, address: 'POther' }).i).toBe('https://img/old.jpg')
  })

  it('снятый аватар тоже держится', () => {
    holdProfileEdit(ME, 'tx1', { name: 'Alice', i: '' })
    expect(withPendingProfileEdit(OLD).i).toBe('')
  })

  it('нода отдала новое — правка больше не нужна', () => {
    holdProfileEdit(ME, 'tx1', { name: 'Alice', i: 'https://img/new.jpg' })
    const fresh = { ...OLD, i: 'https://img/new.jpg' }
    expect(withPendingProfileEdit(fresh)).toBe(fresh)
    expect(localStorage.getItem('BST_PENDING_PROFILE_PMe')).toBeNull()
  })

  it('транзакция в блоке или истекла — правка снята', () => {
    holdProfileEdit(ME, 'tx1', { i: 'https://img/new.jpg' })
    notifyTransactionSettled('tx2', true)
    expect(withPendingProfileEdit(OLD).i).toBe('https://img/new.jpg')
    notifyTransactionSettled('tx1', false)
    expect(withPendingProfileEdit(OLD).i).toBe('https://img/old.jpg')
  })

  it('через час без блока — прежний профиль', () => {
    vi.useFakeTimers()
    holdProfileEdit(ME, 'tx1', { i: 'https://img/new.jpg' })
    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(withPendingProfileEdit(OLD).i).toBe('https://img/old.jpg')
  })
})
