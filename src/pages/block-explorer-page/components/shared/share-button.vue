<template>
  <SC_ShareBtn type="button" :title="hoverTitle" @click="share">
    <ShareAltOutlined :style="ICON_SIZE_13" />
    {{ labelText }}
  </SC_ShareBtn>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ShareAltOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { SC_ShareBtn } from './share-button.styled'
import { ICON_SIZE_13 } from '@/styles/icon-styles'

const p = defineProps<{
  /** Заголовок sharing-диалога (title в Web Share API). */
  title: string
  /** Что показать на кнопке. По умолчанию «Поделиться». */
  label?: string
  /**
   * Публичная ссылка (publicExplorerUrl). Адрес страницы для этого не годится:
   * в приложении для компьютера и на телефоне он `tauri://localhost/…` или
   * `https://localhost/…`, и у получателя такая ссылка не открывалась.
   */
  url: string
}>()

const { t } = useI18n()

const labelText = computed(() => p.label ?? t('explorerShared.share'))
const hoverTitle = computed(() => p.title)

async function share() {
  const targetUrl = p.url
  if (!targetUrl) return

  // 1. Web Share API (mobile / поддерживаемые браузеры).
  const nav = window.navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>
  }
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: p.title, url: targetUrl })
      return
    } catch (e) {
      // AbortError — пользователь закрыл диалог. NotAllowedError — браузер не разрешил.
      // В обоих случаях падаем в copy-fallback.
      const name = e instanceof Error ? e.name : ''
      if (name === 'AbortError') return // отмена — это не ошибка
    }
  }

  // 2. Fallback — clipboard.
  try {
    await window.navigator.clipboard.writeText(targetUrl)
    appToast.success({ message: t('explorerShared.linkCopied'), description: targetUrl })
  } catch {
    // Адресной строки в приложении для компьютера нет — показываем саму ссылку.
    appToast.error({ message: t('explorerShared.shareFailed'), description: targetUrl })
  }
}
</script>
