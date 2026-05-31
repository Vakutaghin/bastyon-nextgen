/**
 * Словарь технических терминов блок-эксплорера → i18n-ключ пояснения.
 *
 * Используется компонентом InfoTooltip рядом с лейблами в meta-grid и стат-карточках.
 * Один источник истины — добавлять новые термины сюда, не разводить inline-tooltip-ы
 * по компонентам.
 *
 * Значения — ключи i18n в домене `glossary`. Сами тексты лежат в src/locales/*
 * и резолвятся через t(...) в компоненте-потребителе (НЕ на уровне модуля —
 * иначе сломается реактивность смены языка).
 */

export const EXPLORER_GLOSSARY = {
  // Сетевая статистика и tip
  height: 'glossary.height',
  hash: 'glossary.hash',
  emission: 'glossary.emission',
  netStakeWeight: 'glossary.netStakeWeight',
  chain: 'glossary.chain',
  difficulty: 'glossary.difficulty',
  bits: 'glossary.bits',
  merkleRoot: 'glossary.merkleRoot',
  prevHash: 'glossary.prevHash',
  nextHash: 'glossary.nextHash',
  confirmations: 'glossary.confirmations',
  blockReward: 'glossary.blockReward',
  staker: 'glossary.staker',

  // Транзакции
  vin: 'glossary.vin',
  vout: 'glossary.vout',
  fee: 'glossary.fee',
  opReturn: 'glossary.opReturn',
  scriptPubKey: 'glossary.scriptPubKey',
  coinbase: 'glossary.coinbase',
  coinstake: 'glossary.coinstake',
  txid: 'glossary.txid',

  // Pocketnet payload
  pocketPayload: 'glossary.pocketPayload',
  cScore: 'glossary.cScore',
  upvoteShare: 'glossary.upvoteShare',
  boost: 'glossary.boost',
} as const satisfies Record<string, string>

export type GlossaryTerm = keyof typeof EXPLORER_GLOSSARY

/** Возвращает i18n-ключ пояснения для термина. Резолвить через t(...) в компоненте. */
export function glossaryKey(term: GlossaryTerm): string {
  return EXPLORER_GLOSSARY[term]
}
