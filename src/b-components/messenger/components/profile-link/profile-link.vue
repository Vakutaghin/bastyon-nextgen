<template>
  <SC_ProfileLink
    v-if="to"
    :to="to"
    :class="{ chip }"
    :aria-label="label"
    :title="label"
    @click="onClick"
  >
    <slot />
  </SC_ProfileLink>
  <SC_ProfileStatic v-else :class="{ chip }" :title="name">
    <slot />
  </SC_ProfileStatic>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import { useMessengerStore } from '../../store'
import { SC_ProfileLink, SC_ProfileStatic } from './styled'

/** Адрес Bastyon: base58, начинается с P. Matrix-аккаунт не из Bastyon сюда не пройдёт. */
const ADDRESS_RE = /^P[1-9A-HJ-NP-Za-km-z]{25,40}$/

const props = withDefaults(
  defineProps<{
    /** Чей профиль; null — профиля нет (группа, mesh), остаётся просто содержимое. */
    address: string | null
    /** Имя — для подсказки и экранного диктора. */
    name: string
    /** С отступами и подсветкой при наведении — для шапки. */
    chip?: boolean
  }>(),
  { chip: false }
)

const { t } = useI18n()
const store = useMessengerStore()

const to = computed<RouteLocationRaw | null>(() =>
  props.address && ADDRESS_RE.test(props.address)
    ? { name: 'profile', params: { userName: props.address } }
    : null
)
const label = computed(() => t('messenger.openProfile', { name: props.name }))

/**
 * Полноэкранный чат закрывает страницу целиком — к профилю уходим из него.
 * Смена страницы закрыла бы его и так, но не когда этот профиль уже открыт
 * под чатом. Окошко чата на компьютере остаётся открытым.
 */
function onClick(e: MouseEvent): void {
  // Ссылка в новой вкладке: здесь всё остаётся как было.
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  if (store.isFullScreen) store.closeFullScreen()
}
</script>
