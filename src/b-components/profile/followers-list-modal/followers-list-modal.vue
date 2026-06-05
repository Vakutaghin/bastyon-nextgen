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
    <SC_State v-if="isLoading && rows.length === 0">{{ t('relations.loading') }}</SC_State>
    <SC_State v-else-if="error">{{ t('relations.error') }}</SC_State>
    <SC_State v-else-if="rows.length === 0">{{ emptyText }}</SC_State>

    <template v-else>
      <SC_List>
        <SC_Row v-for="row in rows" :key="row.address">
          <SC_RowMain @click="goToProfile(row.address)">
            <SC_Avatar>
              <img v-if="row.avatar" :src="row.avatar" :alt="row.name" />
              <span v-else>{{ row.name.charAt(0).toUpperCase() }}</span>
            </SC_Avatar>
            <SC_RowInfo>
              <SC_RowName>{{ row.name }}</SC_RowName>
              <SC_RowMeta
                >{{ t('relations.reputation') }}: {{ row.reputation.toFixed(1) }}</SC_RowMeta
              >
            </SC_RowInfo>
          </SC_RowMain>

          <SC_FollowBtn
            v-if="canFollow(row.address)"
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
import { CheckOutlined, PlusOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import { Modal } from 'ant-design-vue'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useUserRelationsStore } from '@/stores'
import { appToast } from '@/b-components/app-toast'
import { useFollowersList, type RelationListType } from '@/composables/use-followers-list'
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
} from './styled'

const props = defineProps<{
  open: boolean
  profileAddress: string
  type: RelationListType
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

const { rows, hasMore, isLoading, error } = useFollowersList(
  () => props.profileAddress,
  () => props.type,
  visibleCount,
  () => props.open
)

const title = computed(() =>
  props.type === 'followers' ? t('relations.followersTitle') : t('relations.followingTitle')
)
const emptyText = computed(() =>
  props.type === 'followers' ? t('relations.followersEmpty') : t('relations.followingEmpty')
)

// Сбрасываем пагинацию при каждом открытии / смене списка.
watch(
  () => [props.open, props.profileAddress, props.type],
  () => {
    visibleCount.value = PAGE
  }
)

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

async function toggleFollow(address: string): Promise<void> {
  if (relations.isSubscribePending(address)) return
  try {
    if (relations.isSubscribed(address)) {
      await relations.unsubscribe(address)
      appToast.success({ message: t('subscriptions.unsubscribedToast') })
    } else {
      await relations.subscribe(address)
      appToast.success({ message: t('subscriptions.subscribedToast') })
    }
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('subscriptions.errFailed') })
  }
}
</script>
