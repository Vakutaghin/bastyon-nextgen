<template>
  <!-- «Поделиться профилем»: кнопку передаёт шапка (у боковой панели и у
       телефона она своя), меню одно. -->
  <Dropdown v-model:open="open" :trigger="['click']" placement="bottomRight">
    <slot />
    <template #overlay>
      <Menu :items="items" data-testid="profile-share-menu" @click="onMenu" />
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dropdown, Menu, type MenuProps } from 'ant-design-vue'
import { CopyOutlined, SendOutlined, ShareAltOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { useShareToChat } from '@/composables/use-share-to-chat'
import { copyText } from '@/helpers/common/clipboard'
import { chatLinks, publicProfileUrl } from '@/helpers/common/share-origin'

const props = defineProps<{
  address: string
  /** Ник: ссылка для копирования — по нему; в чат — по адресу, ник можно сменить. */
  name?: string
}>()

const { t } = useI18n()
const { canShareToChat, shareToChat } = useShareToChat()
const open = ref(false)

const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

type MenuItems = NonNullable<MenuProps['items']>

const items = computed<MenuItems>(() => [
  ...(canShareToChat.value
    ? [{ key: 'chat', label: t('shareToChat.action'), icon: () => h(SendOutlined) }]
    : []),
  { key: 'copy', label: t('profile.copyLink'), icon: () => h(CopyOutlined) },
  ...(canNativeShare
    ? [{ key: 'native', label: t('postCard.shareVia'), icon: () => h(ShareAltOutlined) }]
    : []),
])

const link = (): string => publicProfileUrl(props.address, props.name)

async function onMenu({ key }: { key: string | number }): Promise<void> {
  open.value = false
  if (key === 'chat') {
    shareToChat({ link: chatLinks.profile(props.address), title: props.name || props.address })
  } else if (key === 'copy') {
    const url = link()
    if (await copyText(url))
      appToast.success({ message: t('profile.linkCopied'), description: url })
    else appToast.error({ message: t('postCard.shareFailed') })
  } else if (key === 'native') {
    try {
      await navigator.share({ url: link(), text: props.name || props.address })
    } catch (e) {
      // AbortError — закрыли системный диалог, это не ошибка.
      if (e instanceof Error && e.name !== 'AbortError') {
        appToast.error({ message: t('postCard.shareFailed') })
      }
    }
  }
}
</script>
