// Сохранение на телефон Android своим плагином DeviceSave
// (android/app/src/main/java/com/bastyon/app/plugins/save): Android 10+ —
// сразу в «Загрузки», папка Download/Bastyon; Android 7–9 — системное окно
// «Сохранить как». Раньше на телефоне было «Поделиться», а у Android там нет
// пункта «Сохранить» — только приложения, куда отправить.

import { Capacitor, registerPlugin } from '@capacitor/core'
import { t } from '@/i18n'
import { appToast } from '@/b-components/app-toast'

/** Что получилось: имя (система могла добавить « (1)») и папка, если её выбрало приложение. */
export interface DeviceSaved {
  name: string
  folder: string | null
}

interface SavedAnswer {
  name?: string
  folder?: string | null
}

interface DeviceSavePlugin {
  /** Окно «Сохранить как» закрыли — `cancelled`. */
  begin(o: { name: string }): Promise<{ token?: string; cancelled?: boolean }>
  /** Кусок файла в base64. */
  append(o: { token: string; data: string }): Promise<void>
  finish(o: { token: string }): Promise<SavedAnswer>
  abort(o: { token: string }): Promise<void>
  /** Скачанный ролик — копия с диска на стороне Android, мимо моста. */
  saveOffline(o: { id: string; name: string }): Promise<SavedAnswer & { cancelled?: boolean }>
}

export const DeviceSave = registerPlugin<DeviceSavePlugin>('DeviceSave')

/** Есть ли плагин: только в приложении для Android. */
export function hasDeviceSave(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/** Ответ плагина → итог; имени нет — то, что просили. */
export function deviceSaved(answer: SavedAnswer, asked: string): DeviceSaved {
  return { name: answer.name || asked, folder: answer.folder || null }
}

/**
 * Сказать, куда лёг файл: окна сохранения на Android 10+ нет, и без тоста
 * человек не узнает, что файл уже в «Загрузках».
 */
export function announceSaved(saved: DeviceSaved): void {
  appToast.success({
    message: saved.folder
      ? t('common.savedToDownloads', { folder: saved.folder, name: saved.name })
      : t('common.savedFile', { name: saved.name }),
  })
}
