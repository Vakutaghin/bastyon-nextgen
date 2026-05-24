<template>
  <SC_PostContent ref="contentRoot" @click="handleContentClick">
    <BlockContent
      v-if="isBlockContent && (showFull || !isCollapsed || !shouldCollapse)"
      :content="post.content"
    />

    <div
      v-else-if="post.preview && isCollapsed && shouldCollapse"
      style="margin-bottom: 10px;"
      v-html="formattedPreview"
    />

    <SC_PostPreview
      v-else-if="isBlockContent && post.type === 'article' && isCollapsed && shouldCollapse"
      v-html="formattedTruncatedText"
    />

    <BlockContent
      v-else-if="isBlockContent"
      :content="truncatedBlockContent"
    />

    <div
      v-else-if="showFull || !isCollapsed || !shouldCollapse"
      v-html="formattedPlainText"
    />

    <SC_PostPreview v-else v-html="formattedTruncatedText" />

    <Button
      v-if="!showFull && shouldCollapse && isCollapsed"
      type="text"
      block
      @click.stop.prevent="openPostModal"
      style="margin-top: 10px; background-color: #eee;"
    >
      <strong>{{ readMoreLabel }}</strong>
    </Button>
  </SC_PostContent>
</template>

<script>
import { postCardContentOptions } from './post-card-content.ts'

export default postCardContentOptions
</script>
