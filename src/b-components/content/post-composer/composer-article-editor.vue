<template>
  <SC_ArticleEditor :class="{ disabled }">
    <!-- Редактор статьи, как у Medium: без рамок и панелей. Выделили текст —
         панель над ним; на пустой строке «+» или «/» — заголовок, список, цитата,
         код, разделитель, картинка. Markdown по ходу: «## », «- », «1. », «> »,
         «```», «---». Картинку можно вставить и перетащить в текст. -->
    <EditorContent :editor="editor" />

    <BubbleMenu
      v-if="editor"
      class="article-menu"
      :editor="editor"
      :should-show="showBubble"
      :options="{ placement: 'top' }"
    >
      <SC_Bubble role="toolbar" :aria-label="t('articleEditor.format')">
        <template v-if="!linkEditing">
          <SC_BubbleButton
            v-for="item in inlineItems"
            :key="item.key"
            type="button"
            :class="{ active: item.active() }"
            :aria-label="t(item.label)"
            :aria-pressed="item.active()"
            :title="t(item.label)"
            @mousedown.prevent
            @click="item.run()"
          >
            <component :is="item.icon" />
          </SC_BubbleButton>
        </template>
        <SC_LinkInput
          v-else
          ref="linkInputRef"
          v-model="linkDraft"
          type="url"
          :placeholder="t('articleEditor.linkPlaceholder')"
          :aria-label="t('articleEditor.link')"
          @keydown.enter.prevent="applyLink"
          @keydown.esc.prevent.stop="cancelLink"
          @blur="applyLink"
        />
      </SC_Bubble>
    </BubbleMenu>

    <FloatingMenu
      v-if="editor"
      class="article-menu"
      :editor="editor"
      :should-show="showFloating"
      :options="{ placement: 'bottom-start' }"
    >
      <SC_BlockMenu>
        <SC_BlockToggle
          type="button"
          :class="{ open: blockListOpen }"
          :aria-label="t('articleEditor.addBlock')"
          :aria-expanded="blockListOpen"
          :title="t('articleEditor.addBlock')"
          @mousedown.prevent
          @click="blockMenuOpen = !blockMenuOpen"
        >
          <PlusOutlined />
        </SC_BlockToggle>
        <SC_BlockList v-if="blockListOpen" role="menu" :aria-label="t('articleEditor.addBlock')">
          <SC_BlockItem
            v-for="(item, index) in blockItems"
            :key="item.key"
            type="button"
            role="menuitem"
            :class="{ active: index === blockIndex }"
            @mousedown.prevent
            @mouseenter="blockIndex = index"
            @click="runBlock(item)"
          >
            <component :is="item.icon" />
            <span>{{ t(item.label) }}</span>
          </SC_BlockItem>
        </SC_BlockList>
      </SC_BlockMenu>
    </FloatingMenu>

    <input
      ref="imageInputRef"
      type="file"
      accept="image/*"
      multiple
      hidden
      :aria-label="t('articleEditor.image')"
      :disabled="disabled"
      @change="onImagesPicked"
    />
    <SC_ArticleStatus v-if="uploading > 0" role="status">
      {{ t('articleEditor.imageUploading') }}
    </SC_ArticleStatus>
  </SC_ArticleEditor>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, toRaw, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { BubbleMenu, FloatingMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { NodeSelection } from '@tiptap/pm/state'
import type { ChainedCommands, Editor } from '@tiptap/core'

import type { ArticleContent } from '@/blockchain/core/actions/post-action'
import { appToast } from '@/b-components/app-toast'
import {
  BoldIcon,
  CodeOutlined,
  DividerIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PictureOutlined,
  PlusOutlined,
  QuoteIcon,
} from '@/components/icons'
import { fileToBase64, resizeImageBase64 } from '@/helpers/common/resize-image'
import { uploadImage } from '@/services/image-upload-service'

import { articleToDoc, docToArticle } from './article-doc'
import { ArticleImage, ArticleRawBlock, QuoteAttributes } from './article-extensions'
import {
  SC_ArticleEditor,
  SC_ArticleStatus,
  SC_BlockItem,
  SC_BlockList,
  SC_BlockMenu,
  SC_BlockToggle,
  SC_Bubble,
  SC_BubbleButton,
  SC_LinkInput,
} from './composer-article-editor.styled'

const props = defineProps<{
  modelValue?: ArticleContent | null
  /** Идёт публикация поста: статья только для чтения. */
  disabled?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: ArticleContent): void
  /** В статью грузится картинка: публиковать рано. */
  (e: 'uploading', active: boolean): void
}>()

const { t } = useI18n()

/** Последнее, что ушло наружу: своё же значение в редактор обратно не кладём. */
let lastEmitted: ArticleContent | null | undefined = props.modelValue
const uploading = ref(0)
const imageInputRef = ref<HTMLInputElement | null>(null)
const linkInputRef = ref<HTMLInputElement | null>(null)
const linkEditing = ref(false)
const linkDraft = ref('')
const blockMenuOpen = ref(false)
/** Абзац из одного «/» — меню блоков открыто само. */
const slashActive = ref(false)
/** «/» закрыли Escape — не открывать снова, пока абзац тот же. */
const slashDismissed = ref(false)
const blockIndex = ref(0)

const editor = useEditor({
  editable: !props.disabled,
  content: articleToDoc(props.modelValue),
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false, autolink: true, linkOnPaste: true },
    }),
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === 'heading'
          ? t('articleEditor.headingPlaceholder')
          : t('postComposer.articlePlaceholder'),
    }),
    ArticleImage,
    ArticleRawBlock,
    QuoteAttributes,
  ],
  editorProps: {
    attributes: { 'aria-label': t('postComposer.articlePlaceholder'), 'aria-multiline': 'true' },
    handleKeyDown: (_view, event) => onEditorKeydown(event),
    handlePaste: (_view, event) => {
      const files = imageFiles(event.clipboardData)
      if (!files.length) return false
      void insertImages(files)
      return true
    },
    handleDrop: (view, event, _slice, moved) => {
      if (moved) return false
      const files = imageFiles(event.dataTransfer)
      if (!files.length) return false
      const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
      void insertImages(files, at)
      return true
    },
  },
  onUpdate: ({ editor: current }) => {
    syncSlash(current)
    const value = docToArticle(current.getJSON())
    lastEmitted = value
    emit('update:modelValue', value)
  },
  onSelectionUpdate: ({ editor: current }) => syncSlash(current),
})

// Черновик приходит уже после открытия окна, «Очистить» сбрасывает статью.
// Своё же значение возвращается через ref окна поста прокси — сравниваем
// исходники, иначе каждое нажатие перезаливало бы документ (и пустая строка
// после Enter пропадала).
watch(
  () => props.modelValue,
  (value) => {
    if (toRaw(value) === toRaw(lastEmitted)) return
    lastEmitted = value
    editor.value?.commands.setContent(articleToDoc(value), { emitUpdate: false })
  }
)

watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(!disabled, false)
    if (disabled) {
      blockMenuOpen.value = false
      linkEditing.value = false
    }
  }
)

watch(
  () => uploading.value > 0,
  (active) => emit('uploading', active)
)

onBeforeUnmount(() => {
  if (uploading.value > 0) emit('uploading', false)
})

// ── Панель над выделением ──────────────────────────────────────────────

interface MenuItem {
  key: string
  icon: Component
  label: string
}

interface InlineItem extends MenuItem {
  active: () => boolean
  run: () => void
}

const chain = (): ChainedCommands => editor.value!.chain().focus()
const isActive = (name: string, attrs?: Record<string, unknown>): boolean =>
  !!editor.value?.isActive(name, attrs)

const inlineItems: InlineItem[] = [
  {
    key: 'bold',
    icon: BoldIcon,
    label: 'articleEditor.bold',
    active: () => isActive('bold'),
    run: () => chain().toggleBold().run(),
  },
  {
    key: 'italic',
    icon: ItalicIcon,
    label: 'articleEditor.italic',
    active: () => isActive('italic'),
    run: () => chain().toggleItalic().run(),
  },
  {
    key: 'link',
    icon: LinkIcon,
    label: 'articleEditor.link',
    active: () => isActive('link'),
    run: () => startLink(),
  },
  {
    key: 'h2',
    icon: Heading2Icon,
    label: 'articleEditor.heading',
    active: () => isActive('heading', { level: 2 }),
    run: () => chain().toggleHeading({ level: 2 }).run(),
  },
  {
    key: 'h3',
    icon: Heading3Icon,
    label: 'articleEditor.subheading',
    active: () => isActive('heading', { level: 3 }),
    run: () => chain().toggleHeading({ level: 3 }).run(),
  },
  {
    key: 'quote',
    icon: QuoteIcon,
    label: 'articleEditor.quote',
    active: () => isActive('blockquote'),
    run: () => chain().toggleBlockquote().run(),
  },
  {
    key: 'code',
    icon: CodeOutlined,
    label: 'articleEditor.inlineCode',
    active: () => isActive('code'),
    run: () => chain().toggleCode().run(),
  },
]

function showBubble({ editor: current, from, to }: { editor: Editor; from: number; to: number }) {
  if (!current.isEditable) return false
  if (linkEditing.value) return true
  if (from === to || !current.view.hasFocus()) return false
  if (current.state.selection instanceof NodeSelection) return false
  return !current.isActive('codeBlock')
}

function startLink(): void {
  linkDraft.value = String(editor.value?.getAttributes('link').href ?? '')
  linkEditing.value = true
  void nextTick(() => linkInputRef.value?.focus())
}

/** Адрес без схемы — https://; свои схемы (bastyon:, mailto:) — как есть. */
function normalizeHref(raw: string): string {
  const href = raw.trim()
  if (!href) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href
  return `https://${href.replace(/^\/+/, '')}`
}

