<template>
  <SC_Poll>
    <SC_PollToggle>
      <input type="checkbox" :checked="active" @change="onToggle" />
      {{ t('postComposer.pollToggle') }}
    </SC_PollToggle>

    <SC_PollBody v-if="active">
      <SC_PollInput
        :value="title"
        :placeholder="t('postComposer.pollQuestion')"
        :aria-label="t('postComposer.pollQuestion')"
        @input="emit('update:title', ($event.target as HTMLInputElement).value)"
      />

      <SC_PollOptionRow v-for="(opt, i) in options" :key="i">
        <SC_PollInput
          :value="opt"
          :placeholder="t('postComposer.pollOption', { n: i + 1 })"
          :aria-label="t('postComposer.pollOption', { n: i + 1 })"
          @input="emit('updateOption', i, ($event.target as HTMLInputElement).value)"
        />
        <SC_PollOptionRemove
          v-if="options.length > 2"
          type="button"
          :aria-label="t('postComposer.pollRemoveOption')"
          @click="emit('removeOption', i)"
        >
          ×
        </SC_PollOptionRemove>
      </SC_PollOptionRow>

      <SC_PollAddBtn
        type="button"
        :disabled="options.length >= MAX_POLL_OPTIONS"
        @click="emit('addOption')"
      >
        + {{ t('postComposer.pollAddOption') }}
      </SC_PollAddBtn>
    </SC_PollBody>
  </SC_Poll>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { MAX_POLL_OPTIONS } from './consts'
import {
  SC_Poll,
  SC_PollAddBtn,
  SC_PollBody,
  SC_PollInput,
  SC_PollOptionRemove,
  SC_PollOptionRow,
  SC_PollToggle,
} from './composer-poll.styled'

defineProps<{ active: boolean; title: string; options: string[] }>()
const emit = defineEmits<{
  (e: 'toggle', active: boolean): void
  (e: 'update:title', value: string): void
  (e: 'updateOption', index: number, value: string): void
  (e: 'addOption'): void
  (e: 'removeOption', index: number): void
}>()

const { t } = useI18n()

const onToggle = (e: Event): void => {
  emit('toggle', (e.target as HTMLInputElement).checked)
}
</script>
