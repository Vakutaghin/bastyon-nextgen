/**
 * Управление флагом показа сид-фразы после регистрации
 */

import { NEED_SHOW_KEY_PREFIX } from '@/blockchain/constants/storage'

const STORAGE_KEY_PREFIX = NEED_SHOW_KEY_PREFIX

/**
 * Устанавливает флаг, что нужно показать сид-фразу для адреса
 */
export function setNeedShowMnemonic(address: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${address}`, 'true')
    }
  } catch (error) {
    console.error('Failed to set need show mnemonic flag:', error)
  }
}

/**
 * Проверяет, нужно ли показать сид-фразу для адреса
 */
export function shouldShowMnemonic(address: string | null): boolean {
  if (!address) {
    return false
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const value = localStorage.getItem(`${STORAGE_KEY_PREFIX}${address}`)
      return value === 'true'
    }
  } catch (error) {
    console.error('Failed to check need show mnemonic flag:', error)
  }

  return false
}

/**
 * Устанавливает флаг, что больше не нужно показывать сид-фразу для адреса
 */
export function setDontShowMnemonic(address: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${address}`, 'false')
    }
  } catch (error) {
    console.error('Failed to set dont show mnemonic flag:', error)
  }
}
