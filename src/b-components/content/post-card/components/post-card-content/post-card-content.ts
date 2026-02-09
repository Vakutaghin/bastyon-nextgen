import { defineComponent, type PropType } from 'vue'
import Button from '@/components/button/button.vue'
import BlockContent from '@/b-components/content/block-content/block-content.vue'
import { useModalStore } from '@/stores/modal-store'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { editorjsToHtml } from '@/helpers/content/editorjs-parser'
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
    isCollapsed: { type: Boolean, default: true }
  },
  setup() {
    const modalStore = useModalStore()
    return { modalStore }
  },
  computed: {
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
    }
  }
})
