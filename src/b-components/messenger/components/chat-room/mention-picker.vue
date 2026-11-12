<template>
  <!-- Кого упомянуть: над полем ввода, как в Telegram. Фокус остаётся в поле:
       стрелки двигают выбор, Enter — выбрать; пальцем — нажатием. -->
  <SC_MentionList
    :id="listId"
    ref="listRef"
    role="listbox"
    :aria-label="t('messenger.mention.title')"
    data-testid="mention-picker"
  >
    <SC_MentionOption
      v-for="(m, i) in members"
      :id="`${listId}-${i}`"
      :key="m.address"
      type="button"
      role="option"
      tabindex="-1"
      :aria-selected="i === active"
      :class="{ active: i === active }"
      data-testid="mention-option"
      @mousedown.prevent
      @click="emit('pick', m)"
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
    </SC_MentionOption>
  </SC_MentionList>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Avatar from '@/components/avatar/avatar.vue'
import { SC_MentionList, SC_MentionOption } from './styled'

interface Member {
  address: string
  name: string
  avatar?: string
}

const props = defineProps<{
  members: readonly Member[]
  /** Выбранный стрелками. */
  active: number
  /** id списка — для aria-controls поля; у вариантов — `${listId}-${i}`. */
  listId: string
}>()

const emit = defineEmits<{ pick: [member: Member] }>()

const { t } = useI18n()
const listRef = ref<{ $el?: HTMLElement } | null>(null)

// Выбранный стрелками — в видимой части списка.
watch(
  () => props.active,
  (i) => {
    void nextTick(() => {
      const options = listRef.value?.$el?.querySelectorAll<HTMLElement>('[role="option"]')
      options?.[i]?.scrollIntoView?.({ block: 'nearest' })
    })
  }
)
</script>
