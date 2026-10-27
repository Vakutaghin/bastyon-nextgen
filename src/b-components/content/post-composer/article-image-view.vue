<template>
  <NodeViewWrapper>
    <!-- Картинка статьи: подпись правится прямо под ней, × убирает картинку. -->
    <SC_ArticleFigure :class="{ selected }" contenteditable="false" data-drag-handle>
      <img :src="node.attrs.src" :alt="node.attrs.caption" draggable="false" />
      <SC_ArticleCaption
        :value="node.attrs.caption"
        :placeholder="t('articleEditor.imageCaption')"
        :aria-label="t('articleEditor.imageCaption')"
        :readonly="!editor.isEditable"
        @input="updateAttributes({ caption: ($event.target as HTMLInputElement).value })"
      />
      <SC_ArticleFigureRemove
        v-if="editor.isEditable"
        type="button"
        :aria-label="t('articleEditor.removeImage')"
        @click="deleteNode()"
      >
        <CloseOutlined />
      </SC_ArticleFigureRemove>
    </SC_ArticleFigure>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

import { CloseOutlined } from '@/components/icons'
import {
  SC_ArticleCaption,
  SC_ArticleFigure,
  SC_ArticleFigureRemove,
} from './composer-article-editor.styled'

defineProps(nodeViewProps)

const { t } = useI18n()
</script>
