/**
 * Лента бустов ноды (`getboostfeed`): какие посты языка продвигают сейчас и на
 * сколько. Нужна ленте (вставлять продвигаемые посты) и окну продвижения
 * (прогноз, сколько уже набрал пост).
 *
 * Нода отдаёт только заглушки `{id, txid, txtype, boost, boosted, flags}`: сумму
 * бустов поста в сатоши за окно, без самого поста. Третий параметр — окно в
 * блоках (сверено с pocketnet.core, `GetBoostFeed`: высота − окно … высота);
 * старый клиент передаёт `60 * 24`, это около суток.
 */

import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'

/** Окно ленты бустов в блоках (блок — около минуты). */
export const BOOST_WINDOW_BLOCKS = 60 * 24

/** Заглушка буста из getboostfeed. */
export interface BoostStub {
  txid?: string
  /** Сумма бустов поста за окно, сатоши. */
  boost?: number
  flags?: Record<string, number>
}

interface BoostResponse {
  data?: { boosts?: BoostStub[] }
  boosts?: BoostStub[]
}

/** Бусты постов на языке `lang` за последние сутки, как их отдаёт нода. */
export async function fetchBoostFeed(lang: string): Promise<BoostStub[]> {
  const response = (await getByPRC({
    method: rpcEndpoints.getBoostFeed,
    parameters: [0, '', BOOST_WINDOW_BLOCKS, lang, [], [], [], [], []],
    cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2),
    options: { ex: true },
  })) as BoostResponse
  const boosts = response?.data?.boosts ?? response?.boosts
  return Array.isArray(boosts) ? boosts : []
}
