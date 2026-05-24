<template>
  <SC_ShareBtn type='button' :title='hoverTitle' @click='share'>
    <ShareAltOutlined :style="{ fontSize: '13px' }" />
    {{ label }}
  </SC_ShareBtn>
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import { ShareAltOutlined } from '@ant-design/icons-vue'
import { appToast } from '@/b-components/app-toast'
import { SC_ShareBtn } from './share-button.styled'

const p = withDefaults(
  defineProps<{
    /** Заголовок sharing-диалога (title в Web Share API). */
    title: string
    /** Что показать на кнопке. По умолчанию «Поделиться». */
    label?: string
    /**
     * Конкретный URL для шеринга. Если не задан — берём window.location.href
     * (это работает для permalinks эксплорера, у которых URL = permalink).
     */
    url?: string
  }>(),
  {
    label: 'Поделиться',
  },
)

const hoverTitle = computed(() => p.title)

async function share() {
  const targetUrl = p.url ?? (typeof window !== 'undefined' ? window.location.href : '')
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
    appToast.success({ message: 'Ссылка скопирована', description: targetUrl })
  } catch {
    appToast.error({ message: 'Не удалось поделиться', description: 'Скопируйте URL из адресной строки' })
  }
}
</script>
