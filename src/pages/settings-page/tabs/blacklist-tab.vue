<template>
  <SC_Blacklist>
    <SC_BlacklistTitle>{{ t('settings.blacklist.title') }}</SC_BlacklistTitle>
    <SC_BlacklistLead>{{ t('settings.blacklist.lead') }}</SC_BlacklistLead>

    <SC_BlacklistState v-if="relations.isLoading && rows.length === 0">
      {{ t('settings.blacklist.loading') }}
    </SC_BlacklistState>

    <SC_BlacklistState v-else-if="rows.length === 0">
      {{ t('settings.blacklist.empty') }}
    </SC_BlacklistState>

    <SC_BlacklistList v-else>
      <SC_BlacklistRow v-for="row in rows" :key="row.address">
        <SC_BlacklistMain @click="goToProfile(row.address)">
          <SC_BlacklistAvatar>
            <img v-if="row.avatar" :src="row.avatar" :alt="row.name" />
            <span v-else>{{ row.name.charAt(0).toUpperCase() }}</span>
          </SC_BlacklistAvatar>
          <SC_BlacklistName>{{ row.name }}</SC_BlacklistName>
        </SC_BlacklistMain>

        <SC_UnblockBtn :disabled="relations.isPending(row.address)" @click="unblock(row.address)">
          {{ t('comments.unblock') }}
        </SC_UnblockBtn>
      </SC_BlacklistRow>
    </SC_BlacklistList>
  </SC_Blacklist>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUserRelationsStore } from '@/stores'
import { useUserProfiles } from '@/composables/use-user-profile'
import { appToast } from '@/b-components/app-toast'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import {
  SC_Blacklist,
  SC_BlacklistTitle,
  SC_BlacklistLead,
  SC_BlacklistList,
  SC_BlacklistRow,
  SC_BlacklistMain,
  SC_BlacklistAvatar,
  SC_BlacklistName,
  SC_UnblockBtn,
  SC_BlacklistState,
} from './blacklist-tab.styled'

const { t } = useI18n()
const router = useRouter()
const relations = useUserRelationsStore()

const blockedAddresses = computed<string[]>(() => Array.from(relations.blocked))

const { data: profiles } = useUserProfiles(blockedAddresses)

function avatarFromProfile(p: UserProfile | undefined): string | null {
  const withAcc = p as (UserProfile & { accSet?: { image?: string } }) | undefined
  return withAcc?.accSet?.image || withAcc?.i || null
}

const rows = computed(() => {
  const byAddr = new Map<string, UserProfile>()
  if (Array.isArray(profiles.value)) {
    for (const p of profiles.value) if (p?.address) byAddr.set(p.address, p)
  }
  return blockedAddresses.value.map((address) => {
    const p = byAddr.get(address)
    return { address, name: p?.name || address, avatar: avatarFromProfile(p) }
  })
})

onMounted(() => {
  void relations.init()
})

function goToProfile(address: string): void {
  router.push(`/${address}`)
}

async function unblock(address: string): Promise<void> {
  if (relations.isPending(address)) return
  try {
    await relations.unblock(address)
    appToast.success({ message: t('comments.unblocked') })
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('subscriptions.errFailed') })
  }
}
</script>
