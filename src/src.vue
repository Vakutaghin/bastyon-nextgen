<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ConfigProvider, theme } from 'ant-design-vue'
import type { ThemeConfig } from 'ant-design-vue/es/config-provider'
import AppLayout from '@/b-components/app-layout/app-layout.vue'
import VideoUploader from '@/b-components/video-uploader/video-uploader.vue'
import MiniAppPaymentModal from '@/mini-apps/ui/mini-app-payment-modal.vue'
import DonateModal from '@/b-components/donate/donate-modal.vue'
import { useGlobalKeyboard } from '@/composables/use-global-keyboard'

// Embed-роуты (`/embed/...`, meta.embed) рендерятся БЕЗ chrome (хедер/футер/
// сайдбар/глобальные модалки) — это самостоятельная вьюха для встраивания в iframe.
const route = useRoute()
const isEmbed = computed<boolean>(() => route.meta?.embed === true)

// ContentFeed сам делает запрос через useInfiniteFeed, поэтому здесь не нужно делать запрос

// Инициализируем глобальную обработку клавиатуры для управления видеоплеером
useGlobalKeyboard()

// Явная конфигурация темы для устранения предупреждения о injection
// Используем computed для реактивности и обеспечения правильной инициализации
// Иконки и компоненты ant-design-vue требуют явной темы через ConfigProvider
const themeConfig = computed<ThemeConfig>(() => ({
  algorithm: theme.defaultAlgorithm,
  token: {
    // Используем дефолтные значения
    colorPrimary: '#1890ff',
    fontSize: 16,
  },
  // Добавляем конфигурацию для Card компонента, чтобы избежать проблем с injection
  components: {
    Card: {
      // Дефолтные значения для Card
    },
  },
}))
</script>

<template>
  <ConfigProvider prefixCls="ant" :theme="themeConfig">
    <!-- Embed: только маршрут, без chrome и глобальных синглтонов. -->
    <router-view v-if="isEmbed" />
    <template v-else>
      <AppLayout />
      <!-- Video Uploader - fixed кнопка и модалка (на верхнем уровне) -->
      <VideoUploader />
      <!-- Mini-apps payment modal — singleton, управляется через payment-modal-controller -->
      <MiniAppPaymentModal />
      <!-- Донат автору — singleton, открывается через useDonateStore -->
      <DonateModal />
    </template>
  </ConfigProvider>
</template>
