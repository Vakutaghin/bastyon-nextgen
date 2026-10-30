<template>
  <!-- Лупа в шапке мессенджера: раскрывает и прячет поле поиска над списком чатов. -->
  <SC_SearchToggle
    type="button"
    data-testid="chat-search-open"
    :class="{ active: chatSearchOpen }"
    :aria-expanded="chatSearchOpen"
    :aria-label="t('messenger.listSearch.open')"
    :title="t('messenger.listSearch.open')"
    @click="chatSearchOpen = !chatSearchOpen"
  >
    <SearchOutlined />
  </SC_SearchToggle>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SearchOutlined } from '@/components/icons'
import { chatSearchOpen } from './chat-search-state'
import { SC_SearchToggle } from './styled'

const { t } = useI18n()
</script>
