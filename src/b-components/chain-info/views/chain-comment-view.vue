<template>
  <ChainInfoSkeleton v-if="isLoading && !comment" />
  <ExplorerError v-else-if="error || !comment" :message="errorMessage" />
  <div v-else>
    <SC_ChainHead>
      <Avatar
        :src="userAvatar(comment.address, comment.userprofile?.i) ?? undefined"
        :alt="authorName"
        :fallback-text="authorName"
        :size="44"
      />
      <SC_ChainHeadText>
        <SC_ChainHeadName>
          <SC_ChainLinkBtn type="button" @click="openAccount(comment.address)">
            {{ authorName }}
          </SC_ChainLinkBtn>
          <SC_ChainBadge>{{ t('explorerShared.titleComment') }}</SC_ChainBadge>
          <SC_ChainBadge v-if="comment.deleted" class="warning">
            {{ t('chainInfo.deleted') }}
          </SC_ChainBadge>
        </SC_ChainHeadName>
        <SC_ChainHeadSub>
          <HashLink
            :hash="comment.address"
            :to="{ name: 'explorer-address', params: { address: comment.address } }"
          />
        </SC_ChainHeadSub>
      </SC_ChainHeadText>
    </SC_ChainHead>

    <SC_ChainQuote v-if="text.message">{{ text.message }}</SC_ChainQuote>

    <SC_TxMetaGrid>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.written') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          {{ formatDateTimeExact(comment.time) }}
          <SC_ChainMuted v-if="comment.block">
            · #{{ formatExplorerNumber(comment.block) }}
          </SC_ChainMuted>
        </SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.publicationTx') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <HashLink :hash="comment.id" :to="txRoute(comment.id)" />
        </SC_TxMetaValue>
      </SC_TxMetaCell>

      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.edits') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <template v-if="comment.edit && comment.timeUpd">
            {{ t('chainInfo.editedAt', { date: formatDateTimeExact(comment.timeUpd) }) }}
          </template>
          <SC_ChainMuted v-else>{{ t('chainInfo.noEdits') }}</SC_ChainMuted>
        </SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.toPost') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <SC_ChainLinkBtn type="button" @click="openPost(comment.postid)">
            {{ shortenHash(comment.postid) }}
          </SC_ChainLinkBtn>
        </SC_TxMetaValue>
      </SC_TxMetaCell>

      <SC_TxMetaCell v-if="replyTo">
        <SC_TxMetaLabel>{{ t('chainInfo.replyTo') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <SC_ChainLinkBtn type="button" @click="openComment(replyTo)">
            {{ shortenHash(replyTo) }}
          </SC_ChainLinkBtn>
        </SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.coins') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <template v-if="coins > 0">{{ formatExplorerPkoin(coins) }} PKOIN</template>
          <SC_ChainMuted v-else-if="tx">{{ t('chainInfo.noCoins') }}</SC_ChainMuted>
          <SC_ChainMuted v-else>{{ EM_DASH }}</SC_ChainMuted>
        </SC_TxMetaValue>
      </SC_TxMetaCell>

      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.commentVotes') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>+{{ comment.scoreUp ?? 0 }} / −{{ comment.scoreDown ?? 0 }}</SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.replies') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>{{ formatExplorerNumber(comment.children ?? 0) }}</SC_TxMetaValue>
      </SC_TxMetaCell>

      <SC_TxMetaCell v-if="text.images.length || text.url">
        <SC_TxMetaLabel>{{ t('chainInfo.attachments') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <div v-if="text.images.length">
            {{ t('chainInfo.images', { n: text.images.length }) }}
          </div>
          <div v-if="text.url">{{ text.url }}</div>
        </SC_TxMetaValue>
      </SC_TxMetaCell>
    </SC_TxMetaGrid>

    <SC_TxRawToggle type="button" @click="showRaw = !showRaw">
      {{ showRaw ? t('explorerPage.rawJsonHide') : t('explorerPage.rawJsonShow') }}
    </SC_TxRawToggle>
    <SC_TxRawPre v-if="showRaw">{{ rawJson }}</SC_TxRawPre>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import type { RouteLocationRaw } from 'vue-router'
import { Avatar } from '@/components'
import HashLink from '@/pages/block-explorer-page/components/shared/hash-link.vue'
import ExplorerError from '@/pages/block-explorer-page/components/shared/explorer-error.vue'
import {
  formatExplorerNumber,
  formatExplorerPkoin,
  shortenHash,
} from '@/pages/block-explorer-page/components/shared/format-explorer'
import {
  SC_TxMetaGrid,
  SC_TxMetaCell,
  SC_TxMetaLabel,
  SC_TxMetaValue,
  SC_TxRawToggle,
  SC_TxRawPre,
} from '@/pages/block-explorer-page/tx-page/tx-page.styled'
import { formatDateTimeExact } from '@/helpers/common/date-formatter'
import { extractErrorMessage } from '@/helpers/common/extract-error-message'
import { userAvatar, userName } from '@/services/user-names'
import { CHAIN_LINK_KEY } from '../chain-link'
import {
  commentCoins,
  fetchComment,
  fetchTransactions,
  parseCommentMessage,
} from '../chain-info-data'
import ChainInfoSkeleton from './chain-info-skeleton.vue'
import {
  SC_ChainHead,
  SC_ChainHeadText,
  SC_ChainHeadName,
  SC_ChainHeadSub,
  SC_ChainBadge,
  SC_ChainLinkBtn,
  SC_ChainMuted,
  SC_ChainQuote,
} from '../chain-info.styled'

defineOptions({ name: 'ChainCommentView' })

const p = defineProps<{ id: string; postId: string }>()

const { t } = useI18n()
const openInChainModal = inject(CHAIN_LINK_KEY, null)

// Технический placeholder (em-dash) — не локализуется.
const EM_DASH = '—'

const {
  data: commentData,
  isLoading,
  error,
} = useQuery({
  queryKey: ['explorer', 'chain-info', 'comment', computed(() => `${p.postId}:${p.id}`)] as const,
  queryFn: () => fetchComment(p.postId, p.id),
  staleTime: 30_000,
  refetchOnWindowFocus: false,
})
const comment = computed(() => commentData.value ?? null)

// Транзакция первой версии: в ней монеты, приложенные к комментарию.
const { data: txs } = useQuery({
  queryKey: ['explorer', 'chain-info', 'txs', computed(() => [p.id])] as const,
  queryFn: () => fetchTransactions([p.id]),
  staleTime: 30_000,
  refetchOnWindowFocus: false,
})
const tx = computed(() => txs.value?.find((x) => x.txid === p.id))
const coins = computed(() => (comment.value ? commentCoins(tx.value, comment.value.address) : 0))

const authorName = computed(() =>
  comment.value ? userName(comment.value.address, comment.value.userprofile?.name) : ''
)
const text = computed(() => parseCommentMessage(comment.value?.msg))
/** Ответ на ответ — answerid, ответ на комментарий верхнего уровня — parentid. */
const replyTo = computed(() => comment.value?.answerid || comment.value?.parentid || '')

const errorMessage = computed(() =>
  error.value
    ? t('chainInfo.loadFailed', { msg: extractErrorMessage(error.value) })
    : t('chainInfo.notFound')
)

const showRaw = ref(false)
const rawJson = computed(() => {
  if (!comment.value) return ''
  const rest: Record<string, unknown> = { ...comment.value }
  delete rest.userprofile
  return JSON.stringify(rest, null, 2)
})

function txRoute(txid: string): RouteLocationRaw {
  return { name: 'explorer-tx', params: { txid } }
}

function openPost(txid: string): void {
  openInChainModal?.({ kind: 'post', txid })
}

function openComment(id: string): void {
  if (comment.value) openInChainModal?.({ kind: 'comment', id, postId: comment.value.postid })
}

function openAccount(address: string): void {
  openInChainModal?.({ kind: 'account', address })
}
</script>
