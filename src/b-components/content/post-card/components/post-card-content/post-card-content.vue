<!-- SC_*-обёртки — это styled.div/span, поэтому v-html на них безопасен. -->
<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
  <SC_PostContent ref="contentRoot" @click="handleContentClick">
    <BlockContent
      v-if="isBlockContent && (showFull || !isCollapsed || !shouldCollapse)"
      :content="post.content"
    />

    <div
      v-else-if="post.preview && isCollapsed && shouldCollapse"
      style="margin-bottom: 10px"
      v-html="formattedPreview"
    />

    <SC_PostPreview
      v-else-if="isBlockContent && post.type === 'article' && isCollapsed && shouldCollapse"
      v-html="formattedTruncatedText"
    />

    <BlockContent v-else-if="isBlockContent" :content="truncatedBlockContent" />

    <div v-else-if="showFull || !isCollapsed || !shouldCollapse" v-html="formattedPlainText" />

    <SC_PostPreview v-else v-html="formattedTruncatedText" />

    <Button
      v-if="!showFull && shouldCollapse && isCollapsed"
      type="text"
      block
      style="margin-top: 10px; background-color: var(--color-bg-hover)"
      @click.stop.prevent="openPostModal"
    >
      <strong>{{ readMoreLabel }}</strong>
    </Button>
  </SC_PostContent>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUpdated, ref, watch } from 'vue'
import Button from '@/components/button/button.vue'
import BlockContent from '@/b-components/content/block-content/block-content.vue'
import { useModalStore } from '@/stores/modal-store'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { editorjsToHtml } from '@/helpers/content/editorjs-parser'
import {
  TIMECODE_REGEX,
  timecodeMatchToSeconds,
  type Chapter,
} from '@/helpers/content/timecode-parser'
import { SC_PostContent, SC_PostPreview } from './styled'

export interface PostContentPost {
  id?: string | number
  content?: string
  type?: string
  preview?: string
}

const props = withDefaults(
  defineProps<{
    post: PostContentPost
    maxLength?: number
    maxBlocks?: number
    showFull?: boolean
    isCollapsed?: boolean
    chapters?: Chapter[]
  }>(),
  {
    maxLength: 500,
    maxBlocks: 3,
    showFull: false,
    isCollapsed: true,
    chapters: () => [],
  }
)

const emit = defineEmits<{
  'seek-timecode': [seconds: number]
}>()

const modalStore = useModalStore()
const contentRoot = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)

const hasChapters = computed<boolean>(
  () => Array.isArray(props.chapters) && props.chapters.length > 0
)

const isBlockContent = computed<boolean>(() => {
  if (!props.post.content) return false
  try {
    const parsed =
      typeof props.post.content === 'string' ? JSON.parse(props.post.content) : props.post.content
    return !!(
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.blocks) &&
      parsed.blocks.length > 0
    )
  } catch {
    return false
  }
})

const shouldCollapse = computed<boolean>(() => {
  if (props.showFull || !props.post.content) return false
  if (isBlockContent.value) {
    try {
      const parsed =
        typeof props.post.content === 'string' ? JSON.parse(props.post.content) : props.post.content
      return !!(parsed.blocks && parsed.blocks.length > props.maxBlocks)
    } catch {
      return false
    }
  }
  return String(props.post.content).length > props.maxLength
})

const truncatedBlockContent = computed<string | null>(() => {
  if (!isBlockContent.value) return null
  try {
    const parsed =
      typeof props.post.content === 'string' ? JSON.parse(props.post.content) : props.post.content
    if (!parsed.blocks || parsed.blocks.length <= props.maxBlocks) {
      return props.post.content || null
    }
    const truncated = { ...parsed, blocks: parsed.blocks.slice(0, props.maxBlocks) }
    return JSON.stringify(truncated)
  } catch {
    return props.post.content || null
  }
})

const formattedPlainText = computed<string>(() => editorjsToHtml(props.post.content || ''))

const formattedPreview = computed<string>(() => {
  const preview = props.post.preview
  if (!preview) return ''
  const MAX_PREVIEW_LENGTH = 300
  const html = editorjsToHtml(preview)
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  let textContent = tempDiv.textContent || tempDiv.innerText || ''
  if (textContent.length > MAX_PREVIEW_LENGTH) {
    textContent = textContent.substring(0, MAX_PREVIEW_LENGTH) + '...'
    return editorjsToHtml(textContent)
  }
  return html
})

