/**
 * Keep-alive Matrix-сессии: лёгкий пинг (whoami, fallback на getProfileInfo),
 * чтобы access_token не протух и соединение жило. Таймер живёт в MatrixService;
 * здесь — только сам одиночный пинг (чистая функция от клиента).
 */
import type { MatrixClient as SdkMatrixClient } from 'matrix-js-sdk'
import { isOfflineNow } from '@/helpers/api/offline'

export async function runKeepAlive(client: SdkMatrixClient | null): Promise<void> {
  // Без сети пинговать некого: запрос только упадёт и напишет в консоль.
  if (!client || isOfflineNow()) return

  try {
    if (typeof client.whoami === 'function') {
      await client.whoami()
      return
    }

    if (typeof client.getProfileInfo === 'function') {
      const userId = typeof client.getUserId === 'function' ? client.getUserId() : null

      if (userId) {
        await client.getProfileInfo(userId)
      }
    }
  } catch (e) {
    console.warn('Matrix keep-alive failed:', e)
  }
}
