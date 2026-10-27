/**
 * Конвертация PendingComment (локальный optimistic-комментарий) в синтетический
 * GetComment-объект для рендера в общем списке. Помечается `temp: true` —
 * UI отрисует статус-бейдж "Ожидание" (`rejected` — «Ошибка»).
 */

import type { PendingComment } from '@/stores'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import { useAuthStore } from '@/blockchain'

export function pendingToGetComment(p: PendingComment): GetComment {
  const authStore = useAuthStore()
  const profile = (authStore.getUserProfile as { name?: string; i?: string } | null) ?? null
  return {
    type: 0,
    id: p.id,
    postid: p.postId,
    address: p.address,
    time: Math.floor(p.createdAt / 1000),
    timeUpd: Math.floor(p.createdAt / 1000),
    block: 0,
    msg: JSON.stringify({ message: p.message, url: '', images: [], info: '' }),
    scoreUp: 0,
    scoreDown: 0,
    children: 0,
    deleted: false,
    edit: false,
    flags: {},
    parentid: p.parentId || '',
    answerid: p.answerId || '',
    // В блоке — обычный комментарий, пока список его не отдаст; не попал — «Ошибка».
    temp: !p.confirmedAt && !p.failed,
    ...(p.failed ? { rejected: true } : {}),
    userprofile: {
      hash: '',
      address: p.address,
      id: 0,
      name: profile?.name || p.address,
      i: profile?.i || '',
    },
  }
}
