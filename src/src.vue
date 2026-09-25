<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ConfigProvider } from 'ant-design-vue'
import AppLayout from '@/b-components/app-layout/app-layout.vue'
import MiniAppPaymentModal from '@/mini-apps/ui/mini-app-payment-modal.vue'
import DonateModal from '@/b-components/donate/donate-modal.vue'
import ReportModal from '@/b-components/report/report-modal.vue'
import VaultUnlockModal from '@/components/vault/vault-unlock-modal.vue'
import IpfsInstallModal from '@/components/ipfs/ipfs-install-modal.vue'
import { useGlobalKeyboard } from '@/composables/use-global-keyboard'
import { useIpfsLinks } from '@/composables/use-ipfs-links'
import { useBackupNudge } from '@/composables/use-backup-nudge'
import { useTrayLabels } from '@/composables/use-tray-labels'
import { publicShareOrigin } from '@/helpers/common/share-origin'
import { useTheme } from '@/composables/use-theme'
import { buildAntdTheme, setStaticApiTheme } from '@/styles/antd-theme'
import { SC_FramedNotice, SC_FramedLink } from './src.styled'

const isTauriBuild = import.meta.env.VITE_TAURI === 'true'
const VideoUploader = defineAsyncComponent(
  () => import('@/b-components/video-uploader/video-uploader.vue')
)

// Embed-роуты (`/embed/...`, meta.embed) рендерятся БЕЗ chrome (хедер/футер/
// сайдбар/глобальные модалки) — это самостоятельная вьюха для встраивания в iframe.
const { t } = useI18n()
const route = useRoute()
const isEmbed = computed<boolean>(() => route.meta?.embed === true)

/**
 * Приложение во фрейме чужого сайта (S67).
 *
 * `frame-ancestors` браузер читает только из HTTP-заголовка (в meta директива
 * игнорируется), поэтому окончательный запрет framing'а — на деплое. Здесь
 * страховка на клиенте: всё, кроме `/embed/*`, во фрейме не рендерим — иначе
 * чужая страница может показать залогиненный кошелёк и ловить клики поверх.
 */
const isFramed = (() => {
  try {
    return window.top !== window.self
  } catch {
    // Кросс-доменный доступ к window.top бросает — значит мы точно во фрейме.
    return true
  }
})()
const isFramedApp = computed<boolean>(() => isFramed && !isEmbed.value)

const publicAppUrl =
  publicShareOrigin() + (typeof window !== 'undefined' ? window.location.pathname : '')

// ContentFeed сам делает запрос через useInfiniteFeed, поэтому здесь не нужно делать запрос

// Инициализируем глобальную обработку клавиатуры для управления видеоплеером
useGlobalKeyboard()

// Перехват кликов по IPFS-ссылкам → открытие в отдельном окне (только в Tauri).
// На embed-роутах выключаем: там нет singleton-модалки IPFS.
useIpfsLinks(() => !isEmbed.value)

// Напоминание о резервной копии 12 слов (раз в 7 дней, пока не проверена).
useBackupNudge(() => !isEmbed.value)

// Меню значка в трее — на языке приложения (только десктоп).
if (isTauriBuild) useTrayLabels()

// Тема antd — палитра Nuxt UI из styles/antd-theme.ts, своя для светлой и
// тёмной темы. Раньше antd всегда был светлым, а тёмным его делали
// !important-правила в style.css.
const { isDark } = useTheme()
const themeConfig = computed(() => buildAntdTheme(isDark.value))

// Modal.confirm, notification и message рендерятся вне дерева приложения и
// берут тему из глобального конфига, а не из <ConfigProvider>.
watch(themeConfig, setStaticApiTheme, { immediate: true })
</script>

<template>
  <ConfigProvider prefixCls="ant" :theme="themeConfig">
    <!-- Приложение во фрейме чужого сайта не показываем (S67). -->
    <SC_FramedNotice v-if="isFramedApp">
      <p>{{ t('appMsg.framedNotice') }}</p>
      <SC_FramedLink :href="publicAppUrl" target="_top" rel="noopener">
        {{ t('appMsg.framedOpen') }}
      </SC_FramedLink>
    </SC_FramedNotice>

    <!-- Embed: только маршрут, без chrome и глобальных синглтонов. -->
    <router-view v-else-if="isEmbed" />
    <template v-else>
      <AppLayout />
      <!-- Перекодирование видео — только в десктопе (нативный ffmpeg): в вебе
           кнопки нет, и модуль там даже не загружается (N17). -->
      <VideoUploader v-if="isTauriBuild" />
      <!-- Mini-apps payment modal — singleton, управляется через payment-modal-controller -->
      <MiniAppPaymentModal />
      <!-- Донат автору — singleton, открывается через useDonateStore -->
      <DonateModal />
      <!-- Жалоба на контент — singleton, открывается через useReportStore -->
      <ReportModal />
      <!-- P0-1: разблокировка сейфа (passphrase-режим) — singleton, открывается мостом vault-unlock -->
      <VaultUnlockModal />
      <!-- IPFS-модуль: consent/прогресс/desktop-only — singleton, открывается ipfs-store -->
      <IpfsInstallModal />
    </template>
  </ConfigProvider>
</template>
