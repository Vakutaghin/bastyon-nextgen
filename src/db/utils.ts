import type { BaseEntity } from './types'

/**
 * Утилита для установки временных меток
 */
export function setTimestamps<T extends BaseEntity<any>>(entity: T, isNew: boolean = false): T {
  const now = Date.now()
  if (isNew) {
    entity.createdAt = now
  }
  entity.updatedAt = now
  return entity
}
