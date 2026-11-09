<template>
  <SC_Tabs :aria-label="t('profile.tabsLabel')" data-testid="profile-tabs">
    <router-link
      v-for="item in TABS"
      :key="item"
      :to="{ query: item === 'posts' ? {} : { tab: item } }"
      :class="{ active: active === item }"
      :aria-current-value="active === item ? 'page' : 'false'"
      replace
    >
      {{ t(`profile.tabs.${item}`) }}
    </router-link>
  </SC_Tabs>
</template>

<script setup lang="ts">
// Вкладки профиля: публикации, видео, аудио, коллекции. Выбор — в `?tab=`.
// aria-current: router-link считает «текущими» все четыре (query он при
// сравнении не учитывает), поэтому у невыбранных значение — false.

import { useI18n } from 'vue-i18n'
import { SC_Tabs } from './profile-tabs.styled'

type ProfileTab = 'posts' | 'video' | 'audio' | 'collections'

const TABS: ProfileTab[] = ['posts', 'video', 'audio', 'collections']

defineProps<{ active: ProfileTab }>()
const { t } = useI18n()
</script>
