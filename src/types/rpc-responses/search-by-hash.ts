import type { BaseRpcResponse, StandardRpcTime } from './common'

/**
 * Тип найденной сущности. 'not_found' — нода вернула пустые данные.
 */
export type SearchByHashKind = 'block' | 'transaction' | 'address' | 'not_found' | string

export interface SearchByHashData {
  type: SearchByHashKind
}

/**
 * searchbyhash(query) — универсальный определитель типа строки на стороне ноды.
 * Используем как fallback, если локальный детектор формата не дал однозначного ответа.
 */
export type SearchByHashResponse = BaseRpcResponse<SearchByHashData, StandardRpcTime>
