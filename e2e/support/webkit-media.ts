import { test } from '@playwright/test'

/**
 * Playwright WebKit на Windows собран без MediaSource, AudioContext и
 * MediaRecorder: `canPlayType('video/mp4')` отвечает «probably», а ролик стоит
 * на нуле, кадров для обложки нет, голосовые не играют и не пишутся. Тесты
 * медиа там пропускаем; на macOS и в Chromium они идут как обычно.
 */
export const WEBKIT_NO_MEDIA =
  'Playwright WebKit на Windows: нет MediaSource, AudioContext и MediaRecorder — медиа не играет'

const noMedia = (project: string): boolean => project === 'webkit' && process.platform === 'win32'

/** Внутри теста: пропустить его в WebKit на Windows. */
export function skipWithoutWebKitMedia(): void {
  test.skip(noMedia(test.info().project.name), WEBKIT_NO_MEDIA)
}

/** На уровне файла: все тесты файла — про воспроизведение. */
export function skipFileWithoutWebKitMedia(): void {
  test.skip(({ browserName }) => noMedia(browserName), WEBKIT_NO_MEDIA)
}
