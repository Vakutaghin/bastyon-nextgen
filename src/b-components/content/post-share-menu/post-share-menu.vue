<template>
  <SC_ShareMenu>
    <SC_ShareItem type="button" @click="copyLink">
      <SC_ShareIcon><CopyOutlined /></SC_ShareIcon>
      {{ t('postCard.copyLink') }}
    </SC_ShareItem>

    <SC_ShareItem v-if="canNativeShare" type="button" @click="nativeShare">
      <SC_ShareIcon><ShareAltOutlined /></SC_ShareIcon>
      {{ t('postCard.shareVia') }}
    </SC_ShareItem>

    <SC_ShareDivider />

    <SC_ShareItem
      v-for="target in SHARE_TARGETS"
      :key="target.key"
      type="button"
      @click="openExternal(target)"
    >
      <SC_ShareIcon :color="target.color">
        <component :is="target.icon" />
      </SC_ShareIcon>
      {{ target.label }}
    </SC_ShareItem>
  </SC_ShareMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CopyOutlined, ShareAltOutlined } from '@ant-design/icons-vue'
import { appToast } from '@/b-components/app-toast'
import { SHARE_TARGETS, type ShareTarget } from '@/helpers/common/share-targets'
import { SC_ShareMenu, SC_ShareItem, SC_ShareIcon, SC_ShareDivider } from './styled'

const props = defineProps<{ url: string; text: string }>()
const emit = defineEmits<{ (e: 'done'): void }>()

const { t } = useI18n()

const canNativeShare = computed<boolean>(
  () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'
)

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.url)
    appToast.success({ message: t('postCard.linkCopied'), description: props.url })
  } catch {
    appToast.error({ message: t('postCard.shareFailed') })
  } finally {
    emit('done')
  }
}

async function nativeShare(): Promise<void> {
  try {
    await navigator.share({ url: props.url, text: props.text })
  } catch (e) {
    // AbortError — пользователь закрыл системный диалог, это не ошибка.
    if (e instanceof Error && e.name !== 'AbortError') {
      appToast.error({ message: t('postCard.shareFailed') })
    }
  } finally {
    emit('done')
  }
}

function openExternal(target: ShareTarget): void {
  const href = target.buildUrl(props.url, props.text)
  window.open(href, '_blank', 'noopener,noreferrer')
  emit('done')
}
</script>
