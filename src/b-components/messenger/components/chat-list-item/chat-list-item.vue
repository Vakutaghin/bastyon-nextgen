<template>
  <SC_ListItem
    :class="{ active: isActive }"
    data-testid="chat-row"
    :data-group="isGroup ? '' : undefined"
  >
    <SC_AvatarSlot>
      <GroupAvatar
        v-if="dialog.group"
        :src="dialog.partner.avatar"
        :name="dialog.partner.name"
        :member-ids="dialog.group.previewIds"
        :size="48"
        badge
      />
      <Avatar
        v-else
        :src="dialog.partner.avatar"
        :alt="dialog.partner.name || dialog.partner.id"
        :fallback-text="dialog.partner.name || dialog.partner.id"
        :size="48"
        :verified="dialog.partner.verified"
        :mark="dialog.partner.mark"
        shape="circle"
      />
    </SC_AvatarSlot>

    <SC_Info>
      <SC_Name>
        <!-- Переписка на несколько человек — значок у названия, как в прежнем клиенте. -->
        <SC_GroupMark v-if="isGroup" :title="groupTitle" :aria-label="groupTitle">
          <TeamOutlined />
        </SC_GroupMark>
        <SC_NameText>{{ dialog.partner.name }}</SC_NameText>
        <SC_NetworkMark v-if="networkTitle" :title="networkTitle" :aria-label="networkTitle">
          <RadioTowerIcon />
        </SC_NetworkMark>
        <SC_MutedMark
          v-if="dialog.muted"
          :title="t('messenger.notifyMuted')"
          :aria-label="t('messenger.notifyMuted')"
        >
          <BellOffOutlined />
        </SC_MutedMark>
      </SC_Name>

      <SC_LastMessage v-if="dialog.lastMessage">
        <!-- Своё сообщение: галочка, как в переписке. В личном чате она и говорит,
             что сообщение ваше, — «Вы:» остаётся только в группах. -->
        <SC_ListTick
          v-if="lastMark"
          data-testid="last-mark"
          role="img"
          :class="{ done: lastMark.done }"
          :title="lastMark.title"
          :aria-label="lastMark.title"
          :data-mark="lastMark.mark"
        >
          <DeliveryTicks :mark="lastMark.mark" />
        </SC_ListTick>
        <SC_ListFailed
          v-else-if="lastFailed"
          data-testid="last-mark"
          :title="t('messenger.notSent')"
          :aria-label="t('messenger.notSent')"
          >!</SC_ListFailed
        >
        <span v-if="isMine(dialog.lastMessage) && (isGroup || !lastMark)">{{
          t('chat.youPrefix')
        }}</span>
        <SC_SenderPrefix v-else-if="!isMine(dialog.lastMessage) && senderPrefix"
          >{{ senderPrefix }}:</SC_SenderPrefix
        >
        {{ lastMessagePreview }}
      </SC_LastMessage>
      <!-- Приглашение: до вступления ленты нет, раньше строка была пустой. -->
      <SC_LastMessage v-else-if="dialog.invite" data-testid="invite-preview">
        {{ invitePreview }}
      </SC_LastMessage>
    </SC_Info>

    <SC_Meta>
      <SC_Time v-if="dialog.lastMessage">
        {{ formatTime(dialog.lastMessage.timestamp) }}
      </SC_Time>
      <SC_Time v-else-if="dialog.invite && dialog.createdAt">
        {{ formatTime(dialog.createdAt) }}
      </SC_Time>

      <SC_MenuWrap>
        <SC_Badge v-if="dialog.unreadCount > 0 && !menuOpen" :class="{ muted: dialog.muted }">
          {{ dialog.unreadCount > 99 ? '99+' : dialog.unreadCount }}
        </SC_Badge>
        <SC_UnreadDot
          v-else-if="dialog.hasUnread && !menuOpen"
          :title="t('messenger.group.unread')"
          :aria-label="t('messenger.group.unread')"
        />

        <SC_DotsBtn class="dots-btn" @click.stop="toggleMenu">
          <EllipsisOutlined />
        </SC_DotsBtn>

        <Teleport to="body">
          <div v-if="menuOpen">
            <SC_Overlay @click.stop="menuOpen = false" />
            <SC_Dropdown :style="dropdownStyle">
              <SC_DropdownItem v-if="dialog.group" @click.stop="onShowMembers">
                <TeamOutlined />
                {{ t('messenger.group.showMembers') }}
              </SC_DropdownItem>
              <SC_DropdownItem v-if="canMute" @click.stop="onToggleMuted">
                <BellOutlined v-if="dialog.muted" />
                <BellOffOutlined v-else />
                {{ dialog.muted ? t('messenger.notifyOn') : t('messenger.notifyOff') }}
              </SC_DropdownItem>
              <SC_DropdownItem
                v-if="canArchive"
                data-testid="archive-toggle"
                @click.stop="onToggleArchive"
              >
                <DeviceCopyIcon />
                {{ archived ? t('messenger.archive.menuStop') : t('messenger.archive.menuStart') }}
              </SC_DropdownItem>
              <SC_DropdownItem class="danger" @click.stop="onDelete">
                <LogoutOutlined v-if="dialog.group" />
                <DeleteOutlined v-else />
                {{ dialog.group ? t('messenger.group.leave') : t('chat.deleteDialog') }}
              </SC_DropdownItem>
            </SC_Dropdown>
          </div>
        </Teleport>
      </SC_MenuWrap>
    </SC_Meta>

    <Teleport to="body">
      <SC_ConfirmOverlay v-if="showConfirm" @click="showConfirm = false">
        <SC_ConfirmDialog @click.stop>
          <template v-if="dialog.group">
            <SC_ConfirmTitle>{{ t('messenger.group.leaveConfirmTitle') }}</SC_ConfirmTitle>
            <SC_ConfirmText>
              {{ t('messenger.group.leaveConfirmText', { name: dialog.partner.name }) }}
            </SC_ConfirmText>
          </template>
          <template v-else>
            <SC_ConfirmTitle>{{ t('chat.deleteDialogConfirmTitle') }}</SC_ConfirmTitle>
            <SC_ConfirmText>
              {{ t('chat.deleteDialogConfirmText', { name: dialog.partner.name }) }}
            </SC_ConfirmText>
          </template>
          <SC_ConfirmText v-if="archive.hasCopy(dialog.id)">
            {{ t('messenger.archive.deleteWithChat') }}
          </SC_ConfirmText>
          <SC_ConfirmButtons>
            <SC_CancelBtn @click="showConfirm = false">{{ t('chat.cancel') }}</SC_CancelBtn>
            <SC_ConfirmDeleteBtn @click="confirmDelete">
              {{ dialog.group ? t('messenger.group.leave') : t('chat.delete') }}
            </SC_ConfirmDeleteBtn>
          </SC_ConfirmButtons>
        </SC_ConfirmDialog>
      </SC_ConfirmOverlay>
    </Teleport>
  </SC_ListItem>
