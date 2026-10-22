/**
 * Разбор Pocketnet-специфичной полезной нагрузки транзакции в типизированную форму.
 *
 * Source of truth — слоты транзакции (s1..s5, i1..i5). У каждого типа свой
 * семантический контракт, сверен с реальными данными mainnet:
 *
 *   Post (200)         s1=author,  s2=postId,    s3=editRoot
 *   Video (201)        s1=author,  s2=videoId,   s3=editRoot
 *   Article (202), Stream (209), Audio (210) — как пост
 *   Comment (204)      s1=author,  s2=commentId, s3=parentPostId
 *   CommentEdit (205)  s1=author,  s2=editTxId,  s3=originalCommentId
 *   UpvoteShare (300)  s1=voter,   s2=postId,    i1=value (1..5)
 *   cScore (301)       s1=voter,   s2=commentId, i1=value (+1/−1)
 *   Subscribe (302)    s1=from,    s2=toAddress
 *   SubscribePrivate (303)  s1=from, s2=toAddress
 *   Unsubscribe (304)  s1=from,    s2=toAddress
 *   Blocking (305)     s1=actor,   s2=targetAddress
 *   Unblocking (306)   s1=actor,   s2=targetAddress
 *   BoostContent (208) s1=booster, s2=postId; сумма буста — комиссия
 *                      (входы − выходы): выходов на чужие адреса у буста нет
 *   AccountSetting/AccountSet (100/103)  s1=accountAddress
 *
 * Если код не распознан — возвращаем `null`. Это сигнал tx-payload-card-у
 * показать «не Pocketnet-специфичная транзакция» и не рендерить карточку.
 */

import type { Transaction } from '@/types/rpc-responses/get-transactions'

export type PocketPayload =
  | { kind: 'post'; type: 200 | 201 | 202 | 209 | 210; author: string; postId: string }
  | { kind: 'comment'; type: 204; author: string; commentId: string; parentPostId: string }
  | { kind: 'comment-edit'; type: 205; author: string; editTxId: string; originalCommentId: string }
  | { kind: 'upvote-share'; type: 300; voter: string; postId: string; value: number }
  | { kind: 'c-score'; type: 301; voter: string; commentId: string; value: number }
  | {
      kind: 'subscribe'
      type: 302 | 303 | 304
      from: string
      to: string
      isUnsubscribe: boolean
      isPrivate: boolean
    }
  | { kind: 'block-user'; type: 305 | 306; actor: string; target: string; isUnblock: boolean }
  | { kind: 'boost'; type: 208; booster: string; postId: string; amount: number }
  | { kind: 'account'; type: 100 | 103; account: string; isSetting: boolean }

export function parsePocketnetPayload(tx: Transaction | null | undefined): PocketPayload | null {
  if (!tx) return null
  const t = tx.type
  const s1 = tx.s1 ?? ''
  const s2 = tx.s2 ?? ''
  const s3 = tx.s3 ?? ''
  const i1 = tx.i1 ?? 0

  switch (t) {
    case 200:
    case 201:
    case 202:
    case 209:
    case 210:
      if (!s1 || !s2) return null
      return { kind: 'post', type: t, author: s1, postId: s2 }

    case 204:
      if (!s1 || !s2 || !s3) return null
      return { kind: 'comment', type: 204, author: s1, commentId: s2, parentPostId: s3 }

    case 205:
      if (!s1 || !s2 || !s3) return null
      return { kind: 'comment-edit', type: 205, author: s1, editTxId: s2, originalCommentId: s3 }

    case 300:
      if (!s1 || !s2) return null
      return { kind: 'upvote-share', type: 300, voter: s1, postId: s2, value: i1 }

    case 301:
      if (!s1 || !s2) return null
      return { kind: 'c-score', type: 301, voter: s1, commentId: s2, value: i1 }

    case 302:
    case 303:
    case 304:
      if (!s1 || !s2) return null
      return {
        kind: 'subscribe',
        type: t,
        from: s1,
        to: s2,
        isUnsubscribe: t === 304,
        isPrivate: t === 303,
      }

    case 305:
    case 306:
      if (!s1 || !s2) return null
      return { kind: 'block-user', type: t, actor: s1, target: s2, isUnblock: t === 306 }

    case 208: {
      if (!s1 || !s2) return null
      const inputs = (tx.vin ?? []).reduce((s, v) => s + (v.value ?? 0), 0)
      const outputs = (tx.vout ?? []).reduce((s, v) => s + (v.value ?? 0), 0)
      const amount = Math.max(0, Math.round((inputs - outputs) * 1e8) / 1e8)
      return { kind: 'boost', type: 208, booster: s1, postId: s2, amount }
    }

    case 100:
    case 103:
      if (!s1) return null
      return { kind: 'account', type: t, account: s1, isSetting: t === 100 }

    default:
      return null
  }
}
