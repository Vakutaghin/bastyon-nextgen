<template>
  <SC_ListItem :class="{ active: isActive }" data-testid="chat-row" data-channel="">
    <SC_AvatarSlot>
      <ChannelAvatar
        :src="author.avatar"
        :name="author.name"
        :size="48"
        :verified="author.verified"
        :mark="author.mark"
        badge
      />
    </SC_AvatarSlot>

    <SC_Info>
      <SC_Name>
        <SC_ChannelMark
          :title="t('messenger.channel.kind')"
          :aria-label="t('messenger.channel.kind')"
        >
          <MegaphoneIcon />
        </SC_ChannelMark>
        <SC_NameText>{{ author.name }}</SC_NameText>
      </SC_Name>
      <SC_LastMessage>
        <template v-if="last">
          <SC_KindLabel v-if="kindLabel">{{ kindLabel }}</SC_KindLabel>
          <template v-if="kindLabel && last.text"> · </template>
          {{ last.text }}
        </template>
        <template v-else>{{
          summary ? t('messenger.channel.noPosts') : t('messenger.channel.loading')
        }}</template>
      </SC_LastMessage>
    </SC_Info>

    <SC_Meta>
      <SC_Time v-if="last">{{ time }}</SC_Time>

      <SC_MenuWrap>
        <SC_NewBadge v-if="newCount > 0 && !menuOpen" :title="newTitle" :aria-label="newTitle">
          {{ newCount >= CHANNEL_RECENT ? `${CHANNEL_RECENT}+` : newCount }}
        </SC_NewBadge>

        <SC_DotsBtn
          class="dots-btn"
          :aria-label="t('messenger.channel.menu')"
          @click.stop="toggleMenu"
        >
          <EllipsisOutlined />
        </SC_DotsBtn>

        <Teleport to="body">
          <div v-if="menuOpen">
            <SC_Overlay @click.stop="menuOpen = false" />
            <SC_MenuAnchor :top="menuPos.top" :right="menuPos.right">
              <SC_Dropdown>
                <SC_DropdownItem @click.stop="onOpenProfile">
                  <UserOutlined />
                  {{ t('messenger.channel.openProfile') }}
                </SC_DropdownItem>
                <SC_DropdownItem v-if="newCount > 0" @click.stop="onMarkRead">
                  <CheckOutlined />
                  {{ t('messenger.channel.markRead') }}
                </SC_DropdownItem>
                <SC_DropdownItem class="danger" @click.stop="onRemove">
                  <MegaphoneOffIcon />
                  {{ t('messenger.channel.stop') }}
                </SC_DropdownItem>
              </SC_Dropdown>
            </SC_MenuAnchor>
          </div>
        </Teleport>
      </SC_MenuWrap>
    </SC_Meta>
  </SC_ListItem>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  CheckOutlined,
  EllipsisOutlined,
  MegaphoneIcon,
  MegaphoneOffIcon,
  UserOutlined,
} from '@/components/icons'
import { formatClock, formatTimeCompact } from '@/helpers/common/date-formatter'
import { useMessengerStore } from '../../store'
import { CHANNEL_RECENT, useMessengerChannelsStore } from '../../store/messenger-channels-store'
import { channelChatId } from '../../lib/channels'
import { channelAuthor } from '../../lib/channel-author'
import { useStopChannel } from '../channel-room/use-stop-channel'
import ChannelAvatar from '../channel-avatar/channel-avatar.vue'
import {
  SC_AvatarSlot,
  SC_DotsBtn,
  SC_Dropdown,
  SC_DropdownItem,
  SC_Info,
  SC_LastMessage,
  SC_ListItem,
  SC_MenuWrap,
  SC_Meta,
  SC_Name,
  SC_NameText,
  SC_Overlay,
  SC_Time,
} from '../chat-list-item/styled'
import { SC_ChannelMark, SC_KindLabel, SC_MenuAnchor, SC_NewBadge } from './styled'

const props = defineProps<{ address: string }>()
const { t } = useI18n()
const router = useRouter()
const store = useMessengerStore()
const channels = useMessengerChannelsStore()
const stopChannel = useStopChannel()

const summary = computed(() => channels.summaries[props.address])
const last = computed(() => summary.value?.last)
const author = computed(() =>
  channelAuthor(props.address, store.userProfiles[props.address], summary.value)
)
const newCount = computed<number>(() => channels.newCount(props.address))
const newTitle = computed<string>(() =>
  t('messenger.channel.newPosts', { n: newCount.value }, newCount.value)
)
const isActive = computed<boolean>(() => store.activeChatId === channelChatId(props.address))

const kindLabel = computed<string>(() => {
  const kind = last.value?.kind
  return kind && kind !== 'text' ? t(`messenger.channel.kinds.${kind}`) : ''
})

/** Сегодня — часы, раньше — «3 дн.» или дата: посты в канале бывают и недельной давности. */
const time = computed<string>(() => {
  const ms = last.value?.time ?? 0
  if (!ms) return ''
  const sameDay = new Date(ms).toDateString() === new Date().toDateString()
  return sameDay ? formatClock(ms) : formatTimeCompact(Math.floor(ms / 1000))
})

const menuOpen = ref(false)
const menuPos = ref({ top: 0, right: 0 })

function toggleMenu(e: MouseEvent): void {
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }
  const btn = e.currentTarget as HTMLElement | null
  if (btn) {
    const rect = btn.getBoundingClientRect()
    menuPos.value = { top: rect.bottom + 4, right: window.innerWidth - rect.right }
  }
  menuOpen.value = true
}

function onOpenProfile(): void {
  menuOpen.value = false
  // Полноэкранный мессенджер закрывает страницу — профиль за ним не видно.
  if (store.isFullScreen) store.closeFullScreen()
  void router.push({ name: 'profile', params: { userName: props.address } })
}

function onMarkRead(): void {
  menuOpen.value = false
  channels.markAllSeen(props.address)
}

function onRemove(): void {
  menuOpen.value = false
  stopChannel(props.address, author.value.name)
}
</script>
