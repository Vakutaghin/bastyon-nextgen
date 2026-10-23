<template>
  <SC_ChatListRoot>
    <!-- Фильтр — только когда есть и личные чаты, и группы: иначе выбирать не из чего. -->
    <SC_ChatFilter v-if="showFilter" role="radiogroup" :aria-label="t('messenger.filterLabel')">
      <SC_FilterChip
        v-for="f in FILTERS"
        :key="f.id"
        type="button"
        role="radio"
        :aria-checked="filter === f.id"
        :class="{ active: filter === f.id }"
        :data-filter="f.id"
        @click="store.setChatFilter(f.id)"
      >
        {{ t(f.label) }}
      </SC_FilterChip>
    </SC_ChatFilter>
    <SC_ChatList>
      <ChatListItem
        v-for="dialog in shown"
        :key="dialog.id"
        :dialog="dialog"
        @click="onSelect(dialog.id)"
      />
    </SC_ChatList>
  </SC_ChatListRoot>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isGroupDialog, type Dialog } from '../../types'
import { useMessengerStore } from '../../store'
import { getAddressFromMatrixId } from '../../helpers'
import type { ChatFilter } from '../../store/messenger-ui-store'
import ChatListItem from '../chat-list-item/chat-list-item.vue'
import { SC_ChatFilter, SC_ChatList, SC_ChatListRoot, SC_FilterChip } from './styled'

const FILTERS: Array<{ id: ChatFilter; label: string }> = [
  { id: 'all', label: 'messenger.filterAll' },
  { id: 'direct', label: 'messenger.filterDirect' },
  { id: 'groups', label: 'messenger.filterGroups' },
]

const props = defineProps<{ dialogs: Dialog[] }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
const store = useMessengerStore()

const showFilter = computed<boolean>(() => {
  let groups = false
  let direct = false
  for (const d of props.dialogs) {
    if (isGroupDialog(d)) groups = true
    else direct = true
    if (groups && direct) return true
  }
  return false
})

/** Вышли из последней группы — фильтр пропал, список снова целиком. */
const filter = computed<ChatFilter>(() => (showFilter.value ? store.chatFilter : 'all'))

const shown = computed<Dialog[]>(() => {
  if (filter.value === 'groups') return props.dialogs.filter(isGroupDialog)
  if (filter.value === 'direct') return props.dialogs.filter((d) => !isGroupDialog(d))
  return props.dialogs
})

// Имена в мозаике группы и в «Анна: …» — из профилей Bastyon. Список с
// прошлого запуска приходит раньше синка, и без запроса там стояли адреса.
watch(
  () => props.dialogs,
  (list) => {
    const missing = new Set<string>()
    for (const d of list) {
      if (!d.group) continue
      const ids = d.lastMessage
        ? [...d.group.previewIds, d.lastMessage.senderId]
        : d.group.previewIds
      for (const id of ids) {
        const address = getAddressFromMatrixId(id)
        if (address && !store.userProfiles[address]) missing.add(address)
      }
    }
    if (missing.size) void store.fetchProfiles([...missing])
  },
  { immediate: true }
)

function onSelect(id: string): void {
  emit('select', id)
}
</script>
