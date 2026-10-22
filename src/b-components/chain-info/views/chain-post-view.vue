<template>
  <ChainInfoSkeleton v-if="isLoading && !content" />
  <ExplorerError v-else-if="error || !content" :message="errorMessage" />
  <div v-else>
    <SC_ChainHead>
      <Avatar
        :src="userAvatar(content.address, content.userprofile?.i) ?? undefined"
        :alt="authorName"
        :fallback-text="authorName"
        :size="44"
      />
      <SC_ChainHeadText>
        <SC_ChainHeadName>
          <SC_ChainLinkBtn type="button" @click="openAccount(content.address)">
            {{ authorName }}
          </SC_ChainLinkBtn>
          <SC_ChainBadge>{{ typeLabel }}</SC_ChainBadge>
          <SC_ChainBadge v-if="isDeleted" class="warning">{{
            t('chainInfo.deleted')
          }}</SC_ChainBadge>
        </SC_ChainHeadName>
        <SC_ChainHeadSub>
          <HashLink
            :hash="content.address"
            :to="{ name: 'explorer-address', params: { address: content.address } }"
          />
        </SC_ChainHeadSub>
      </SC_ChainHeadText>
    </SC_ChainHead>

    <SC_TxMetaGrid>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.published') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <template v-if="publication">
            {{ formatDateTimeExact(publication.nTime) }}
            <SC_ChainMuted> · #{{ formatExplorerNumber(publication.height) }}</SC_ChainMuted>
          </template>
          <template v-else>{{ formatDateTimeExact(content.time) }}</template>
        </SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.publicationTx') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <HashLink :hash="content.txid" :to="txRoute(content.txid)" />
        </SC_TxMetaValue>
      </SC_TxMetaCell>

      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.edits') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <template v-if="editCount">
            {{ t('chainInfo.editsCount', { n: editCount }) }}
            <SC_ChainMuted v-if="lastEdit">
              · {{ formatDateTimeExact(lastEdit.nTime) }}
            </SC_ChainMuted>
          </template>
          <SC_ChainMuted v-else>{{ t('chainInfo.noEdits') }}</SC_ChainMuted>
        </SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.language') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>{{ content.l ? content.l.toUpperCase() : EM_DASH }}</SC_TxMetaValue>
      </SC_TxMetaCell>

      <SC_TxMetaCell v-if="content.c">
        <SC_TxMetaLabel>{{ t('chainInfo.caption') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>{{ content.c }}</SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.text') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <template v-if="textChars">{{ t('chainInfo.textChars', { n: textChars }) }}</template>
          <SC_ChainMuted v-else>{{ EM_DASH }}</SC_ChainMuted>
        </SC_TxMetaValue>
      </SC_TxMetaCell>

      <SC_TxMetaCell v-if="content.t?.length">
        <SC_TxMetaLabel>{{ t('chainInfo.tags') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <SC_ChainTags>
            <span v-for="tag in content.t" :key="tag">#{{ tag }}</span>
          </SC_ChainTags>
        </SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell v-if="content.i?.length || content.u">
        <SC_TxMetaLabel>{{ t('chainInfo.attachments') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <div v-if="content.i?.length">{{ t('chainInfo.images', { n: content.i.length }) }}</div>
          <div v-if="content.u">{{ content.u }}</div>
        </SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell v-if="content.r">
        <SC_TxMetaLabel>{{ t('chainInfo.repostOf') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <SC_ChainLinkBtn type="button" @click="openPost(content.r)">
            {{ shortenHash(content.r) }}
          </SC_ChainLinkBtn>
        </SC_TxMetaValue>
      </SC_TxMetaCell>

      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.ratings') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <template v-if="content.scoreCnt">
            ★ {{ averageScore(content) }}
            <SC_ChainMuted
              >· {{ t('chainInfo.ratingsCount', { n: content.scoreCnt }) }}</SC_ChainMuted
            >
          </template>
          <SC_ChainMuted v-else>{{ t('chainInfo.noRatings') }}</SC_ChainMuted>
        </SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.commentsReposts') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          {{ formatExplorerNumber(content.comments ?? 0) }} /
          {{ formatExplorerNumber(content.reposted ?? 0) }}
        </SC_TxMetaValue>
      </SC_TxMetaCell>
    </SC_TxMetaGrid>

    <SC_ChainSection v-if="editCount">
      <SC_ChainSectionTitle>{{ t('chainInfo.versions') }}</SC_ChainSectionTitle>
      <SC_ChainList>
        <SC_ChainRow v-for="v in versions" :key="v.txid" type="button" @click="openTx(v.txid)">
          <SC_ChainRowLabel>
            {{
              v.index === 0
                ? t('chainInfo.versionOriginal')
                : t('chainInfo.versionEdit', { n: v.index })
            }}
            <SC_ChainMuted v-if="v.current"> · {{ t('chainInfo.versionCurrent') }}</SC_ChainMuted>
          </SC_ChainRowLabel>
          <SC_ChainRowHash>{{ v.txid }}</SC_ChainRowHash>
          <SC_ChainRowMeta>
            <template v-if="heightOf(v)">#{{ formatExplorerNumber(heightOf(v)) }}</template>
          </SC_ChainRowMeta>
          <SC_ChainRowMeta>
            <template v-if="txById[v.txid]">{{
              formatDateTimeExact(txById[v.txid]!.nTime)
            }}</template>
          </SC_ChainRowMeta>
        </SC_ChainRow>
      </SC_ChainList>
    </SC_ChainSection>

    <SC_ChainSection v-if="actions?.scores.length">
      <SC_ChainSectionTitle>{{ t('chainInfo.ratedBy') }}</SC_ChainSectionTitle>
      <ChainPeople :people="actions.scores" />
    </SC_ChainSection>
    <SC_ChainSection v-if="actions?.boosters.length">
      <SC_ChainSectionTitle>{{ t('chainInfo.boostedBy') }}</SC_ChainSectionTitle>
      <ChainPeople :people="actions.boosters" />
    </SC_ChainSection>
    <SC_ChainSection v-if="actions?.donors.length">
      <SC_ChainSectionTitle>{{ t('chainInfo.donatedBy') }}</SC_ChainSectionTitle>
      <ChainPeople :people="actions.donors" />
    </SC_ChainSection>

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
  averageScore,
  contentVersions,
  fetchContent,
  fetchContentActions,
  fetchTransactions,
  storedContent,
  textLength,
  type ContentVersion,
} from '../chain-info-data'
import ChainInfoSkeleton from './chain-info-skeleton.vue'
import ChainPeople from './chain-people.vue'
import {
  SC_ChainHead,
  SC_ChainHeadText,
  SC_ChainHeadName,
  SC_ChainHeadSub,
  SC_ChainBadge,
  SC_ChainLinkBtn,
  SC_ChainMuted,
  SC_ChainSection,
  SC_ChainSectionTitle,
  SC_ChainList,
  SC_ChainRow,
  SC_ChainRowLabel,
  SC_ChainRowHash,
  SC_ChainRowMeta,
  SC_ChainTags,
} from '../chain-info.styled'

defineOptions({ name: 'ChainPostView' })

const p = defineProps<{ txid: string }>()

const { t } = useI18n()
const openInChainModal = inject(CHAIN_LINK_KEY, null)

// Технический placeholder (em-dash) — не локализуется.
const EM_DASH = '—'

const TYPE_TITLE_KEYS: Record<string, string> = {
  share: 'explorerShared.titlePost',
  video: 'explorerShared.titleVideo',
  article: 'explorerShared.titleArticle',
  stream: 'explorerShared.titleStream',
  audio: 'explorerShared.titleAudio',
}

// Ключи — под ['explorer']: «Повторить» в ExplorerError перезапрашивает их тоже.
const {
  data: contentData,
  isLoading,
  error,
} = useQuery({
  queryKey: ['explorer', 'chain-info', 'content', computed(() => p.txid)] as const,
  queryFn: () => fetchContent(p.txid),
  staleTime: 30_000,
  refetchOnWindowFocus: false,
})
const content = computed(() => contentData.value ?? null)

const { data: actions } = useQuery({
  queryKey: ['explorer', 'chain-info', 'actions', computed(() => p.txid)] as const,
  queryFn: () => fetchContentActions(p.txid),
  staleTime: 30_000,
  refetchOnWindowFocus: false,
})

const versions = computed<ContentVersion[]>(() =>
  content.value ? contentVersions(content.value) : []
)
const editCount = computed(() => Math.max(0, versions.value.length - 1))
const versionIds = computed(() => versions.value.map((v) => v.txid))

const { data: versionTxs } = useQuery({
  queryKey: ['explorer', 'chain-info', 'txs', versionIds] as const,
  queryFn: () => fetchTransactions(versionIds.value),
  enabled: computed(() => versionIds.value.length > 0),
  staleTime: 30_000,
  refetchOnWindowFocus: false,
})
const txById = computed(() =>
  Object.fromEntries((versionTxs.value ?? []).map((tx) => [tx.txid, tx]))
)

const publication = computed(() => (content.value ? txById.value[content.value.txid] : undefined))
const lastEdit = computed(() => {
  const last = versions.value[versions.value.length - 1]
  return editCount.value && last ? txById.value[last.txid] : undefined
})

function heightOf(v: ContentVersion): number {
  return v.height ?? txById.value[v.txid]?.height ?? 0
}

const authorName = computed(() =>
  content.value ? userName(content.value.address, content.value.userprofile?.name) : ''
)
const typeLabel = computed(() =>
  t(TYPE_TITLE_KEYS[content.value?.type ?? ''] ?? 'explorerShared.titleContent')
)
const isDeleted = computed(() => {
  const d = content.value?.deleted
  return d === true || d === 'true' || content.value?.type === 'delete'
})
const textChars = computed(() => textLength(content.value?.m))

const errorMessage = computed(() =>
  error.value
    ? t('chainInfo.loadFailed', { msg: extractErrorMessage(error.value) })
    : t('chainInfo.notFound')
)

const showRaw = ref(false)
const rawJson = computed(() =>
  content.value ? JSON.stringify(storedContent(content.value), null, 2) : ''
)

function txRoute(txid: string): RouteLocationRaw {
  return { name: 'explorer-tx', params: { txid } }
}

function openTx(txid: string): void {
  openInChainModal?.({ kind: 'tx', txid })
}

function openPost(txid: string): void {
  openInChainModal?.({ kind: 'post', txid })
}

function openAccount(address: string): void {
  openInChainModal?.({ kind: 'account', address })
}
</script>