const formattedTruncatedText = computed<string>(() => {
  if (!props.post.content) return ''
  const MAX_PREVIEW_LENGTH = 300
  if (props.post.type === 'article') {
    let html = ''
    try {
      const parsed =
        typeof props.post.content === 'string' ? JSON.parse(props.post.content) : props.post.content
      if (parsed?.blocks && Array.isArray(parsed.blocks)) {
        const sliced = { ...parsed, blocks: parsed.blocks.slice(0, props.maxBlocks) }
        html = editorjsToHtml(sliced)
      }
    } catch {
      // ignore
    }
    if (!html) html = editorjsToHtml(props.post.content)
    if (html.trim().startsWith('<')) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = html
      let textContent = tempDiv.textContent || tempDiv.innerText || ''
      if (textContent.length > MAX_PREVIEW_LENGTH) {
        textContent = textContent.substring(0, MAX_PREVIEW_LENGTH) + '...'
        return editorjsToHtml(textContent)
      }
      return html
    }
  }
  let text = String(props.post.content)
  if (text.length > props.maxLength) {
    text = text.substring(0, props.maxLength) + '...'
  }
  text = text.replace(/<br\s*\/?>/gi, '\n')
  const lines = text.split('\n').filter((line) => line.trim() !== '')
  if (lines.length === 0) return ''
  return lines.map((line) => `<p>${formatBastyonLinks(line)}</p>`).join('')
})

const readMoreLabel = computed<string>(() =>
  props.post.type === 'article' ? 'Читать статью' : 'Показать полностью'
)

function openPostModal(event?: Event): void {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    const eventWithCancel = event as Event & { cancelBubble?: boolean }
    if (eventWithCancel.cancelBubble !== undefined) {
      eventWithCancel.cancelBubble = true
    }
  }
  modalStore.openPostModal(props.post)
}

/** Делегированный клик: ловим `.timecode-link` и эмитим seek. */
function handleContentClick(event: MouseEvent): void {
  if (!hasChapters.value) return
  const target = event.target as HTMLElement | null
  if (!target) return
  const link = target.closest('a.timecode-link') as HTMLAnchorElement | null
  if (!link) return
  const secondsAttr = link.getAttribute('data-seconds')
  const seconds = secondsAttr ? Number(secondsAttr) : NaN
  if (!Number.isFinite(seconds)) return
  event.preventDefault()
  event.stopPropagation()
  emit('seek-timecode', seconds)
}

function transformTextNode(textNode: Text, knownSeconds: Set<number>): void {
  const text = textNode.nodeValue || ''
  TIMECODE_REGEX.lastIndex = 0

  type Part = { type: 'text'; value: string } | { type: 'tc'; value: string; seconds: number }
  const parts: Part[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let foundAny = false

  while ((match = TIMECODE_REGEX.exec(text)) !== null) {
    const seconds = timecodeMatchToSeconds(match)
    if (seconds === null || !knownSeconds.has(seconds)) continue

    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'tc', value: match[0], seconds })
    lastIndex = match.index + match[0].length
    foundAny = true
  }

  if (!foundAny) return

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  const frag = document.createDocumentFragment()
  for (const part of parts) {
    if (part.type === 'text') {
      frag.appendChild(document.createTextNode(part.value))
    } else {
      const a = document.createElement('a')
      a.className = 'timecode-link'
      a.href = '#'
      a.setAttribute('data-seconds', String(part.seconds))
      a.textContent = part.value
      frag.appendChild(a)
    }
  }
  textNode.parentNode?.replaceChild(frag, textNode)
}

/**
 * После рендера HTML обходим текстовые ноды внутри контента и заменяем
 * тайм-коды на `<a class="timecode-link" data-seconds="N">`. Заменяем только
 * совпадения с границами известных глав (start всех `chapters`).
 */
function injectTimecodeLinks(): void {
  if (!hasChapters.value) return
  const root = contentRoot.value
  const el = root && ('$el' in root ? root.$el : root)
  if (!el) return

  const knownSeconds = new Set<number>(props.chapters.map((c) => c.start))

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (node: Node) => {
      const parent = (node as Text).parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      // Уже внутри ссылки — не оборачиваем дважды.
      if (parent.closest('a')) return NodeFilter.FILTER_REJECT
      // Уже преобразовано.
      if (parent.classList && parent.classList.contains('timecode-link')) {
        return NodeFilter.FILTER_REJECT
      }
      const text = node.nodeValue || ''
      // Префильтр — без двоеточия в тексте тайм-кода быть не может.
      if (!text.includes(':')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const targets: Text[] = []
  let n: Node | null = walker.nextNode()
  while (n) {
    targets.push(n as Text)
    n = walker.nextNode()
  }

  for (const textNode of targets) {
    transformTextNode(textNode, knownSeconds)
  }
}

watch(
  () => props.post.content,
  () => {
    nextTick(injectTimecodeLinks)
  }
)

watch(
  () => props.isCollapsed,
  () => {
    nextTick(injectTimecodeLinks)
  }
)

watch(
  () => props.showFull,
  () => {
    nextTick(injectTimecodeLinks)
  }
)

watch(
  () => props.chapters,
  () => {
    nextTick(injectTimecodeLinks)
  },
  { deep: true }
)

onMounted(() => {
  nextTick(injectTimecodeLinks)
})

onUpdated(injectTimecodeLinks)
</script>
