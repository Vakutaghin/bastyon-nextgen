<template>
  <SC_ShareMenu>
    <SC_ShareItem type="button" @click="copyLink">
      <SC_ShareIcon><CopyOutlined /></SC_ShareIcon>
      {{ t('postCard.copyLink') }}
    </SC_ShareItem>

    <SC_ShareItem v-if="embedCode" type="button" @click="copyEmbed">
      <SC_ShareIcon><CodeOutlined /></SC_ShareIcon>
      {{ t('postCard.copyEmbed') }}
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
      @click="openShareTarget(target)"
    >
      <SC_ShareIcon :color="target.color">
        <component :is="target.icon" />
      </SC_ShareIcon>
      {{ target.label }}
    </SC_ShareItem>

    <template v-if="canChainInfo">
      <SC_ShareDivider />
      <SC_ShareItem type="button" @click="onChainInfo">
        <SC_ShareIcon><BlockOutlined /></SC_ShareIcon>
        {{ t('chainInfo.action') }}
      </SC_ShareItem>
    </template>

    <SC_ShareDivider v-if="canReport || canBlock" />
    <SC_ShareItem v-if="canReport" type="button" class="share-item--danger" @click="onReport">
      <SC_ShareIcon><FlagOutlined /></SC_ShareIcon>
      {{ t('report.action') }}
    </SC_ShareItem>
    <SC_ShareItem
      v-if="canBlock"
      type="button"
      :class="{ 'share-item--danger': !isBlocked }"
      data-testid="post-block-author"
      @click="onBlock"
    >
      <SC_ShareIcon><StopOutlined /></SC_ShareIcon>
      {{ isBlocked ? t('postCard.unblockAuthor') : t('postCard.blockAuthor') }}
    </SC_ShareItem>
  </SC_ShareMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { openExternal } from '@/helpers/common/open-external'
import { useI18n } from 'vue-i18n'
import {
  BlockOutlined,
  CodeOutlined,
  CopyOutlined,
  ShareAltOutlined,
  FlagOutlined,
  StopOutlined,
} from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { SHARE_TARGETS, type ShareTarget } from '@/helpers/common/share-targets'
import { SC_ShareMenu, SC_ShareItem, SC_ShareIcon, SC_ShareDivider } from './styled'

const props = defineProps<{
  url: string
  text: string
  canReport?: boolean
  /** «Заблокировать автора» — чужой пост, человек вошёл (как в меню поста старого клиента). */
  canBlock?: boolean
  /** Автор уже заблокирован: пункт снимает блокировку. */
  isBlocked?: boolean
  /** Пункт «В блокчейне» — у опубликованного поста с txid. */
  canChainInfo?: boolean
  /** Код вставки на сайт (share-origin publicEmbedCode); нет — пункта нет. */
  embedCode?: string
}>()
const emit = defineEmits<{
  (e: 'done'): void
  (e: 'report'): void
  (e: 'block'): void
  /** «В блокчейне»: что записано о посте. */
  (e: 'chainInfo'): void
}>()

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

async function copyEmbed(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.embedCode ?? '')
    appToast.success({ message: t('postCard.embedCopied') })
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

function openShareTarget(target: ShareTarget): void {
  const href = target.buildUrl(props.url, props.text)
  // Через общий openExternal: в десктопной сборке window.open — no-op (V40).
  void openExternal(href)
  emit('done')
}

function onChainInfo(): void {
  emit('chainInfo')
  emit('done')
}

function onReport(): void {
  emit('report')
  emit('done')
}

function onBlock(): void {
  emit('block')
  emit('done')
}
</script>
