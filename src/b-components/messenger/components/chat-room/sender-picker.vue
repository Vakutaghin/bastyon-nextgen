<template>
  <!-- Чьи сообщения искать: участники группы, по имени из поля поиска.
       Фокус остаётся в поле (combobox): стрелки двигают выбор, Enter — выбрать. -->
  <SC_SenderList
    :id="listId"
    ref="listRef"
    role="listbox"
    :aria-label="t('messenger.search.senders')"
    data-testid="chat-search-senders"
  >
    <SC_SenderOption
      v-for="(m, i) in shown"
      :id="`${listId}-${i}`"
      :key="m.id"
      type="button"
      role="option"
      tabindex="-1"
      :aria-selected="i === active"
      :class="{ active: i === active }"
      data-testid="chat-search-sender-option"
      @mousedown.prevent
      @click="emit('pick', m.id, m.name)"
    >
      <Avatar
        aria-hidden="true"
        :src="m.avatar"
        alt=""
        :fallback-text="m.name"
        :size="28"
        shape="circle"
      />
      <span class="name">{{ m.name }}</span>
      <SC_YouTag v-if="m.isMe">{{ t('messenger.you') }}</SC_YouTag>
    </SC_SenderOption>
    <SC_SenderEmpty v-if="!shown.length">{{ t('messenger.search.noSenders') }}</SC_SenderEmpty>
  </SC_SenderList>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Avatar from '@/components/avatar/avatar.vue'
import { matchesTokens, searchTokens } from '../../lib/message-search'
import { useGroupMembers } from '../group-info/use-group-members'
import { SC_YouTag } from '../group-info/styled'
import { SC_SenderEmpty, SC_SenderList, SC_SenderOption } from './styled'

const props = defineProps<{
  roomId: string | null
  /** Что набрано: начала слов имени, как в поиске по переписке. */
  query: string
  /** id списка — для aria-controls поля; у вариантов — `${listId}-${i}`. */
  listId: string
}>()

const emit = defineEmits<{ pick: [userId: string, name: string] }>()

const { t } = useI18n()
const { members } = useGroupMembers(toRef(props, 'roomId'))
const listRef = ref<{ $el?: HTMLElement } | null>(null)

/** Вступившие (приглашённые ещё ничего не писали), по набранному имени. */
const shown = computed(() => {
  const words = searchTokens(props.query)
  return members.value.filter(
    (m) => m.membership === 'join' && (!words.length || matchesTokens(m.name, words))
  )
})

/** Выбранный стрелками вариант. */
const active = ref(0)
watch(
  () => props.query,
  () => {
    active.value = 0
  }
)

/** Стрелка вверх или вниз: по кругу, выбранный — в видимой части списка. */
function move(delta: number): void {
  const n = shown.value.length
  if (!n) return
  active.value = (active.value + delta + n) % n
  void nextTick(() => {
    const options = listRef.value?.$el?.querySelectorAll<HTMLElement>('[role="option"]')
    options?.[active.value]?.scrollIntoView?.({ block: 'nearest' })
  })
}

/** Enter в поле: выбранный стрелками (по умолчанию — первый). */
function pickActive(): boolean {
  const m = shown.value[active.value] ?? shown.value[0]
  if (m) emit('pick', m.id, m.name)
  return !!m
}

const activeId = computed(() =>
  shown.value.length
    ? `${props.listId}-${Math.min(active.value, shown.value.length - 1)}`
    : undefined
)

defineExpose({ move, pickActive, activeId })
</script>
