<template>
  <NodeViewWrapper>
    <!-- Блок из прежней версии, которого редактор не знает: уйдёт в статью как был. -->
    <SC_ArticleRawBlock :class="{ selected }" contenteditable="false">{{
      label
    }}</SC_ArticleRawBlock>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

import { SC_ArticleRawBlock } from './composer-article-editor.styled'

const props = defineProps(nodeViewProps)

const { t } = useI18n()

/** Тип блока Editor.js из сохранённого JSON; битый JSON — пусто. */
function blockType(raw: unknown): string {
  try {
    return String((JSON.parse(String(raw)) as { type?: unknown }).type ?? '')
  } catch {
    return ''
  }
}

const label = computed<string>(() => {
  const type = blockType(props.node.attrs.block)
  return type === 'table' ? t('articleEditor.rawTable') : t('articleEditor.rawBlock', { type })
})
</script>
