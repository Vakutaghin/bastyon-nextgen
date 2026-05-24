import { defineComponent, type PropType } from 'vue'
import Button from '@/components/button/button.vue'
import BlockContent from '@/b-components/content/block-content/block-content.vue'
import { useModalStore } from '@/stores/modal-store'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { editorjsToHtml } from '@/helpers/content/editorjs-parser'
import {
  TIMECODE_REGEX,
  timecodeMatchToSeconds,
  type Chapter
} from '@/helpers/content/timecode-parser'
import { SC_PostContent, SC_PostPreview } from './styled'

export interface PostContentPost {
  id?: string | number
  content?: string
  type?: string
  preview?: string
}

export const postCardContentOptions = defineComponent({
  name: 'PostCardContent',
  components: {
    Button,
    BlockContent,
    SC_PostContent,
    SC_PostPreview
  },
  props: {
    post: {
      type: Object as PropType<PostContentPost>,
      required: true
    },
    maxLength: { type: Number, default: 500 },
    maxBlocks: { type: Number, default: 3 },
    showFull: { type: Boolean, default: false },
    isCollapsed: { type: Boolean, default: true },
    chapters: {
      type: Array as PropType<Chapter[]>,
      default: () => []
    }
  },
  emits: {
    'seek-timecode': (_seconds: number) => true
  },
  setup() {
    const modalStore = useModalStore()
    return { modalStore }
  },
  computed: {
    hasChapters(): boolean {
      return Array.isArray(this.chapters) && this.chapters.length > 0
    },
    isBlockContent(): boolean {
      if (!this.post.content) return false
      try {
        const parsed = typeof this.post.content === 'string'
          ? JSON.parse(this.post.content)
          : this.post.content
        return !!(
          parsed &&
          typeof parsed === 'object' &&
          Array.isArray(parsed.blocks) &&
          parsed.blocks.length > 0
        )
      } catch {
        return false
      }
    },
    shouldCollapse(): boolean {
      if (this.showFull || !this.post.content) return false
      if (this.isBlockContent) {
        try {
          const parsed = typeof this.post.content === 'string'
            ? JSON.parse(this.post.content)
            : this.post.content
          return !!(parsed.blocks && parsed.blocks.length > this.maxBlocks)
        } catch {
          return false
        }
      }
      return String(this.post.content).length > this.maxLength
    },
    truncatedBlockContent(): string | null {
      if (!this.isBlockContent) return null
      try {
        const parsed = typeof this.post.content === 'string'
          ? JSON.parse(this.post.content)
          : this.post.content
        if (!parsed.blocks || parsed.blocks.length <= this.maxBlocks) {
          return this.post.content || null
        }
        const truncated = { ...parsed, blocks: parsed.blocks.slice(0, this.maxBlocks) }
        return JSON.stringify(truncated)
      } catch {
        return this.post.content || null
      }
    },
    formattedPlainText(): string {
      return editorjsToHtml(this.post.content || '')
    },
    formattedPreview(): string {
      const preview = this.post.preview
      if (!preview) return ''
      const MAX_PREVIEW_LENGTH = 300
      const trimmed = preview.trim()
      let html = ''
      if (trimmed.startsWith('{"blocks":')) {
        try {
          JSON.parse(preview)
          html = editorjsToHtml(preview)
        } catch {
          html = editorjsToHtml(preview)
        }
      } else {
        html = editorjsToHtml(preview)
      }
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = html
      let textContent = tempDiv.textContent || tempDiv.innerText || ''
      if (textContent.length > MAX_PREVIEW_LENGTH) {
        textContent = textContent.substring(0, MAX_PREVIEW_LENGTH) + '...'
        return editorjsToHtml(textContent)
      }
      return html
    },
    formattedTruncatedText(): string {
      if (!this.post.content) return ''
      const MAX_PREVIEW_LENGTH = 300
      if (this.post.type === 'article') {
        let html = ''
        try {
          const parsed = typeof this.post.content === 'string'
            ? JSON.parse(this.post.content)
            : this.post.content
          if (parsed?.blocks && Array.isArray(parsed.blocks)) {
            const sliced = { ...parsed, blocks: parsed.blocks.slice(0, this.maxBlocks) }
            html = editorjsToHtml(sliced)
          }
        } catch {
          // ignore
        }
        if (!html) html = editorjsToHtml(this.post.content)
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
      let text = String(this.post.content)
      if (text.length > this.maxLength) {
        text = text.substring(0, this.maxLength) + '...'
      }
      text = text.replace(/<br\s*\/?>/gi, '\n')
      const lines = text.split('\n').filter((line) => line.trim() !== '')
      if (lines.length === 0) return ''
      return lines.map((line) => `<p>${formatBastyonLinks(line)}</p>`).join('')
    },
    readMoreLabel(): string {
      return this.post.type === 'article' ? 'Читать статью' : 'Показать полностью'
    }
  },
  watch: {
    'post.content'() {
      this.$nextTick(() => this.injectTimecodeLinks())
    },
    isCollapsed() {
      this.$nextTick(() => this.injectTimecodeLinks())
    },
    showFull() {
      this.$nextTick(() => this.injectTimecodeLinks())
    },
    chapters: {
      handler() {
        this.$nextTick(() => this.injectTimecodeLinks())
      },
      deep: true
    }
  },
  mounted() {
    this.$nextTick(() => this.injectTimecodeLinks())
  },
  updated() {
    this.injectTimecodeLinks()
  },
  methods: {
    openPostModal(event?: Event) {
      if (event) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        if ((event as Event & { cancelBubble?: boolean }).cancelBubble !== undefined) {
          (event as Event & { cancelBubble?: boolean }).cancelBubble = true
        }
      }
      this.modalStore.openPostModal(this.post)
    },
    /**
     * Делегированный клик: ловим клик по `.timecode-link` и эмитим seek.
     */
    handleContentClick(event: MouseEvent) {
      if (!this.hasChapters) return
      const target = event.target as HTMLElement | null
      if (!target) return
      const link = target.closest('a.timecode-link') as HTMLAnchorElement | null
      if (!link) return
      const secondsAttr = link.getAttribute('data-seconds')
      const seconds = secondsAttr ? Number(secondsAttr) : NaN
      if (!Number.isFinite(seconds)) return
      event.preventDefault()
      event.stopPropagation()
      this.$emit('seek-timecode', seconds)
    },
    /**
     * После рендера HTML обходим текстовые ноды внутри контента и
     * заменяем тайм-коды на `<a class="timecode-link" data-seconds="N">`.
     * Заменяем только те, что совпадают с известными главами (start всех глав).
     */
    injectTimecodeLinks() {
      if (!this.hasChapters) return
      const root = this.$refs.contentRoot as { $el?: HTMLElement } | HTMLElement | undefined
      const el = root && ('$el' in root ? root.$el : root)
      if (!el) return

      const knownSeconds = new Set<number>(this.chapters.map((c) => c.start))

      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (node: Node) => {
          const parent = (node as Text).parentElement
          if (!parent) return NodeFilter.FILTER_REJECT
          // Уже внутри ссылки — пропускаем (не оборачиваем дважды).
          if (parent.closest('a')) return NodeFilter.FILTER_REJECT
          // Уже преобразовано.
          if (parent.classList && parent.classList.contains('timecode-link')) {
            return NodeFilter.FILTER_REJECT
          }
          const text = node.nodeValue || ''
          // Быстрый префильтр — без двоеточия в тексте обрабатывать нечего.
          if (!text.includes(':')) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_ACCEPT
        }
      })

      const targets: Text[] = []
      let n: Node | null = walker.nextNode()
      while (n) {
        targets.push(n as Text)
        n = walker.nextNode()
      }

      for (const textNode of targets) {
        this.transformTextNode(textNode, knownSeconds)
      }
    },
    transformTextNode(textNode: Text, knownSeconds: Set<number>) {
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
  }
})
