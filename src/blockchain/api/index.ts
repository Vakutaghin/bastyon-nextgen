/**
 * Модуль API
 * Экспорт всех функций для работы с API
 */

export {
  signRequest,
  createRequestSigner,
  type RequestSignOptions,
} from './request-signer'

export {
  createAuthenticatedApiClient,
  type AuthenticatedRpcOptions,
  type AuthenticatedRpcRequestParams,
  type ApiClientConfig,
} from './api-client'

export {
  captchaAPI,
  CaptchaAPI,
  type CaptchaData,
} from './captcha-api'

export {
  requestUnspents,
  type RequestUnspentsParams,
  type RequestUnspentsResult,
} from './free-balance-api'
