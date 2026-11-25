/** Сервер отказал: вы не в этой комнате или её больше нет (403, 404). */
export function isNotInRoomError(error: unknown): boolean {
  const e = error as {
    errcode?: unknown
    httpStatus?: unknown
    data?: { errcode?: unknown }
  } | null
  const code = e?.errcode ?? e?.data?.errcode
  return (
    code === 'M_FORBIDDEN' ||
    code === 'M_NOT_FOUND' ||
    e?.httpStatus === 403 ||
    e?.httpStatus === 404
  )
}

/**
 * Вступить по приглашению нельзя совсем — сервер отказал (пригласивший вышел
 * из чата, приглашение отозвали, комнаты больше нет), а не связь подвела.
 * Повторять тогда бесполезно: приглашение остаётся только убрать из списка.
 */
export function isInviteGone(error: unknown): boolean {
  return isNotInRoomError(error)
}
