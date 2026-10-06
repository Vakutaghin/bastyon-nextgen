<template>
  <SC_ServicesButton
    type="button"
    :class="{ active }"
    :title="t('miniapps.headerButtonHint')"
    @click="open"
  >
    <AppstoreOutlined />
    <SC_ServicesLabel>{{ t('miniapps.pageTitle') }}</SC_ServicesLabel>
  </SC_ServicesButton>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AppstoreOutlined } from '@/components/icons'
import { SC_ServicesButton, SC_ServicesLabel } from './styled'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const active = computed(() => route.path === '/miniapps' || route.path.startsWith('/app/'))

function open(): void {
  if (route.path !== '/miniapps') void router.push('/miniapps')
}
</script>
