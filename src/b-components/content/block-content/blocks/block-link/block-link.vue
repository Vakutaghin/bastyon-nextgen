<template>
  <SC_BlockLink :href="linkUrl" :target="linkTarget" rel="noopener noreferrer">
    {{ decodedText }}
  </SC_BlockLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SC_BlockLink } from './styled'

interface BlockLinkData {
  url?: string
  href?: string
  text?: string
  link?: string
  target?: string
}

interface BlockLinkBlock {
  type: string
  id: string
  data: BlockLinkData
}

const props = defineProps<{
  block: BlockLinkBlock
  index?: number
}>()

/**
 * Безопасный href для link-блока (P1-3). Контент поста недоверенный — без
 * проверки схемы `javascript:…` исполнялся бы по клику. Allowlist: относительные
 * (внутренние) пути + абсолютные http/https/mailto/bastyon; всё прочее → '#'.
 */
function toSafeHref(raw: string): string {
  const value = raw.trim()
  if (!value || value === '#') return '#'
  // Относительный внутренний путь (но не protocol-relative `//evil.com`).
  if (value.startsWith('/') && !value.startsWith('//')) return value
  return /^(https?:|mailto:|bastyon:)/i.test(value) ? value : '#'
}

const linkUrl = computed<string>(() =>
  toSafeHref(props.block.data.url || props.block.data.href || '#')
)
const linkText = computed<string>(
  () => props.block.data.text || props.block.data.link || linkUrl.value
)
const decodedText = computed<string>(() => {
  try {
    return decodeURIComponent(String(linkText.value))
  } catch {
    return String(linkText.value)
  }
})
const linkTarget = computed<string>(() => props.block.data.target || '_blank')
</script>
