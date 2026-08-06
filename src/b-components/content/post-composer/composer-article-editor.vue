<template>
  <SC_ArticleEditor ref="holderRef" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ArticleContent } from '@/blockchain/core/actions/post-action'
import { fileToBase64, resizeImageBase64 } from '@/helpers/common/resize-image'
import { uploadImage } from '@/services/image-upload-service'

import { normalizeArticleBlocks } from './article-blocks'
import { SC_ArticleEditor } from './composer-article-editor.styled'

const props = defineProps<{ modelValue?: ArticleContent | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: ArticleContent): void }>()

const { t } = useI18n()
// ref навешен на SC_ArticleEditor (styled.div) — Vue кладёт сюда инстанс-обёртку,
// а Editor.js требует НАТИВНЫЙ Element (иначе «holder value must be an Element node»).
// Достаём реальный DOM-узел через $el (как getInputEl/getTextareaEl в других композер-частях).
const holderRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)

function getHolderEl(): HTMLElement | null {
  const r = holderRef.value
  if (!r) return null
  if (r instanceof HTMLElement) return r
  return (r as { $el?: HTMLElement }).$el ?? null
}

// Тип Editor.js не импортируем статически (грузим динамически) — держим инстанс как unknown.
let editor: { save: () => Promise<unknown>; destroy: () => void; isReady?: Promise<void> } | null =
  null

onMounted(async () => {
  const holderEl = getHolderEl()
  if (!holderEl) return

  // Динамический импорт — Editor.js и инструменты только для браузера, вне основного чанка.
  const [{ default: EditorJS }, Header, EditorList, Quote, CodeTool, ImageTool, Delimiter] =
    await Promise.all([
      import('@editorjs/editorjs'),
      import('@editorjs/header'),
      import('@editorjs/list'),
      import('@editorjs/quote'),
      import('@editorjs/code'),
      import('@editorjs/image'),
      import('@editorjs/delimiter'),
    ])

  const emitChange = async (): Promise<void> => {
    if (!editor) return
    const data = await editor.save()
    emit('update:modelValue', normalizeArticleBlocks(data))
  }

  /* eslint-disable @typescript-eslint/no-explicit-any -- инструменты Editor.js без точных типов */
  editor = new (EditorJS as any)({
    holder: holderEl,
    minHeight: 200,
    placeholder: t('postComposer.articlePlaceholder'),
    data: props.modelValue ?? undefined,
    tools: {
      header: { class: (Header as any).default, inlineToolbar: true },
      list: { class: (EditorList as any).default, inlineToolbar: true },
      quote: { class: (Quote as any).default, inlineToolbar: true },
      code: { class: (CodeTool as any).default },
      delimiter: { class: (Delimiter as any).default },
      image: {
        class: (ImageTool as any).default,
        config: {
          uploader: {
            // base64 → resize → загрузка нашим сервисом (peertube-first) → { file: { url } }
            uploadByFile: async (file: File) => {
              const base64 = await fileToBase64(file)
              const resized = await resizeImageBase64(base64)
              const url = await uploadImage(resized)
              return { success: 1, file: { url } }
            },
            uploadByUrl: async (url: string) => ({ success: 1, file: { url } }),
          },
        },
      },
    },
    onChange: () => {
      void emitChange()
    },
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */
})

onBeforeUnmount(() => {
  if (editor && typeof editor.destroy === 'function') {
    editor.destroy()
  }
  editor = null
})
</script>
