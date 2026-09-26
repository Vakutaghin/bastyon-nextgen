<template>
  <SC_ItemButton v-if="canAddCurrent" type="button" @click="help.toggleFavorite(current as string)">
    <StarOutlined />
    <span>{{ t('help.favorites.addCurrent') }}</span>
  </SC_ItemButton>
  <SC_List v-if="items.length">
    <li v-for="id in items" :key="id">
      <SC_FavoriteRow>
        <SC_Result :href="topicPath(id)" @click="open($event, id)">
          <SC_ResultTitle>{{ titleOf(id) }}</SC_ResultTitle>
          <SC_ResultWhere v-if="page.whereIs(id)">{{ page.whereIs(id) }}</SC_ResultWhere>
        </SC_Result>
        <SC_Toggle
          type="button"
          :aria-label="t('help.favorites.remove')"
          :title="t('help.favorites.remove')"
          @click="help.toggleFavorite(id)"
        >
          <CloseOutlined />
        </SC_Toggle>
      </SC_FavoriteRow>
    </li>
  </SC_List>
  <SC_Empty v-else>{{ t('help.favorites.empty') }}</SC_Empty>
</template>

<script setup lang="ts">
// «Избранное»: статьи, отмеченные звёздочкой, — на этом устройстве.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CloseOutlined, StarOutlined } from '@/components/icons'
import { topicPath } from '@/b-components/help/help-view'
import { useHelpStore } from '@/stores/help-store'
import { useHelpPageContext } from '../use-help-page'
import {
  SC_Empty,
  SC_FavoriteRow,
  SC_ItemButton,
  SC_List,
  SC_Result,
  SC_ResultTitle,
  SC_ResultWhere,
  SC_Toggle,
} from '../help-page.styled'

const { t } = useI18n()
const page = useHelpPageContext()
const help = useHelpStore()

const current = computed(() => page.topic.value?.id ?? null)
const canAddCurrent = computed(() => !!current.value && !help.isFavorite(current.value))

/** Статьи, которых в справке больше нет, не показываем. */
const items = computed(() => help.favorites.filter((id) => page.library.value?.topics.has(id)))

function titleOf(id: string): string {
  return page.library.value?.topics.get(id)?.title ?? id
}

function open(event: MouseEvent, id: string): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  page.openTopic(id)
}
</script>
