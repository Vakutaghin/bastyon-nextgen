/**
 * Подпись запросов (RPC + HTTP) через текущего залогиненного пользователя.
 *
 * Лениво импортирует auth-store и request-signer — это разрывает циклы
 * (request → auth-store → blockchain → ... → request) и не тянет крипто,
 * пока подпись реально не понадобилась.
 */

import type { T_RpcRequestParams } from './types/request'

/**
 * Подписывает RPC-параметры если требуется (`options.auth !== false`).
 * Возвращает новые params (или исходные, если auth не требуется или нет ключей).
 *
 * Если пользователь авторизован, но keyPair отсутствует — выставляет `state = 1`
 * (legacy-совместимость) без подписи. Серверу решать, достаточно ли этого.
 */
export async function signRpcParamsIfNeeded(
  params: T_RpcRequestParams
): Promise<T_RpcRequestParams> {
  const { useAuthStore } = await import('@/blockchain/store/auth-store')
  const { signRequest } = await import('@/blockchain/api/request-signer')

  const authStore = useAuthStore()
  const requiresAuth = params.options?.auth !== false

  if (requiresAuth) {
    const keyPair = authStore.getKeyPair
    const address = authStore.getUserAddress

    if (keyPair && address) {
      return signRequest(params, keyPair, address, {
        requireSignature: true,
        session: params.options?.session,
      }) as T_RpcRequestParams
    }
    if (authStore.isUserAuthenticated) {
      params.state = 1
    }
    // Если не авторизован — отправляем без подписи; сервер вернёт ошибку если нужно.
    return params
  }

  // auth: false — но если залогинен, добавим state=1 (legacy).
  if (authStore.isUserAuthenticated) {
    params.state = 1
  }
  return params
}

/**
 * Подписывает HTTP-data если требуется (`options.auth !== false`).
 * Возвращает новый объект signedData; бросает если auth требуется но пользователь
 * не залогинен либо подпись не сгенерировалась.
 *
 * `path` нужен только для отладочного логирования (captcha endpoints).
 */
export async function signHttpDataIfNeeded(
  data: Record<string, unknown>,
  options: { auth?: boolean; session?: string } | undefined,
  path: string
): Promise<Record<string, unknown>> {
  // По умолчанию auth: true (если не указано явно false)
  const requiresAuth = options?.auth !== false
  if (!requiresAuth) {
    return { ...data }
  }

  const { useAuthStore } = await import('@/blockchain/store/auth-store')
  const { signRequest } = await import('@/blockchain/api/request-signer')

  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (keyPair && address) {
    const signedData = signRequest(data, keyPair, address, {
      requireSignature: true,
      session: options?.session,
    }) as Record<string, unknown>

    if (!signedData.signature) {
      console.error('Signature was not added to request data', {
        path,
        hasKeyPair: !!keyPair,
        hasAddress: !!address,
        dataKeys: Object.keys(data),
        signedDataKeys: Object.keys(signedData),
      })
      throw new Error('Failed to generate signature for request')
    }

    // Дебаг-лог только для captcha endpoints
    if (path.includes('captcha') || path.includes('makecaptcha')) {
      const sig = signedData.signature as Record<string, unknown> | undefined
      console.debug('Captcha request signature', {
        path,
        hasSignature: !!signedData.signature,
        signatureType: typeof signedData.signature,
        isObject: typeof signedData.signature === 'object',
        hasAddress: !!(sig && 'address' in sig),
        address: (sig && 'address' in sig ? sig.address : null) || address,
        signatureKeys: sig ? Object.keys(sig) : [],
      })
    }

    return signedData
  }

  if (authStore.isUserAuthenticated) {
    // Если авторизован, но нет ключей, добавляем state
    return { ...data, state: 1 }
  }

  // Если не авторизован, но требуется авторизация — отказываем явно
  console.warn('[request] Auth required but user not authenticated for', path)
  throw new Error(
    'Authentication required for this request. Please ensure you are registered and logged in.'
  )
}