</template>

<script setup lang="ts">
import { formatClock } from '@/helpers/common/date-formatter'
import { parseIpfsFileLink, parseIpfsNameLink } from '@/helpers/ipfs/ipfs-link'
import { supportReportPreview } from '../../lib/support-report-preview'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import Avatar from '@/components/avatar/avatar.vue'
import { Z_INDEX } from '@/styles/design-tokens'
import {
  BellOffOutlined,
  BellOutlined,
  DeleteOutlined,
  DeviceCopyIcon,
  EllipsisOutlined,
  LogoutOutlined,
  RadioTowerIcon,
  TeamOutlined,
} from '@/components/icons'
import { isMeshDialogId } from '@/mesh/ids'
import { isGroupDialog, isMeshTransport, type Dialog, type Message } from '../../types'
import { useMessengerStore } from '../../store'
import { useMessengerChatStore } from '../../store/messenger-chat-store'
import { useMessengerArchiveStore } from '../../store/messenger-archive-store'
import { archivableChatId } from '../../lib/archive-prefs'
import { seenMessageIds, type ReceiptRoom } from '../../store/messenger-chat-store/read-receipts'
import { matrixService } from '../../services/matrix-service'
import { chatUserName } from '../../helpers'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../../store/consts'
import { lastMessageMark } from './last-message-mark'
import GroupAvatar from '../group-avatar/group-avatar.vue'
import DeliveryTicks from '../message-item/delivery-ticks.vue'
import {
  SC_AvatarSlot,
  SC_GroupMark,
  SC_ListFailed,
  SC_ListTick,
  SC_MutedMark,
  SC_NameText,
  SC_SenderPrefix,
  SC_UnreadDot,
  SC_ListItem,
  SC_Info,
  SC_Name,
  SC_LastMessage,
  SC_Meta,
  SC_Time,
  SC_Badge,
  SC_MenuWrap,
  SC_DotsBtn,
  SC_Dropdown,
  SC_DropdownItem,
  SC_Overlay,
  SC_ConfirmOverlay,
  SC_ConfirmDialog,
  SC_ConfirmTitle,
  SC_ConfirmText,
  SC_ConfirmButtons,
  SC_CancelBtn,
  SC_ConfirmDeleteBtn,
  SC_NetworkMark,
} from './styled'

