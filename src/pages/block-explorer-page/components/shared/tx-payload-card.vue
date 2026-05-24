<template>
  <SC_PayloadCard v-if='payload'>
    <SC_PayloadHeader>
      <SC_PayloadIcon>{{ icon }}</SC_PayloadIcon>
      <SC_PayloadTitle>{{ title }}</SC_PayloadTitle>
    </SC_PayloadHeader>

    <SC_PayloadFields>
      <!-- POST / VIDEO / ARTICLE / STREAM -->
      <template v-if='payload.kind === "post"'>
        <SC_PayloadFieldLabel>Автор</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.author' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>ID контента</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.postId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- COMMENT -->
      <template v-else-if='payload.kind === "comment"'>
        <SC_PayloadFieldLabel>Автор</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.author' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>ID коммента</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.commentId' :to='undefined' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>К посту</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.parentPostId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- COMMENT EDIT -->
      <template v-else-if='payload.kind === "comment-edit"'>
        <SC_PayloadFieldLabel>Автор</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.author' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>Редакция</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.editTxId' :to='undefined' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>Исходный</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.originalCommentId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- UPVOTE SHARE -->
      <template v-else-if='payload.kind === "upvote-share"'>
        <SC_PayloadFieldLabel>Голос</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue>
          <SC_PayloadScore>{{ payload.value }}/5</SC_PayloadScore>
          <span style='font-size: 12px; color: rgb(108, 117, 125);'>звёзд</span>
        </SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>Голосует</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.voter' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>За пост</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.postId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- C-SCORE -->
      <template v-else-if='payload.kind === "c-score"'>
        <SC_PayloadFieldLabel>Голос</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue>
          <component :is='payload.value >= 0 ? SC_PayloadScore : SC_PayloadScoreNeg'>
            {{ payload.value > 0 ? '+1' : payload.value }}
          </component>
        </SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>Голосует</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.voter' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>За коммент</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.commentId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- SUBSCRIBE / UNSUBSCRIBE -->
      <template v-else-if='payload.kind === "subscribe"'>
        <SC_PayloadFieldLabel>{{ payload.isUnsubscribe ? "Отписался" : "Подписался" }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.from' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ payload.isUnsubscribe ? "От кого" : "На кого" }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.to' /></SC_PayloadFieldValue>
      </template>

      <!-- BLOCK / UNBLOCK -->
      <template v-else-if='payload.kind === "block-user"'>
        <SC_PayloadFieldLabel>{{ payload.isUnblock ? "Разблокировал" : "Заблокировал" }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.actor' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>Кого</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.target' /></SC_PayloadFieldValue>
      </template>

      <!-- BOOST -->
      <template v-else-if='payload.kind === "boost"'>
        <SC_PayloadFieldLabel>Сумма</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue>
          <SC_PayloadScore>{{ formatExplorerPkoin(payload.amount) }} PKOIN</SC_PayloadScore>
        </SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>Бустит</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.booster' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>Пост</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.postId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- ACCOUNT (setting / set) -->
      <template v-else-if='payload.kind === "account"'>
        <SC_PayloadFieldLabel>Аккаунт</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.account' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>Тип</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue style='font-size: 12px; color: rgb(108, 117, 125);'>
          {{ payload.isSetting ? "Изменение настроек профиля" : "Создание/обновление аккаунта" }}
        </SC_PayloadFieldValue>
      </template>
    </SC_PayloadFields>

    <SC_PayloadActions v-if='actions.length > 0'>
      <RouterLink
        v-for='action in actions'
        :key='action.label'
        v-slot='{ navigate, href }'
        custom
        :to='action.to'
      >
        <SC_PayloadBtn :href='href' @click='navigate'>
          {{ action.label }} →
        </SC_PayloadBtn>
      </RouterLink>
    </SC_PayloadActions>
  </SC_PayloadCard>
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import HashLink from './hash-link.vue'
import AddressLink from './address-link.vue'
import { formatExplorerPkoin } from './format-explorer'
import type { PocketPayload } from './parse-pocketnet-payload'
import {
  SC_PayloadCard,
  SC_PayloadHeader,
  SC_PayloadIcon,
  SC_PayloadTitle,
  SC_PayloadFields,
  SC_PayloadFieldLabel,
  SC_PayloadFieldValue,
  SC_PayloadActions,
  SC_PayloadBtn,
  SC_PayloadScore,
  SC_PayloadScoreNeg,
} from './tx-payload-card.styled'

const p = defineProps<{
  payload: PocketPayload | null
}>()

interface PayloadAction {
  label: string
  to: RouteLocationRaw
}

const icon = computed(() => {
  const k = p.payload?.kind
  switch (k) {
    case 'post':         return '📝'
    case 'comment':      return '💬'
    case 'comment-edit': return '✏️'
    case 'upvote-share': return '⭐'
    case 'c-score':      return '👍'
    case 'subscribe':    return p.payload?.kind === 'subscribe' && p.payload.isUnsubscribe ? '➖' : '➕'
    case 'block-user':   return p.payload?.kind === 'block-user' && p.payload.isUnblock ? '🔓' : '🚫'
    case 'boost':        return '🚀'
    case 'account':      return '👤'
    default:             return '◆'
  }
})

const title = computed((): string => {
  const pl = p.payload
  if (!pl) return ''
  switch (pl.kind) {
    case 'post': {
      const labels: Record<number, string> = { 200: 'Пост', 201: 'Видео', 202: 'Статья', 203: 'Трансляция' }
      return labels[pl.type] ?? 'Контент'
    }
    case 'comment':      return 'Комментарий'
    case 'comment-edit': return 'Редактирование комментария'
    case 'upvote-share': return 'Оценка поста'
    case 'c-score':      return 'Оценка комментария'
    case 'subscribe':
      return pl.isUnsubscribe ? 'Отписка' : (pl.isPrivate ? 'Подписка (приватная)' : 'Подписка')
    case 'block-user':   return pl.isUnblock ? 'Разблокировка пользователя' : 'Блокировка пользователя'
    case 'boost':        return 'Буст поста'
    case 'account':      return pl.isSetting ? 'Изменение профиля' : 'Действие с аккаунтом'
    default:             return ''
  }
})

/**
 * Кнопки-deeplink-и в Bastyon-приложение. Для текущей версии nextgen у нас есть
 * только маршрут `/<address>` (профиль). Маршруты для отдельного поста/коммента
 * (`/post/:id`) ещё не реализованы — когда появятся, добавим сюда.
 */
const actions = computed<PayloadAction[]>(() => {
  const pl = p.payload
  if (!pl) return []
  const out: PayloadAction[] = []
  const profile = (addr: string, label: string): PayloadAction => ({
    label,
    to: { name: 'profile', params: { userName: addr } },
  })
  switch (pl.kind) {
    case 'post':
      out.push(profile(pl.author, 'Открыть профиль автора'))
      break
    case 'comment':
    case 'comment-edit':
      out.push(profile(pl.author, 'Открыть профиль автора'))
      break
    case 'upvote-share':
    case 'c-score':
      out.push(profile(pl.voter, 'Открыть профиль голосующего'))
      break
    case 'subscribe':
      out.push(profile(pl.to, pl.isUnsubscribe ? 'Открыть профиль' : 'Открыть профиль автора'))
      break
    case 'block-user':
      out.push(profile(pl.target, 'Открыть профиль'))
      break
    case 'boost':
      out.push(profile(pl.booster, 'Открыть профиль'))
      break
    case 'account':
      out.push(profile(pl.account, 'Открыть профиль'))
      break
  }
  return out
})
</script>
