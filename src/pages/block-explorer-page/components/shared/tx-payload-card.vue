<template>
  <SC_PayloadCard v-if='payload'>
    <SC_PayloadHeader>
      <SC_PayloadIcon>{{ icon }}</SC_PayloadIcon>
      <SC_PayloadTitle>{{ title }}</SC_PayloadTitle>
    </SC_PayloadHeader>

    <SC_PayloadFields>
      <!-- POST / VIDEO / ARTICLE / STREAM -->
      <template v-if='payload.kind === "post"'>
        <SC_PayloadFieldLabel>{{ t('explorerShared.author') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.author' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.contentId') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.postId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- COMMENT -->
      <template v-else-if='payload.kind === "comment"'>
        <SC_PayloadFieldLabel>{{ t('explorerShared.author') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.author' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.commentId') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.commentId' :to='undefined' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.toPost') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.parentPostId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- COMMENT EDIT -->
      <template v-else-if='payload.kind === "comment-edit"'>
        <SC_PayloadFieldLabel>{{ t('explorerShared.author') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.author' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.edit') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.editTxId' :to='undefined' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.original') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.originalCommentId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- UPVOTE SHARE -->
      <template v-else-if='payload.kind === "upvote-share"'>
        <SC_PayloadFieldLabel>{{ t('explorerShared.vote') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue>
          <SC_PayloadScore>{{ payload.value }}/5</SC_PayloadScore>
          <span style='font-size: 12px; color: var(--color-text-secondary);'>{{ t('explorerShared.stars') }}</span>
        </SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.votes') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.voter' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.forPost') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.postId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- C-SCORE -->
      <template v-else-if='payload.kind === "c-score"'>
        <SC_PayloadFieldLabel>{{ t('explorerShared.vote') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue>
          <component :is='payload.value >= 0 ? SC_PayloadScore : SC_PayloadScoreNeg'>
            {{ payload.value > 0 ? '+1' : payload.value }}
          </component>
        </SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.votes') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.voter' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.forComment') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.commentId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- SUBSCRIBE / UNSUBSCRIBE -->
      <template v-else-if='payload.kind === "subscribe"'>
        <SC_PayloadFieldLabel>{{ payload.isUnsubscribe ? t('explorerShared.unsubscribed') : t('explorerShared.subscribed') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.from' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ payload.isUnsubscribe ? t('explorerShared.fromWhom') : t('explorerShared.toWhom') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.to' /></SC_PayloadFieldValue>
      </template>

      <!-- BLOCK / UNBLOCK -->
      <template v-else-if='payload.kind === "block-user"'>
        <SC_PayloadFieldLabel>{{ payload.isUnblock ? t('explorerShared.unblocked') : t('explorerShared.blocked') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.actor' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.whom') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.target' /></SC_PayloadFieldValue>
      </template>

      <!-- BOOST -->
      <template v-else-if='payload.kind === "boost"'>
        <SC_PayloadFieldLabel>{{ t('explorerShared.amount') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue>
          <SC_PayloadScore>{{ formatExplorerPkoin(payload.amount) }} PKOIN</SC_PayloadScore>
        </SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.boosts') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.booster' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.post') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><HashLink :hash='payload.postId' :to='undefined' /></SC_PayloadFieldValue>
      </template>

      <!-- ACCOUNT (setting / set) -->
      <template v-else-if='payload.kind === "account"'>
        <SC_PayloadFieldLabel>{{ t('explorerShared.account') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue><AddressLink :address='payload.account' /></SC_PayloadFieldValue>

        <SC_PayloadFieldLabel>{{ t('explorerShared.type') }}</SC_PayloadFieldLabel>
        <SC_PayloadFieldValue style='font-size: 12px; color: var(--color-text-secondary);'>
          {{ payload.isSetting ? t('explorerShared.profileSettingsChange') : t('explorerShared.accountCreateUpdate') }}
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
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()

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
      const labels: Record<number, string> = {
        200: t('explorerShared.titlePost'),
        201: t('explorerShared.titleVideo'),
        202: t('explorerShared.titleArticle'),
        203: t('explorerShared.titleStream'),
      }
      return labels[pl.type] ?? t('explorerShared.titleContent')
    }
    case 'comment':      return t('explorerShared.titleComment')
    case 'comment-edit': return t('explorerShared.titleCommentEdit')
    case 'upvote-share': return t('explorerShared.titlePostScore')
    case 'c-score':      return t('explorerShared.titleCommentScore')
    case 'subscribe':
      return pl.isUnsubscribe ? t('explorerShared.titleUnsubscribe') : (pl.isPrivate ? t('explorerShared.titleSubscribePrivate') : t('explorerShared.titleSubscribe'))
    case 'block-user':   return pl.isUnblock ? t('explorerShared.titleUnblockUser') : t('explorerShared.titleBlockUser')
    case 'boost':        return t('explorerShared.titleBoostPost')
    case 'account':      return pl.isSetting ? t('explorerShared.titleProfileChange') : t('explorerShared.titleAccountAction')
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
      out.push(profile(pl.author, t('explorerShared.openAuthorProfile')))
      break
    case 'comment':
    case 'comment-edit':
      out.push(profile(pl.author, t('explorerShared.openAuthorProfile')))
      break
    case 'upvote-share':
    case 'c-score':
      out.push(profile(pl.voter, t('explorerShared.openVoterProfile')))
      break
    case 'subscribe':
      out.push(profile(pl.to, pl.isUnsubscribe ? t('explorerShared.openProfile') : t('explorerShared.openAuthorProfile')))
      break
    case 'block-user':
      out.push(profile(pl.target, t('explorerShared.openProfile')))
      break
    case 'boost':
      out.push(profile(pl.booster, t('explorerShared.openProfile')))
      break
    case 'account':
      out.push(profile(pl.account, t('explorerShared.openProfile')))
      break
  }
  return out
})
</script>
