// Ход установки Tor и IPFS — на языке интерфейса: раньше показывался английский
// текст из Rust («1234 / 5678 bytes», «Extracting bundle»).

import { beforeAll, describe, expect, it } from 'vitest'
import { setI18nLocale } from '@/i18n'
import { installProgressText } from './install-progress'

beforeAll(() => setI18nLocale('ru'))

const KEYS = { downloading: 'header.torStatusInstalling', preparing: 'header.ipfsPreparing' }

describe('installProgressText', () => {
  it('скачивание — в процентах, дальше — этап, до начала — подготовка', () => {
    const at = (phase: 'starting' | 'downloading' | 'verifying' | 'extracting' | 'ready') =>
      installProgressText({ phase, fraction: 0.126 }, KEYS)
    expect(at('starting')).toBe('Загрузка: 13%')
    expect(at('downloading')).toBe('Загрузка: 13%')
    expect(at('verifying')).toBe('Проверка загруженного…')
    expect(at('extracting')).toBe('Распаковка…')
    expect(at('ready')).toBe('Распаковка…')
    expect(installProgressText(null, KEYS)).not.toMatch(/Загрузка:/)
  })
})
