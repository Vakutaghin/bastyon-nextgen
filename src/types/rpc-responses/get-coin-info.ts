import type { BaseRpcResponse, StandardRpcTime } from './common'

/**
 * Данные ответа getcoininfo.
 *
 * Возвращает агрегированные параметры монеты:
 *  - emission — текущая эмиссия PKOIN (целое число монет, без сатоши);
 *  - height — высота блока, на которой посчитана эмиссия.
 */
export interface GetCoinInfoData {
  emission: number
  height: number
}

/**
 * Полный ответ RPC метода getcoininfo. Не требует параметров, без авторизации.
 */
export type GetCoinInfoResponse = BaseRpcResponse<GetCoinInfoData, StandardRpcTime>
