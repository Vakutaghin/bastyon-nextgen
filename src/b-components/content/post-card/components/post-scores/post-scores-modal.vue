<template>
  <!-- Кто и как оценил пост: доли оценок от 5 до 1 и люди с их оценкой, как в
       прежнем Bastyon (services/post-scores). Строка ведёт в профиль. Слой —
       как у списка подписчиков: над постом, открытым поверх мессенджера. -->
  <Modal
    v-model:open="isOpen"
    :title="title"
    :width="460"
    :centered="true"
    :footer="null"
    :z-index="2700"
    @cancel="close"
  >
    <SC_State v-if="isLoading && rows.length === 0">{{ t('postScores.loading') }}</SC_State>
    <SC_State v-else-if="isError && rows.length === 0">
      <div>{{ t('postScores.error') }}</div>
      <SC_Retry type="button" @click="refetch()">{{ t('postCard.retry') }}</SC_Retry>
    </SC_State>
    <SC_State v-else-if="rows.length === 0">{{ t('postScores.empty') }}</SC_State>

    <template v-else>
      <SC_Shares :aria-label="t('postScores.sharesLabel')">
        <SC_ShareRow v-for="share in shares" :key="share.stars">
          <SC_ShareLabel>{{ share.stars }} <StarFilled /></SC_ShareLabel>
          <SC_ShareTrack><SC_ShareFill :percent="share.percent" /></SC_ShareTrack>
          <SC_ShareCount>{{ share.count }}</SC_ShareCount>
        </SC_ShareRow>
      </SC_Shares>

      <SC_List data-testid="post-scores-list">
        <SC_Row v-for="row in rows" :key="row.address">
          <SC_RowMain type="button" @click="goToProfile(row.address)">
            <UserMark :mark="userMarkOf(row.address)" :size="14">
              <SC_Avatar>
                <img v-if="row.avatar" :src="row.avatar" :alt="row.name" />
                <span v-else>{{ row.name.charAt(0).toUpperCase() }}</span>
              </SC_Avatar>
            </UserMark>
            <SC_RowInfo>
              <SC_RowName>{{ row.name }}</SC_RowName>
              <SC_RowMeta v-if="row.reputation !== null">
                {{ t('relations.reputation') }}: {{ formatTopReputation(row.reputation) }}
              </SC_RowMeta>
            </SC_RowInfo>
          </SC_RowMain>
          <SC_Score :aria-label="t('postScores.starsLabel', { n: row.value }, row.value)">
            {{ row.value }} <StarFilled />
          </SC_Score>
        </SC_Row>
      </SC_List>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Modal } from 'ant-design-vue'
import { useQuery } from '@tanstack/vue-query'
import { StarFilled } from '@/components/icons'
import UserMark from '@/components/user-mark'
import { userMarkOf } from '@/services/user-marks'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useUserRelationsStore } from '@/stores'
import { resolveAvatarUrl } from '@/helpers/common/avatar-resolver'
import { formatTopReputation } from '@/pages/top-accounts-page/top-format'
import {
  fetchPostScores,
  scoreDistribution,
  sortPostScores,
  withOwnScore,
} from '@/services/post-scores'
import {
  SC_Avatar,
  SC_List,
  SC_Row,
  SC_RowInfo,
  SC_RowMain,
  SC_RowMeta,
  SC_RowName,
  SC_State,
} from '@/b-components/profile/followers-list-modal/styled'
import {
  SC_Retry,
  SC_Score,
  SC_ShareCount,
  SC_ShareFill,
  SC_ShareLabel,
  SC_ShareRow,
  SC_Shares,
  SC_ShareTrack,
} from './styled'

const props = defineProps<{
  open: boolean
  txid: string
  /** Своя оценка этому посту — пока её нет у ноды, она ждёт блока. */
  userVote?: number
}>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const relations = useUserRelationsStore()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const { data, isLoading, isError, refetch } = useQuery({
  queryKey: computed(() => ['post-scores', props.txid]),
  queryFn: () => fetchPostScores(props.txid),
  enabled: computed(() => props.open && !!props.txid),
  staleTime: 60_000,
})

const rows = computed(() => {
  const address = authStore.getUserAddress || ''
  const profile = authStore.getUserProfile
  const own =
    address && props.userVote
      ? {
          address,
          name: profile?.name || address,
          avatar: resolveAvatarUrl(profile) ?? null,
          value: props.userVote,
        }
      : null
  return sortPostScores(withOwnScore(data.value ?? [], own), (a) => relations.isSubscribed(a))
})

const shares = computed(() => scoreDistribution(rows.value))

const title = computed(() =>
  rows.value.length ? t('postScores.titleCount', { n: rows.value.length }) : t('postScores.title')
)

function close(): void {
  emit('update:open', false)
}

function goToProfile(address: string): void {
  close()
  void router.push(`/${address}`)
}
</script>
