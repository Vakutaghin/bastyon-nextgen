<template>
  <APopover
    v-model:open="open"
    trigger="click"
    placement="bottomRight"
    :overlay-class-name="'comment-menu-popover'"
  >
    <template #content>
      <SC_MenuList @click.stop>
        <SC_MenuItem
          v-if="canEdit"
          type="button"
          @click.stop.prevent="onAction('edit')"
        >
          <EditOutlined />
          <span>{{ t('comments.edit') }}</span>
        </SC_MenuItem>

        <SC_MenuItem
          v-if="canDelete"
          type="button"
          class="menu-item--danger"
          @click.stop.prevent="onAction('delete')"
        >
          <DeleteOutlined />
          <span>{{ t('comments.delete') }}</span>
        </SC_MenuItem>
      </SC_MenuList>
    </template>

    <SC_MenuTrigger
      type="button"
      :title="t('comments.actions')"
      @click.stop
    >
      <MoreOutlined />
    </SC_MenuTrigger>
  </APopover>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover } from 'ant-design-vue'
import { MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { SC_MenuList, SC_MenuItem, SC_MenuTrigger } from './styled'

export type CommentMenuAction = 'edit' | 'delete'

defineProps<{
  /** Можно ли редактировать (свой комментарий, не temp) */
  canEdit: boolean
  /** Можно ли удалить (свой комментарий ИЛИ автор поста) */
  canDelete: boolean
}>()

const emit = defineEmits<{
  action: [action: CommentMenuAction]
}>()

const { t } = useI18n()

const open = ref(false)

const APopover = Popover

function onAction(action: CommentMenuAction) {
  open.value = false
  emit('action', action)
}
</script>