const props = defineProps<{ dialog: Dialog }>()
const { t } = useI18n()
const store = useMessengerStore()

const menuOpen = ref(false)
const showConfirm = ref(false)
const menuPos = ref({ top: 0, right: 0 })

/** Диалог через радио: значок сети и подсказка, открытый ли это канал. */
const networkTitle = computed<string>(() => {
  const d = props.dialog
  if (!isMeshTransport(d.transport)) return ''
  const network = t(`mesh.networks.${d.transport}`)
  if (d.meshKind === 'room') return `${network} · ${t('mesh.chat.roomShort')}`
  if (d.meshKind === 'channel' && d.channelKind !== 'private') {
    return `${network} · ${t('mesh.chat.openChannel')}`
  }
  return network
})

const isGroup = computed<boolean>(() => isGroupDialog(props.dialog))

const groupTitle = computed<string>(() => {
  const g = props.dialog.group
  if (!g) return t('messenger.group.kind')
  const kind = g.isPublic ? t('messenger.group.kindPublic') : t('messenger.group.kind')
  return `${kind} · ${t('messenger.group.members', { n: g.memberCount }, g.memberCount)}`
})

/** «Без звука» — правило Matrix; у mesh-диалогов его нет. */
const canMute = computed<boolean>(() => !isMeshDialogId(props.dialog.id))

/** Сохранение переписки на устройстве — у комнат Matrix, в которые вступили. */
const archive = useMessengerArchiveStore()
const canArchive = computed<boolean>(
  () => archive.ready && archivableChatId(props.dialog.id) && !props.dialog.invite
)
const archived = computed<boolean>(() => archive.isArchived(props.dialog.id))

/** Сохранять ли этот чат — с подтверждением: это про то, что останется на устройстве. */
function onToggleArchive(): void {
  menuOpen.value = false
  const on = !archived.value
  const name = props.dialog.partner.name
  const count = archive.stats[props.dialog.id]?.count ?? 0
  Modal.confirm({
    title: on
      ? t('messenger.archive.startTitle', { name })
      : t('messenger.archive.stopTitle', { name }),
    content: on
      ? archive.prefs.enabled
        ? t('messenger.archive.startText')
        : `${t('messenger.archive.startText')} ${t('messenger.archive.startOnlyThis')}`
      : count
        ? t('messenger.archive.stopTextSaved', { n: count })
        : t('messenger.archive.stopText'),
    okText: on ? t('messenger.archive.startOk') : t('messenger.archive.stopOk'),
    cancelText: t('messenger.cancel'),
    centered: true,
    zIndex: Z_INDEX.CONFIRM,
    onOk: () => archive.setChat(props.dialog.id, on),
  })
}

/** В группе видно, кто написал последним: «Анна: привет». */
const senderPrefix = computed<string>(() => {
  const m = props.dialog.lastMessage
  if (!m || !isGroup.value) return ''
  if (isMeshTransport(m.transport)) return m.senderName || ''
  return chatUserName(m.senderId, store.userProfiles, m.senderName)
})

