/**
 * Логика «повышения лимитов» (legacy `abilityincrease` / `ustate.canincrease`).
 *
 * Чистые функции без Vue-реактивности — определяют, какой фактор (баланс/репутация)
 * блокирует повышение лимита. Пороги сверены 1:1 с legacy `js/satolist.js`
 * (`canincrease`): для шаблона `trial` — balance ≥ 1e9 sat и reputation ≥ 100;
 * для `video` — balance ≥ 5e8 sat и reputation ≥ 100.
 */

export type AbilityTemplate = 'trial' | 'video'

interface AbilityThresholds {
  /** Порог баланса в сатоши. */
  balance: number
  /** Порог репутации. */
  reputation: number
}

const THRESHOLDS: Record<AbilityTemplate, AbilityThresholds> = {
  trial: { balance: 1_000_000_000, reputation: 100 },
  video: { balance: 500_000_000, reputation: 100 },
}

/** Какие факторы блокируют повышение лимита. */
export interface AbilityGating {
  /** Баланса недостаточно (нужно купить PKOIN). */
  balance: boolean
  /** Репутации недостаточно. */
  reputation: boolean
  /** Хотя бы один фактор блокирует повышение. */
  blocked: boolean
}

/** Минимальная форма состояния пользователя, нужная для расчёта. */
export interface AbilityUserState {
  balance?: number | string | null
  reputation?: number | string | null
}

/**
 * Вычисляет, какие факторы блокируют повышение лимита для данного шаблона.
 *
 * @param state - состояние пользователя (баланс в сатоши, репутация)
 * @param template - шаблон лимита (`trial` по умолчанию — базовые лимиты публикаций)
 */
export function computeAbilityGating(
  state: AbilityUserState | null | undefined,
  template: AbilityTemplate = 'trial'
): AbilityGating {
  const th = THRESHOLDS[template]
  const balance = Number(state?.balance ?? 0)
  const reputation = Number(state?.reputation ?? 0)
  const balanceBlocked = !Number.isFinite(balance) || balance < th.balance
  const reputationBlocked = !Number.isFinite(reputation) || reputation < th.reputation
  return {
    balance: balanceBlocked,
    reputation: reputationBlocked,
    blocked: balanceBlocked || reputationBlocked,
  }
}
