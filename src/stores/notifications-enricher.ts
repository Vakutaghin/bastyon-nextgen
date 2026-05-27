/**
 * Догрузка связанных сущностей для уведомлений: посты/комменты/профили.
 *
 * Вынесено из notifications-store, чтобы:
 * - изолировать сетевой код от Pinia state-management;
 * - тестировать enrichment без Pinia (передаём caches как обычный объект).
 *
 * Caches мутируются на месте. Caller передаёт setEnriching для UI-индикатора.
 */

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCall, rpcCallWithAuth } from '@/helpers/api/request'
import { generateCacheHash } from '@/helpers/common/cache-hash'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import type {
  NotificationItem,
  NotificationPostSnapshot,
  NotificationCommentSnapshot,
  NotificationUserSnapshot,
} from './notifications-types'
import { extractCommentSnapshot, pickStr, pickArr } from './notifications-mappers'

export interface EnrichmentCaches {
  postCache: Record<string, NotificationPostSnapshot & Record<string, unknown>>
  commentCache: Record<string, NotificationCommentSnapshot & Record<string, unknown>>
  profileCache: Record<string, NotificationUserSnapshot & { profile?: UserProfile }>
  enrichedIds: Set<string>
}

/**
 * Собирает три батча (посты/комменты/профили) для уведомлений, которые ещё
 * не обогащены и не имеют snapshot. Делает Promise.all и пишет в caches.
 * Идемпотентна: повторный вызов с теми же уведомлениями — no-op.
 */
export async function enrichNotifications(
  caches: EnrichmentCaches,
  notifications: NotificationItem[],
  setEnriching: (v: boolean) => void
): Promise<void> {
  if (!notifications || notifications.length === 0) return

  const fresh = notifications.filter((n) => !caches.enrichedIds.has(n.id))
  if (fresh.length === 0) return
  fresh.forEach((n) => caches.enrichedIds.add(n.id))

  const postTxids = new Set<string>()
  const commentTxids = new Set<string>()
  const profileAddrs = new Set<string>()

  for (const n of fresh) {
    // Пост — нужен для типов с shareId; либо если comment имеет postid, чтобы открыть родительский пост
    const postId = n.shareId ?? n.commentSnapshot?.postid
    if (postId && !caches.postCache[postId] && !(n.postSnapshot && n.postSnapshot.message)) {
      postTxids.add(postId)
    }
    // Комментарий — id уведомления для type=comment является txid комментария
    if (n.type === 'comment' && !n.commentSnapshot?.message && !caches.commentCache[n.id]) {
      commentTxids.add(n.id)
    }
    // Профиль отправителя
    const addr = n.from ?? n.fromSnapshot?.address
    if (addr && !caches.profileCache[addr]?.name && !n.fromSnapshot?.name) {
      profileAddrs.add(addr)
    }
  }

  const tasks: Array<Promise<unknown>> = []
  if (postTxids.size > 0) {
    const ids = [...postTxids]
    tasks.push(
      rpcCallWithAuth<unknown[]>({
        method: rpcEndpoints.getRawTransactionWithMessageById,
        parameters: [ids],
        cachehash: generateCacheHash(),
        options: {},
        state: 1,
      })
        .then((arr) => {
          const list = Array.isArray(arr) ? arr : []
          for (const raw of list) {
            if (!raw || typeof raw !== 'object') continue
            const o = raw as Record<string, unknown>
            const txid = pickStr(o, 'txid', 'hash', 'id')
            if (!txid) continue
            caches.postCache[txid] = {
              ...(o as Record<string, unknown>),
              txid,
              caption: pickStr(o, 'c', 'caption', 'title'),
              message: pickStr(o, 'm', 'message', 'text'),
              type: pickStr(o, 'type'),
              images: pickArr<string>(o, 'i', 'images'),
            }
          }
        })
        .catch((e) => {
          console.warn('[notifications] enrich posts failed', e)
        })
    )
  }
  if (commentTxids.size > 0) {
    // Комментарии — это тоже tx, поэтому грузим тем же RPC
    const ids = [...commentTxids]
    tasks.push(
      rpcCallWithAuth<unknown[]>({
        method: rpcEndpoints.getRawTransactionWithMessageById,
        parameters: [ids],
        cachehash: generateCacheHash(),
        options: {},
        state: 1,
      })
        .then((arr) => {
          const list = Array.isArray(arr) ? arr : []
          for (const raw of list) {
            const snap = extractCommentSnapshot(raw)
            if (snap) caches.commentCache[snap.id] = snap
          }
        })
        .catch((e) => {
          console.warn('[notifications] enrich comments failed', e)
        })
    )
  }
  if (profileAddrs.size > 0) {
    const addrs = [...profileAddrs]
    tasks.push(
      rpcCall<UserProfile[]>({
        method: rpcEndpoints.getUserProfile,
        parameters: [addrs],
        options: { auth: false },
      })
        .then((arr) => {
          const list = Array.isArray(arr) ? arr : []
          for (const p of list) {
            if (!p || !p.address) continue
            caches.profileCache[p.address] = {
              address: p.address,
              name: p.name,
              avatar: typeof p.i === 'string' ? p.i : undefined,
              reputation: typeof p.reputation === 'number' ? p.reputation : undefined,
              profile: p,
            }
          }
        })
        .catch((e) => {
          console.warn('[notifications] enrich profiles failed', e)
        })
    )
  }

  if (tasks.length === 0) return
  setEnriching(true)
  try {
    await Promise.all(tasks)
  } finally {
    setEnriching(false)
  }
}
