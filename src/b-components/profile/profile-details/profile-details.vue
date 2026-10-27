<template>
  <!-- Адрес, сайт и дата регистрации есть у каждого профиля: раньше весь
       блок прятался вместе с пустым «О себе». -->
  <SC_UserAbout data-testid="profile-details">
    <template v-if="formattedUserAbout">
      <h3>{{ t('profile.info') }}</h3>

      <p v-html="formattedUserAbout" />
      <hr />
    </template>

    <SC_UserAddress v-if="userAddress" :title="t('profile.copyAddress')" @click="copyAddress">
      {{ userAddress }}
    </SC_UserAddress>

    <SC_ExplorerLinkRow v-if="userAddress">
      <RouterLink
        v-slot="{ navigate, href }"
        custom
        :to="{ name: 'explorer-address', params: { address: userAddress } }"
      >
        <SC_ExplorerLink :href="href" @click="openChainInfo($event, navigate)">
          <BlockOutlined :style="ICON_SIZE_11" />
          {{ t('chainInfo.action') }}
        </SC_ExplorerLink>
      </RouterLink>
    </SC_ExplorerLinkRow>

    <SC_UserSite v-if="userSite" :href="userSite" target="_blank">
      {{ userSite }}
    </SC_UserSite>

    <div>
      <span>{{ t('profile.publications') }} </span>
      <strong>{{ publicationsCount }}</strong>
    </div>

    <div v-if="profile.regdate">
      <span
        >{{ t('profile.registered') }} <strong>{{ formattedDate }}</strong></span
      >
    </div>
  </SC_UserAbout>
</template>

<script setup lang="ts">
// «Информация» профиля: «О себе», адрес, «В блокчейне», сайт, публикации и
// дата регистрации. В боковой колонке на компьютере и в «Подробнее» на телефоне.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { BlockOutlined } from '@/components/icons'
import { formatLongDate } from '@/helpers/common/date-formatter'
import { copyText } from '@/helpers/common/clipboard'
import { appToast } from '@/b-components/app-toast'
import { useChainInfoStore } from '@/stores/chain-info-store'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { ICON_SIZE_11 } from '@/styles/icon-styles'
import { formatAbout } from '../profile-sidebar/format-about'
import { publicationsCount as countPublications } from '../profile-sidebar/publications-count'
import {
  SC_UserAbout,
  SC_UserAddress,
  SC_UserSite,
  SC_ExplorerLinkRow,
  SC_ExplorerLink,
} from './styled'

const props = defineProps<{ profile: UserProfile }>()
const { t } = useI18n()

const userAddress = computed<string>(() => props.profile.address || '')

const formattedDate = computed<string>(() => {
  if (!props.profile.regdate) return ''
  return formatLongDate(props.profile.regdate * 1000)
})

const userSite = computed<string | null>(() => {
  // Поле `s` — каноничный источник; `b` (JSON) — legacy-fallback.
  let url: string | null = props.profile.s || null

  if (!url && props.profile.b) {
    try {
      const json = JSON.parse(props.profile.b)
      url = json.site || json.url || null
    } catch {
      // ignore
    }
  }

  if (url && !url.match(/^https?:\/\//)) {
    url = 'https://' + url
  }
  return url
})

// «О себе» — только поле `a`. `r` — это адрес реферера, и он показывался в
// описании профиля, а при редактировании ещё и уходил обратно в цепочку (S54).
const formattedUserAbout = computed<string>(() => formatAbout(props.profile.a || ''))

// Число публикаций — как в ленте профиля: сумма `content` по типам, а не
// `postcnt`, который у ноды расходится с лентой (publications-count.ts).
const publicationsCount = computed<number>(() => countPublications(props.profile))

/**
 * «В блокчейне» — модалка поверх профиля; переход в эксплорер — в ней. С
 * модификатором (открыть отдельно) — сразу эксплорер.
 */
function openChainInfo(e: MouseEvent, navigate: (e?: MouseEvent) => unknown): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    void navigate(e)
    return
  }
  e.preventDefault()
  useChainInfoStore().open({ kind: 'account', address: userAddress.value })
}

async function copyAddress(): Promise<void> {
  if (!userAddress.value) return
  if (await copyText(userAddress.value)) appToast.success({ message: t('profile.addressCopied') })
}
</script>
