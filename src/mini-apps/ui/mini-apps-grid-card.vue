<template>
  <SC_Card type="button" @click="emit('open', id)">
    <!-- Звёздочка-фавоит. Click-stopPropagation чтобы не сработал open карточки. -->
    <SC_FavoriteBtn
      type="button"
      :class="{ active: isFav }"
      :title="isFav ? t('miniapps.removeFromFavorites') : t('miniapps.addToFavorites')"
      @click.stop="emit('toggleFavorite')"
    >
      <StarFilled v-if="isFav" />
      <StarOutlined v-else />
    </SC_FavoriteBtn>

    <SC_IconWrap>
      <SC_Icon v-if="!broken && icon" :src="icon" :alt="name" @error="broken = true" />
      <SC_IconFallback v-else>
        {{ initials }}
      </SC_IconFallback>
    </SC_IconWrap>
    <SC_Name>{{ name }}</SC_Name>
  </SC_Card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { StarOutlined, StarFilled } from '@ant-design/icons-vue'
import {
  SC_Card,
  SC_IconWrap,
  SC_Icon,
  SC_IconFallback,
  SC_Name,
  SC_FavoriteBtn,
} from './mini-apps-grid.styled'

const props = defineProps<{
  id: string
  name: string
  icon: string
  isFav?: boolean
}>()

const emit = defineEmits<{
  open: [id: string]
  toggleFavorite: []
}>()

const { t } = useI18n()
const broken = ref(false)

watch(
  () => props.icon,
  () => {
    broken.value = false
  }
)

const initials = computed(() =>
  props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
)
</script>
