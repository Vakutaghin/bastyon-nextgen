<template>
  <SC_FavoritesSection v-if="items.length > 0" :class="{ collapsed }">
    <SC_FavoritesItem
      v-for="fav in items"
      :key="fav.id"
      :active="isActive(fav.id)"
      type="button"
      :title="fav.name"
      @click="open(fav.id)"
    >
      <SC_FavIconWrap>
        <SC_FavIcon
          v-if="!brokenIcons.has(fav.id)"
          :src="fav.icon"
          :alt="fav.name"
          @error="brokenIcons.add(fav.id)"
        />
        <SC_FavIconFallback v-else>
          {{ initials(fav.name) }}
        </SC_FavIconFallback>
      </SC_FavIconWrap>
      <SC_FavLabel v-if="!collapsed">{{ fav.name }}</SC_FavLabel>
    </SC_FavoritesItem>
  </SC_FavoritesSection>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFavoriteMiniAppsStore } from '@/mini-apps/store/favorites-store'
import { BUILT_IN_APPS, getBuiltInIconUrl } from '@/mini-apps/registry/built-in'
import {
  SC_FavoritesSection,
  SC_FavoritesItem,
  SC_FavIconWrap,
  SC_FavIcon,
  SC_FavIconFallback,
  SC_FavLabel,
} from './styled'

defineProps<{ collapsed?: boolean }>()

const router = useRouter()
const route = useRoute()
const favStore = useFavoriteMiniAppsStore()

/**
 * Barteron всегда закреплён первым — это built-in миниаппа с `cantdelete: true`,
 * исторически имела отдельный пин-таб в сайдбаре. Сейчас рендерится в общем
 * списке favorites для визуального единообразия. Если пользователь отметит
 * Barteron звёздочкой в каталоге (он попадёт в favStore), дубль фильтруется.
 */
const BARTERON_PINNED = (() => {
  const meta = BUILT_IN_APPS.find((a) => a.id === 'barteron.pocketnet.app')
  if (!meta) return null
  return {
    id: meta.id,
    name: meta.name,
    scope: meta.scope,
    icon: getBuiltInIconUrl(meta.scope),
  }
})()

const items = computed(() => {
  const userPins = favStore.items.filter((f) => f.id !== BARTERON_PINNED?.id)
  return BARTERON_PINNED ? [BARTERON_PINNED, ...userPins] : userPins
})

const brokenIcons = ref(new Set<string>())

onMounted(() => {
  void favStore.init()
})

const isActive = (id: string): boolean => {
  return route.path === `/app/${id}` || route.path.startsWith(`/app/${id}/`)
}

const open = (id: string) => {
  void router.push(`/app/${id}`)
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
</script>
