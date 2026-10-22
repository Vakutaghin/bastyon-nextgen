/**
 * Ссылки обозревателя внутри модалки «В блокчейне». Модалка отдаёт вниз
 * обработчик: hash-link и address-link открывают транзакцию или адрес в ней
 * же, а не уводят со страницы. Вне модалки обработчика нет — ссылки ведут в
 * обозреватель, как раньше. Блоки модалка не показывает: ссылка на блок
 * уходит в обозреватель и закрывает модалку.
 */

import type { InjectionKey } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { ChainInfoTarget } from '@/stores/chain-info-store'

/** txid — 64 hex-символа. Числовой суррогатный id поста им не является. */
export function isTxid(value: string | null | undefined): value is string {
  return /^[0-9a-f]{64}$/i.test(value ?? '')
}

export const CHAIN_LINK_KEY: InjectionKey<(target: ChainInfoTarget) => void> = Symbol('chain-link')

/** Запись модалки для ссылки обозревателя; ссылка не на транзакцию или адрес — null. */
export function chainTargetForRoute(to: RouteLocationRaw | undefined): ChainInfoTarget | null {
  if (!to || typeof to === 'string' || !('name' in to)) return null
  const params = (to.params ?? {}) as Record<string, unknown>
  if (to.name === 'explorer-tx' && params.txid) return { kind: 'tx', txid: String(params.txid) }
  if (to.name === 'explorer-address' && params.address) {
    return { kind: 'account', address: String(params.address) }
  }
  return null
}

/** Куда ведёт «Открыть в обозревателе» для записи модалки. */
export function explorerRouteFor(target: ChainInfoTarget): RouteLocationRaw {
  switch (target.kind) {
    case 'account':
      return { name: 'explorer-address', params: { address: target.address } }
    case 'comment':
      return { name: 'explorer-tx', params: { txid: target.id } }
    case 'post':
    case 'tx':
      return { name: 'explorer-tx', params: { txid: target.txid } }
  }
}