/** Этот диалог сейчас открыт в чат-комнате — подсвечиваем его в списке слева. */
const isActive = computed<boolean>(() => store.activeChatId === props.dialog.id)

// Превью последнего сообщения в списке. Для медиа показываем понятную метку
// («Аудио сообщение» и т.п.), а не сырой body — у аудио/медиа это имя файла или
// зашифрованная строка, и в списке она выглядела как набор букв.
const lastMessagePreview = computed<string>(() => {
  const m = props.dialog.lastMessage
  if (!m) return ''
  if (m.deleted) return t('messenger.history.deletedPreview')
  if (m.text === ENCRYPTED_MESSAGE_PLACEHOLDER) return t('messenger.history.undecryptable')
  switch (m.type) {
    case 'audio':
      return t('chat.audioMessage')
    case 'image':
      return t('chat.imageMessage')
    case 'video':
      return t('chat.videoMessage')
    case 'file':
      return t('chat.fileMessage')
    default: {
      // «Файл через IPFS» — ссылка с ключом: в списке имя файла, а не ссылка.
      const ipfsFile = parseIpfsFileLink(m.text)
      if (ipfsFile) return `📎 ${ipfsFile.name || t('messenger.ipfsCardNoName')}`
      if (parseIpfsNameLink(m.text)) return `🔗 ${t('messenger.ipnsCardTitle')}`
      // Сведения для поддержки: в списке подпись, а не JSON.
      return supportReportPreview(m.text) ?? m.text
    }
  }
})

/** «Приглашение в чат», в группе — с тем, кто пригласил. */
const invitePreview = computed<string>(() => {
  const by = props.dialog.invite?.by
  if (!isGroup.value || !by) return t('messenger.history.invitePreview')
  return t('messenger.history.inviteGroupPreview', {
    name: chatUserName(by, store.userProfiles),
  })
})

const dropdownStyle = computed(() => ({
  position: 'fixed' as const,
  top: `${menuPos.value.top}px`,
  right: `${menuPos.value.right}px`,
  zIndex: 10001,
}))

function formatTime(timestamp?: number): string {
  return timestamp ? formatClock(timestamp) : ''
}

function isMine(message: Message): boolean {
  return message.senderId === 'me' || message.senderId === store.currentUser.id
}

const chatStore = useMessengerChatStore()

/** Своё последнее сообщение прочитали — по квитанциям Matrix, как «✓✓» в переписке. */
const lastSeen = computed<boolean>(() => {
  const m = props.dialog.lastMessage
  if (!m || !m.id.startsWith('$') || isMeshDialogId(props.dialog.id)) return false
  // Пересчёт, когда пришла квитанция (слушатель Room.receipt).
  void chatStore.receiptsVersion[props.dialog.id]
  const client = matrixService.getClient()
  const room = client?.getRoom?.(props.dialog.id) as ReceiptRoom | null | undefined
  const myUserId = client?.getUserId?.() as string | undefined
  if (!room || !myUserId) return false
  try {
    return seenMessageIds(room, myUserId, [m], () => true).has(m.id)
  } catch {
    return false
  }
})

const lastMark = computed(() => {
  const m = props.dialog.lastMessage
  return m && isMine(m) && !m.deleted ? lastMessageMark(m, lastSeen.value, t) : null
})

const lastFailed = computed<boolean>(() => {
  const m = props.dialog.lastMessage
  return !!m && isMine(m) && m.status === 'failed'
})

function toggleMenu(e: MouseEvent): void {
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }
  const btn = e.currentTarget as HTMLElement | null
  if (btn) {
    const rect = btn.getBoundingClientRect()
    menuPos.value = {
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    }
  }
  menuOpen.value = true
}

function onShowMembers(): void {
  menuOpen.value = false
  store.openGroupInfo(props.dialog.id)
}

function onToggleMuted(): void {
  menuOpen.value = false
  void store.setDialogMuted(props.dialog.id, !props.dialog.muted)
}

function onDelete(): void {
  menuOpen.value = false
  showConfirm.value = true
}

function confirmDelete(): void {
  showConfirm.value = false
  store.deleteDialog(props.dialog.id)
}
</script>
