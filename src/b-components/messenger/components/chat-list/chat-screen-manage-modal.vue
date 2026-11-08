<template>
  <!-- «Скрытые чаты» из меню глаза: кого и почему спрятал фильтр входящих,
       открыть чат или вернуть его в список. Правила — в настройках. -->
  <Modal
    :open="screen.manageOpen"
    :width="480"
    :centered="true"
    :z-index="2700"
    :destroy-on-close="true"
    :footer="null"
    :title="t('messenger.screen.manageTitle')"
    wrap-class-name="chat-screen-manage"
    @cancel="screen.manageOpen = false"
  >
    <SC_ManageLead>{{ t('messenger.screen.manageLead') }}</SC_ManageLead>

    <SC_ManageList v-if="rows.length" data-testid="screen-manage-list">
      <SC_ManageRow v-for="row in rows" :key="row.dialog.id" data-testid="screen-manage-row">
        <Avatar
          :src="row.dialog.partner.avatar"
          :alt="row.dialog.partner.name || row.dialog.partner.id"
          :fallback-text="row.dialog.partner.name || row.dialog.partner.id"
          :size="36"
          shape="circle"
        />
        <SC_ManageInfo>
          <SC_ManageName>
            <span>{{ row.dialog.partner.name }}</span>
            <SC_ManageUnread v-if="row.dialog.unreadCount > 0">
              {{ row.dialog.unreadCount > 99 ? '99+' : row.dialog.unreadCount }}
            </SC_ManageUnread>
          </SC_ManageName>
          <SC_ManageMeta>{{ row.reason }}</SC_ManageMeta>
        </SC_ManageInfo>
        <SC_ManageActions>
          <SC_ManageButton type="button" data-testid="screen-manage-open" @click="open(row.dialog)">
            {{ t('messenger.screen.open') }}
          </SC_ManageButton>
          <SC_ManageButton
            type="button"
            class="primary"
            data-testid="screen-manage-unhide"
            :aria-label="t('messenger.screen.unhideOf', { name: row.dialog.partner.name })"
            @click="screen.unhideChat(row.dialog)"
          >
            {{ t('messenger.screen.unhideShort') }}
          </SC_ManageButton>
        </SC_ManageActions>
      </SC_ManageRow>
    </SC_ManageList>
    <SC_ManageEmpty v-else data-testid="screen-manage-empty">
      {{ t('messenger.screen.noneHidden') }}
    </SC_ManageEmpty>

    <SC_ManageFooter>
      <SC_ManageLink type="button" data-testid="screen-manage-rules" @click="rules">
        <SettingOutlined />
        {{ t('messenger.screen.rules') }}
      </SC_ManageLink>
      <HelpLink topic="chats#screen" />
    </SC_ManageFooter>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import Avatar from '@/components/avatar/avatar.vue'
import { SettingOutlined } from '@/components/icons'
import HelpLink from '@/b-components/help/help-link.vue'
import type { Dialog } from '../../types'
import { useMessengerStore } from '../../store'
import { useMessengerScreenStore } from '../../store/messenger-screen-store'
import { useOpenChatSettings } from './use-open-chat-settings'
import {
  SC_ManageActions,
  SC_ManageButton,
  SC_ManageEmpty,
  SC_ManageFooter,
  SC_ManageInfo,
  SC_ManageLead,
  SC_ManageLink,
  SC_ManageList,
  SC_ManageMeta,
  SC_ManageName,
  SC_ManageRow,
  SC_ManageUnread,
} from './chat-screen-manage-modal.styled'

const { t } = useI18n()
const store = useMessengerStore()
const screen = useMessengerScreenStore()
const openChatSettings = useOpenChatSettings()

interface Row {
  dialog: Dialog
  reason: string
}

function reasonText(dialog: Dialog): string {
  switch (screen.reasonFor(dialog)) {
    case 'person':
      return t('messenger.screen.reasonPerson')
    case 'reputation':
      return t('messenger.screen.reasonReputation', { n: screen.prefs.reputation.below })
    case 'mark':
      return t('messenger.screen.reasonMark')
    default:
      return ''
  }
}

/** Сначала чаты с новым, дальше — по свежести. */
const rows = computed<Row[]>(() =>
  [...screen.hiddenDialogs]
    .sort(
      (a, b) =>
        Number(b.unreadCount > 0) - Number(a.unreadCount > 0) ||
        (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0)
    )
    .map((dialog) => ({ dialog, reason: reasonText(dialog) }))
)

function open(dialog: Dialog): void {
  screen.manageOpen = false
  store.openChat(dialog.id)
}

function rules(): void {
  screen.manageOpen = false
  openChatSettings('screen')
}
</script>
