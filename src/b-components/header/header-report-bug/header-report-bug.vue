<template>
  <Tooltip v-if="isVisible" :title="t('header.reportBug')" placement="bottom">
    <SC_ReportBugWrapper @click="onClick">
      <BugOutlined :style="ICON_SIZE_XL" />
    </SC_ReportBugWrapper>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tooltip } from 'ant-design-vue'
import { BugOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/blockchain'
import { useMessengerStore } from '@/b-components/messenger/store'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import type { GetUserAddressResponse } from '@/types/rpc-responses/get-user-address'
import { SC_ReportBugWrapper } from './styled'
import { ICON_SIZE_XL } from '@/styles/icon-styles'

// Аккаунт поддержки в сети Bastyon, на который уходят баг-репорты. Храним имя,
// а не адрес: имя резолвится в адрес через getuseraddress (как на странице
// профиля) — никаких посредников, всё через ноду.
const BUG_REPORT_ACCOUNT_NAME = 'bastyon_nextgen_supp'

const { t } = useI18n()

const authStore = useAuthStore()
const messengerStore = useMessengerStore()

const isVisible = computed<boolean>(() => authStore.isUserAuthenticated)

// Кешируем ТОЛЬКО успешный резолв. Пустой ответ (имя свежего аккаунта ещё не
// распространилось по всем нодам) или ошибку не кешируем — иначе один промах
// убивал бы кнопку до перезагрузки страницы.
let cachedAddress: string | null = null
let pendingResolve: Promise<string | null> | null = null

function resolveBugReportAddress(): Promise<string | null> {
  if (cachedAddress) return Promise.resolve(cachedAddress)
  if (pendingResolve) return pendingResolve

  pendingResolve = getByPRC({
    method: rpcEndpoints.getUserAddress,
    parameters: [BUG_REPORT_ACCOUNT_NAME],
    options: { auth: false },
  })
    .then((response) => (response as GetUserAddressResponse)?.data?.[0]?.address ?? null)
    .catch((error) => {
      console.warn('[HeaderReportBug] не удалось разрешить адрес аккаунта поддержки:', error)
      return null
    })
    .then((address) => {
      if (address) cachedAddress = address
      pendingResolve = null
      return address
    })

  return pendingResolve
}

async function onClick(): Promise<void> {
  if (!authStore.isUserAuthenticated) return
  const address = await resolveBugReportAddress()
  if (!address) {
    console.warn(`[HeaderReportBug] аккаунт "${BUG_REPORT_ACCOUNT_NAME}" не найден в сети`)
    return
  }
  const roomId = await messengerStore.startChatWithAddress(address)
  if (roomId) {
    messengerStore.switchToChatAndLoad(roomId)
    messengerStore.isFullScreen = true
  }
}
</script>
