<template>
  <!-- Панель встаёт там, где ей хватает места (floating-ui): у нижних строк
       списка — над кнопкой. Раньше она всегда раскрывалась вниз, и у последнего
       чата на телефоне половина пунктов была за краем экрана. -->
  <Dropdown
    :open="open"
    :trigger="['click']"
    placement="bottomRight"
    @update:open="emit('update:open', $event)"
  >
    <SC_DotsBtn type="button" class="dots-btn" :aria-label="label" @click.stop>
      <EllipsisOutlined />
    </SC_DotsBtn>
    <template #overlay>
      <Menu :items="items" :aria-label="label" @click="emit('select', $event.key)" />
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
// Меню «…» строки в списке чатов — у чата и у канала одно.
import Dropdown from '@/components/dropdown'
import Menu, { type MenuItem } from '@/components/menu'
import { EllipsisOutlined } from '@/components/icons'
import { SC_DotsBtn } from './styled'

defineProps<{
  items: readonly MenuItem[]
  label: string
  /** Открыто ли: на это время строка прячет счётчик рядом с кнопкой. */
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'select', key: string): void
  (e: 'update:open', open: boolean): void
}>()
</script>
