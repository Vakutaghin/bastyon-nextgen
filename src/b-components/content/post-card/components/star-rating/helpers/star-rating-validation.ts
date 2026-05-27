// Правила, ограничивающие возможность голосования: возраст аккаунта, репутация, низкие оценки.

/** "Новый" пользователь — зарегистрирован менее 24ч назад (или нет regdate). */
export function isNewUser(userProfile: any): boolean {
  if (!userProfile) return false
  const regdate = userProfile.regdate
  if (!regdate) return true

  const regDateObj = new Date(regdate * 1000)
  const hours24 = 24 * 60 * 60 * 1000
  return regDateObj.getTime() + hours24 > Date.now()
}

/** Репутация ≤ -12 — полная блокировка голосования. */
export function isReputationBlocked(userProfile: any): boolean {
  if (!userProfile) return false
  const reputation = userProfile.reputation || 0
  return reputation <= -12
}

/**
 * Низкие оценки (≤3 звезд) разрешены только пользователям с репутацией ≥100 —
 * защита от массового даунвоутинга новичками.
 */
export function isLowRatingBlocked(value: number, userProfile: any): boolean {
  const reputation = userProfile.reputation || 0
  return value <= 3 && reputation < 100
}