function applyLink(): void {
  if (!linkEditing.value) return
  linkEditing.value = false
  const href = normalizeHref(linkDraft.value)
  const current = chain().extendMarkRange('link')
  if (href) current.setLink({ href }).run()
  else current.unsetLink().run()
}

function cancelLink(): void {
  linkEditing.value = false
  editor.value?.commands.focus()
}

// ── Меню блоков: «+» и «/» на пустой строке ────────────────────────────

interface BlockItem extends MenuItem {
  run: (commands: ChainedCommands) => ChainedCommands | 'image'
}

const blockItems: BlockItem[] = [
  {
    key: 'h2',
    icon: Heading2Icon,
    label: 'articleEditor.heading',
    run: (c) => c.toggleHeading({ level: 2 }),
  },
  {
    key: 'h3',
    icon: Heading3Icon,
    label: 'articleEditor.subheading',
    run: (c) => c.toggleHeading({ level: 3 }),
  },
  {
    key: 'ul',
    icon: ListIcon,
    label: 'articleEditor.bulletList',
    run: (c) => c.toggleBulletList(),
  },
  {
    key: 'ol',
    icon: ListOrderedIcon,
    label: 'articleEditor.orderedList',
    run: (c) => c.toggleOrderedList(),
  },
  { key: 'quote', icon: QuoteIcon, label: 'articleEditor.quote', run: (c) => c.toggleBlockquote() },
  {
    key: 'code',
    icon: CodeOutlined,
    label: 'articleEditor.codeBlock',
    run: (c) => c.toggleCodeBlock(),
  },
  {
    key: 'hr',
    icon: DividerIcon,
    label: 'articleEditor.divider',
    run: (c) => c.setHorizontalRule(),
  },
  { key: 'image', icon: PictureOutlined, label: 'articleEditor.image', run: () => 'image' },
]

