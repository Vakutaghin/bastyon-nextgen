// Сохранение на Android: плагин есть только в приложении для Android; тост
// говорит, куда лёг файл, — в «Загрузки» с папкой или просто имя после окна
// «Сохранить как»; имени от системы нет — то, что просили.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  native: true,
  platform: 'android',
  success: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => h.native, getPlatform: () => h.platform },
  registerPlugin: () => ({}),
}))
vi.mock('@/b-components/app-toast', () => ({ appToast: { success: h.success } }))

import { t } from '@/i18n'
import { announceSaved, deviceSaved, hasDeviceSave } from './device-save'

beforeEach(() => {
  vi.clearAllMocks()
  h.native = true
  h.platform = 'android'
})

describe('hasDeviceSave', () => {
  it('только приложение для Android', () => {
    expect(hasDeviceSave()).toBe(true)
    h.platform = 'ios'
    expect(hasDeviceSave()).toBe(false)
    h.platform = 'android'
    h.native = false
    expect(hasDeviceSave()).toBe(false)
  })
})

describe('deviceSaved', () => {
  it('имя от системы важнее; нет его — то, что просили; пустая папка — нет папки', () => {
    expect(deviceSaved({ name: 'a (1).zip', folder: 'Download/Bastyon' }, 'a.zip')).toEqual({
      name: 'a (1).zip',
      folder: 'Download/Bastyon',
    })
    expect(deviceSaved({}, 'a.zip')).toEqual({ name: 'a.zip', folder: null })
    expect(deviceSaved({ name: '', folder: '' }, 'a.zip')).toEqual({ name: 'a.zip', folder: null })
  })
})

describe('announceSaved', () => {
  it('«Загрузки» — с папкой', () => {
    announceSaved({ name: 'Ролик.mp4', folder: 'Download/Bastyon' })
    const message = t('common.savedToDownloads', { folder: 'Download/Bastyon', name: 'Ролик.mp4' })
    expect(h.success).toHaveBeenCalledWith({ message })
    expect(message).toContain('Download/Bastyon')
    expect(message).toContain('Ролик.mp4')
  })

  it('после окна «Сохранить как» папку выбрал человек — только имя', () => {
    announceSaved({ name: 'Ролик.mp4', folder: null })
    expect(h.success).toHaveBeenCalledWith({
      message: t('common.savedFile', { name: 'Ролик.mp4' }),
    })
  })
})
