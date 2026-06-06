<template>
  <SC_RecRoot v-if="isLoading || users.length > 0">
    <SC_RecCaption>{{ t('sidebar.recommendedUsers') }}</SC_RecCaption>

    <SC_RecState v-if="isLoading && users.length === 0">{{ t('sidebar.loading') }}</SC_RecState>

    <SC_RecList v-else>
      <SC_RecRow v-for="user in users" :key="user.address">
        <SC_RecMain @click="goToProfile(user.address)">
          <SC_RecAvatar>
            <img v-if="user.avatar" :src="user.avatar" :alt="user.name" loading="lazy" />
            <span v-else>{{ user.name.charAt(0).toUpperCase() }}</span>
          </SC_RecAvatar>
          <SC_RecInfo>
            <SC_RecName>{{ user.name }}</SC_RecName>
            <SC_RecMeta>{{
              t('sidebar.subscribersShort', { n: user.subscribersCount })
            }}</SC_RecMeta>
          </SC_RecInfo>
        </SC_RecMain>

        <SC_RecFollow
          :disabled="relations.isSubscribePending(user.address)"
          @click="follow(user.address)"
        >
          <LoadingOutlined v-if="relations.isSubscribePending(user.address)" spin />
          <PlusOutlined v-else />
          {{ t('subscriptions.subscribe') }}
        </SC_RecFollow>
      </SC_RecRow>
    </SC_RecList>
  </SC_RecRoot>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import { useUserRelationsStore } from '@/stores'
import { appToast } from '@/b-components/app-toast'
import { useRecommendedUsers } from '@/composables/use-recommended-users'
import {
  SC_RecRoot,
  SC_RecCaption,
  SC_RecList,
  SC_RecRow,
  SC_RecMain,
  SC_RecAvatar,
  SC_RecInfo,
  SC_RecName,
  SC_RecMeta,
  SC_RecFollow,
  SC_RecState,
} from './styled'

const { t } = useI18n()
const router = useRouter()
const relations = useUserRelationsStore()
const { users, isLoading } = useRecommendedUsers(8)

function goToProfile(address: string): void {
  router.push(`/${address}`)
}

async function follow(address: string): Promise<void> {
  if (relations.isSubscribePending(address)) return
  try {
    await relations.subscribe(address)
    appToast.success({ message: t('subscriptions.subscribedToast') })
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('subscriptions.errFailed') })
  }
}
</script>
