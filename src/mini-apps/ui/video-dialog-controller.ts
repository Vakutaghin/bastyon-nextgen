/**
 * Окно загрузки ролика по просьбе мини-приложения (`videos.opendialog`):
 * singleton, как окно оплаты. `openVideoDialog` поднимает флажок, окно
 * (mini-app-video-dialog.vue, смонтировано в src.vue) загружает ролик на
 * видеосервер и отвечает указателем `peertube://host/uuid` и именем.
 *
 * Второе окно поверх первого не открывается: приложение получает отказ
 * `videos:dialog:busy`. Запрос приложения отменён (приложение закрыли, вышел
 * тайм-аут) — окно закрывается, начатая загрузка прерывается.
 */

import { computed, ref } from 'vue'

export interface VideoDialogResult {
  link: string
  name: string
}

const isOpenRef = ref(false)
const appNameRef = ref('')
let currentResolve: ((r: VideoDialogResult | null) => void) | null = null

export const isVideoDialogOpen = computed(() => isOpenRef.value)
/** Имя приложения, попросившего ролик: окно показывает, для кого он. */
export const videoDialogAppName = computed(() => appNameRef.value)

export class VideoDialogBusyError extends Error {
  constructor() {
    super('videos:dialog:busy')
    this.name = 'VideoDialogBusyError'
  }
}

/** null — человек закрыл окно, ролик не выбран. */
export function openVideoDialog(
  appName: string,
  signal?: AbortSignal
): Promise<VideoDialogResult | null> {
  if (isOpenRef.value) return Promise.reject(new VideoDialogBusyError())
  if (signal?.aborted) return Promise.resolve(null)
  appNameRef.value = appName
  isOpenRef.value = true
  return new Promise((resolve) => {
    currentResolve = resolve
    signal?.addEventListener(
      'abort',
      () => {
        if (currentResolve === resolve) resolveVideoDialog(null)
      },
      { once: true }
    )
  })
}

/** Ответ окна: ролик загружен или окно закрыли. */
export function resolveVideoDialog(result: VideoDialogResult | null): void {
  isOpenRef.value = false
  appNameRef.value = ''
  const resolve = currentResolve
  currentResolve = null
  resolve?.(result)
}

export function _resetVideoDialogForTests(): void {
  resolveVideoDialog(null)
}
