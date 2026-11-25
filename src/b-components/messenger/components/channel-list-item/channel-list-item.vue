<template>
  <!-- Строка канала — ссылка: Tab доходит до неё, Enter и пробел открывают канал.
       Не role=button: у кнопки содержимое для диктора «сплющено», и «…» в строке пропадало. -->
  <SC_ListItem
    v-key-activate
    :class="{ active: isActive }"
    role="link"
    tabindex="0"
    :aria-current="isActive ? 'true' : undefined"
    data-testid="chat-row"
    data-channel=""
  >
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

        <RowMenu
          v-model:open="menuOpen"
          :items="menuItems"
          :label="t('messenger.channel.menu')"
          @select="onMenu"
        />
      </SC_MenuWrap>
    </SC_Meta>
  </SC_ListItem>
</template>

<script setup lang="ts">
import { computed, h, ref, type Component } from 'vue'
import { vKeyActivate } from '@/helpers/a11y/key-activate'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { CheckOutlined, MegaphoneIcon, MegaphoneOffIcon, UserOutlined } from '@/components/icons'
import { formatClock, formatTimeCompact } from '@/helpers/common/date-formatter'
import { useMessengerStore } from '../../store'
import { CHANNEL_RECENT, useMessengerChannelsStore } from '../../store/messenger-channels-store'
import { channelChatId } from '../../lib/channels'
import { channelAuthor } from '../../lib/channel-author'
import { useStopChannel } from '../channel-room/use-stop-channel'
import type { MenuActionItem } from '@/components/menu'
import RowMenu from '../chat-list-item/row-menu.vue'
import ChannelAvatar from '../channel-avatar/channel-avatar.vue'
import {
  SC_AvatarSlot,
  SC_Info,
  SC_LastMessage,
  SC_ListItem,
  SC_MenuWrap,
  SC_Meta,
  SC_Name,
  SC_NameText,
  SC_Time,
} from '../chat-list-item/styled'
import { SC_ChannelMark, SC_KindLabel, SC_NewBadge } from './styled'

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

const icon = (c: Component) => () => h(c)

const menuItems = computed<MenuActionItem[]>(() => {
  const out: MenuActionItem[] = [
    { key: 'profile', label: t('messenger.channel.openProfile'), icon: icon(UserOutlined) },
  ]
  if (newCount.value > 0) {
    out.push({ key: 'read', label: t('messenger.channel.markRead'), icon: icon(CheckOutlined) })
  }
  out.push({
    key: 'stop',
    label: t('messenger.channel.stop'),
    icon: icon(MegaphoneOffIcon),
    danger: true,
  })
  return out
})

function onMenu(key: string): void {
  if (key === 'profile') openProfile()
  else if (key === 'read') channels.markAllSeen(props.address)
  else if (key === 'stop') stopChannel(props.address, author.value.name)
}

function openProfile(): void {
  // Полноэкранный мессенджер закрывает страницу — профиль за ним не видно.
  if (store.isFullScreen) store.closeFullScreen()
  void router.push({ name: 'profile', params: { userName: props.address } })
}
</script>
