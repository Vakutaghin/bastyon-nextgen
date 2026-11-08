<template>
  <Modal
    v-model:open="isOpen"
    :title="title"
    :width="460"
    :centered="true"
    :closable="true"
    :mask-closable="true"
    :footer="null"
    :z-index="2700"
    @cancel="close"
  >
    <!-- Поиск по нику и адресу и порядок: новые сверху или по репутации. -->
    <SC_Toolbar v-if="totalCount > 1 || searching">
      <Input
        v-model:value="query"
        allow-clear
        data-testid="relations-search"
        :placeholder="t('relations.search')"
        :aria-label="t('relations.search')"
      >
        <template #prefix><SearchOutlined /></template>
      </Input>
      <SC_SortRow role="radiogroup" :aria-label="t('relations.sortLabel')">
        <SC_SortButton
          v-for="s in RELATION_SORTS"
          :key="s"
          type="button"
          role="radio"
          :class="{ active: sortOrder === s }"
          :aria-checked="sortOrder === s"
          :data-testid="`relations-sort-${s}`"
          @click="sortOrder = s"
        >
          {{ t(`relations.sort_${s}`) }}
        </SC_SortButton>
        <HelpLink topic="subscriptions#lists" />
      </SC_SortRow>
      <SC_SearchHint v-if="searching" role="status" data-testid="relations-search-status">
        {{
          namesLoading
            ? t('relations.searchNamesLoading')
            : t('relations.searchFound', { n: matchCount }, matchCount)
        }}
      </SC_SearchHint>
    </SC_Toolbar>

    <SC_State v-if="isLoading && rows.length === 0">{{ t('relations.loading') }}</SC_State>
    <SC_State v-else-if="error">{{ t('relations.error') }}</SC_State>
    <SC_State v-else-if="rows.length === 0 && searching">
      {{ namesLoading ? t('relations.searchNamesLoading') : t('relations.searchEmpty') }}
    </SC_State>
    <SC_State v-else-if="rows.length === 0">{{ emptyText }}</SC_State>

    <template v-else>
      <SC_List>
        <SC_Row v-for="row in rows" :key="row.address" data-testid="relations-row">
          <SC_RowMain @click="goToProfile(row.address)">
            <UserMark :mark="userMarkOf(row.address)" :size="14">
              <SC_Avatar>
                <img v-if="row.avatar" :src="row.avatar" :alt="row.name" />
                <span v-else>{{ row.name.charAt(0).toUpperCase() }}</span>
              </SC_Avatar>
            </UserMark>
            <SC_RowInfo>
              <SC_RowName data-testid="relations-name">{{ row.name }}</SC_RowName>
              <SC_RowMeta
                >{{ t('relations.reputation') }}: {{ row.reputation.toFixed(1) }}</SC_RowMeta
              >
            </SC_RowInfo>
          </SC_RowMain>

          <SC_FollowBtn
            v-if="canFollow(row.address) && relations.isBlocked(row.address)"
            class="subscribed"
            :disabled="relations.isPending(row.address)"
            @click="confirmUnblock(row.address)"
          >
            <LoadingOutlined v-if="relations.isPending(row.address)" spin />
            {{ t('comments.unblock') }}
          </SC_FollowBtn>
          <SC_FollowBtn
            v-else-if="canFollow(row.address) && !relations.isSubscriptionKnown(row.address)"
            class="subscribed"
            disabled
          >
            <LoadingOutlined spin />
            {{ t('relations.loading') }}
          </SC_FollowBtn>
          <SC_FollowBtn
            v-else-if="canFollow(row.address)"
            :class="{ subscribed: relations.isSubscribed(row.address) }"
            :disabled="relations.isSubscribePending(row.address)"
            @click="toggleFollow(row.address)"
          >
            <LoadingOutlined v-if="relations.isSubscribePending(row.address)" spin />
            <CheckOutlined v-else-if="relations.isSubscribed(row.address)" />
            <PlusOutlined v-else />
            {{
              relations.isSubscribed(row.address)
                ? t('subscriptions.subscribed')
                : t('subscriptions.subscribe')
            }}
          </SC_FollowBtn>
        </SC_Row>
      </SC_List>

      <SC_LoadMore v-if="hasMore" @click="loadMore">{{ t('relations.loadMore') }}</SC_LoadMore>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CheckOutlined, PlusOutlined, LoadingOutlined, SearchOutlined } from '@/components/icons'
import { Input, Modal } from 'ant-design-vue'
import HelpLink from '@/b-components/help/help-link.vue'
import UserMark from '@/components/user-mark'
import { userMarkOf } from '@/services/user-marks'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useUserRelationsStore } from '@/stores'
import { useRelationActions } from '@/composables/use-relation-actions'
import {
  RELATION_SORTS,
  normalizeRelationQuery,
  relationSortOrder as sortOrder,
  useFollowersList,
  type RelationListType,
} from '@/composables/use-followers-list'
import {
  SC_List,
  SC_Row,
  SC_RowMain,
  SC_Avatar,
  SC_RowInfo,
  SC_RowName,
  SC_RowMeta,
  SC_FollowBtn,
  SC_State,
  SC_LoadMore,
  SC_SearchHint,
  SC_SortButton,
  SC_SortRow,
  SC_Toolbar,
} from './styled'

const props = defineProps<{
  open: boolean
  profileAddress: string
  type: RelationListType
  /** Кого не показывать: тех, кого владелец профиля заблокировал. */
  hiddenAddresses?: readonly string[]
}>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void; (e: 'close'): void }>()

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const relations = useUserRelationsStore()

const PAGE = 50
const visibleCount = ref(PAGE)

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const query = ref('')
const searching = computed(() => normalizeRelationQuery(query.value) !== '')

const { rows, totalCount, matchCount, hasMore, isLoading, namesLoading, error } = useFollowersList(
  () => props.profileAddress,
  () => props.type,
  visibleCount,
  () => props.open,
  () => props.hiddenAddresses ?? [],
  sortOrder,
  query
)

// Подписка и отписка — с вопросом перед отпиской, разблокировка — с вопросом.
const { toggleFollow, confirmUnblock } = useRelationActions()

const title = computed(() =>
  props.type === 'followers' ? t('relations.followersTitle') : t('relations.followingTitle')
)
const emptyText = computed(() =>
  props.type === 'followers' ? t('relations.followersEmpty') : t('relations.followingEmpty')
)

// Сбрасываем пагинацию при каждом открытии / смене списка, поиск — тоже.
watch(
  () => [props.open, props.profileAddress, props.type],
  () => {
    visibleCount.value = PAGE
    query.value = ''
  }
)
// Новый запрос или порядок — снова с начала списка.
watch([query, sortOrder], () => {
  visibleCount.value = PAGE
})

function canFollow(address: string): boolean {
  return authStore.isAuthenticated && authStore.getUserAddress !== address
}

function loadMore(): void {
  visibleCount.value += PAGE
}

function close(): void {
  emit('update:open', false)
  emit('close')
}

function goToProfile(address: string): void {
  close()
  router.push(`/${address}`)
}
</script>