const blockListOpen = computed(
  () => blockMenuOpen.value || (slashActive.value && !slashDismissed.value)
)

/** Пустой абзац верхнего уровня (или с одним «/») под курсором. */
function emptyLine(current: Editor): { text: string; from: number; to: number } | null {
  const { selection } = current.state
  if (!selection.empty) return null
  const { $from } = selection
  if ($from.depth !== 1 || $from.parent.type.name !== 'paragraph') return null
  const text = $from.parent.textContent
  if (text !== '' && text !== '/') return null
  return { text, from: $from.start(), to: $from.end() }
}

function showFloating({ editor: current }: { editor: Editor }): boolean {
  return current.isEditable && current.view.hasFocus() && emptyLine(current) !== null
}

function syncSlash(current: Editor): void {
  const line = emptyLine(current)
  const slash = line?.text === '/'
  if (!slash) slashDismissed.value = false
  if (slash && !slashActive.value) blockIndex.value = 0
  slashActive.value = slash
  if (!line) blockMenuOpen.value = false
}

function runBlock(item: BlockItem): void {
  const current = editor.value
  if (!current) return
  const line = emptyLine(current)
  let commands = current.chain().focus()
  if (line?.text === '/') commands = commands.deleteRange({ from: line.from, to: line.to })
  const result = item.run(commands)
  if (result === 'image') {
    commands.run()
    imageInputRef.value?.click()
  } else {
    result.run()
  }
  blockMenuOpen.value = false
  slashActive.value = false
}

/** Стрелки и Enter по открытому меню блоков, Escape — закрыть его. */
function onEditorKeydown(event: KeyboardEvent): boolean {
  if (!blockListOpen.value) return false
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const step = event.key === 'ArrowDown' ? 1 : -1
    blockIndex.value = (blockIndex.value + step + blockItems.length) % blockItems.length
    return true
  }
  if (event.key === 'Enter') {
    runBlock(blockItems[blockIndex.value]!)
    return true
  }
  if (event.key === 'Escape') {
    // Закрываем меню, а не окно поста вокруг.
    event.stopPropagation()
    blockMenuOpen.value = false
    slashDismissed.value = true
    return true
  }
  return false
}

// ── Картинки ───────────────────────────────────────────────────────────

function imageFiles(data: DataTransfer | null | undefined): File[] {
  return Array.from(data?.files ?? []).filter((file) => file.type.startsWith('image/'))
}

function onImagesPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = imageFiles({ files: input.files } as DataTransfer)
  input.value = ''
  if (files.length) void insertImages(files)
}

/** Картинка уходит на сервер и встаёт в статью; `at` — куда её перетащили. */
async function insertImages(files: File[], at?: number): Promise<void> {
  for (const file of files) {
    uploading.value++
    try {
      const url = await uploadImage(await resizeImageBase64(await fileToBase64(file)))
      const current = editor.value
      if (!current || current.isDestroyed) return
      const node = { type: 'articleImage', attrs: { src: url } }
      const commands = current.chain().focus()
      if (at === undefined) commands.insertContent(node).run()
      else commands.insertContentAt(at, node).run()
    } catch (e) {
      appToast.error({
        message: t('articleEditor.imageFailed'),
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      uploading.value--
    }
  }
}
</script>
