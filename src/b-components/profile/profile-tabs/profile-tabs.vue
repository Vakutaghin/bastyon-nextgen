<template>
  <SC_Tabs :aria-label="t('profile.tabsLabel')" data-testid="profile-tabs">
    <router-link
      v-for="item in TABS"
      :key="item"
      :to="{ query: item === 'posts' ? {} : { tab: item } }"
      :class="{ active: active === item }"
      replace
    >
      {{ t(`profile.tabs.${item}`) }}
    </router-link>
  </SC_Tabs>
</template>

<script setup lang="ts">
// Вкладки профиля: публикации, видео, аудио, коллекции. Выбор — в `?tab=`.

import { useI18n } from 'vue-i18n'
import { SC_Tabs } from './profile-tabs.styled'

type ProfileTab = 'posts' | 'video' | 'audio' | 'collections'

const TABS: ProfileTab[] = ['posts', 'video', 'audio', 'collections']

defineProps<{ active: ProfileTab }>()
const { t } = useI18n()
</script>
