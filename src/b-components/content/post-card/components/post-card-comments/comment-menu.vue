<template>
  <APopover
    v-model:open="open"
    trigger="click"
    placement="bottomRight"
    :overlay-class-name="'comment-menu-popover'"
  >
    <template #content>
      <SC_MenuList @click.stop>
        <SC_MenuItem v-if="canEdit" type="button" @click.stop.prevent="onAction('edit')">
          <EditOutlined />
          <span>{{ t('comments.edit') }}</span>
        </SC_MenuItem>

        <SC_MenuItem v-if="canShare" type="button" @click.stop.prevent="onAction('share')">
          <ShareAltOutlined />
          <span>{{ t('comments.share') }}</span>
        </SC_MenuItem>

        <SC_MenuItem v-if="canDonate" type="button" @click.stop.prevent="onAction('donate')">
          <GiftOutlined />
          <span>{{ t('donate.tip') }}</span>
        </SC_MenuItem>

        <SC_MenuItem
          v-if="canBlock"
          type="button"
          :disabled="blockPending"
          @click.stop.prevent="onAction(isBlocked ? 'unblock' : 'block')"
        >
          <StopOutlined />
          <span>{{ isBlocked ? t('comments.unblock') : t('comments.block') }}</span>
        </SC_MenuItem>

        <SC_MenuItem
          v-if="canReport"
          type="button"
          class="menu-item--danger"
          @click.stop.prevent="onAction('report')"
        >
          <FlagOutlined />
          <span>{{ t('report.action') }}</span>
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

    <SC_MenuTrigger type="button" :title="t('comments.actions')" @click.stop>
      <MoreOutlined />
    </SC_MenuTrigger>
  </APopover>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover } from 'ant-design-vue'
import {
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  StopOutlined,
  ShareAltOutlined,
  GiftOutlined,
  FlagOutlined,
} from '@ant-design/icons-vue'
import { SC_MenuList, SC_MenuItem, SC_MenuTrigger } from './styled'

export type CommentMenuAction =
  | 'edit'
  | 'delete'
  | 'block'
  | 'unblock'
  | 'share'
  | 'donate'
  | 'report'

defineProps<{
  /** Можно ли редактировать (свой комментарий, не temp) */
  canEdit: boolean
  /** Можно ли удалить (свой комментарий ИЛИ автор поста) */
  canDelete: boolean
  /** Можно ли поделиться ссылкой на комментарий (обычный, не pending) */
  canShare: boolean
  /** Можно ли (раз)блокировать автора (чужой комментарий, авторизован) */
  canBlock: boolean
  /** Можно ли донатить автору (чужой комментарий, авторизован) */
  canDonate: boolean
  /** Можно ли пожаловаться (чужой комментарий, авторизован) */
  canReport: boolean
  /** Уже заблокирован ли автор (показываем «Разблокировать») */
  isBlocked: boolean
  /** Идёт ли block/unblock транзакция (дизейбл пункта) */
  blockPending: boolean
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
