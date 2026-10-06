/**
 * Загрузчик каталога мини-приложений через RPC ноды. Один на приложение:
 * им пользуются и страница «Сервисы», и полка в ленте.
 */

import { RemoteAppsLoader } from '@/mini-apps/registry/remote-registry'

let loaderPromise: Promise<RemoteAppsLoader> | null = null

// Ленивый импорт: иначе getByPRC попадёт в тестовое окружение.
export function getCatalogLoader(): Promise<RemoteAppsLoader> {
  if (!loaderPromise) {
    loaderPromise = import('@/helpers/api/request').then(({ getByPRC }) => {
      const rpc = async (method: string, parameters: unknown[] | Record<string, unknown>) => {
        return getByPRC({
          method,
          parameters,
          options: { auth: false },
        } as Parameters<typeof getByPRC>[0])
      }
      return new RemoteAppsLoader(rpc)
    })
  }
  return loaderPromise
}
