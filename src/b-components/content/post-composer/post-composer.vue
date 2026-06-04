<template>
  <SC_Composer>
    <ComposerRepost v-if="isRepost && repostSource" :source="repostSource" />

    <SC_ArticleToggle v-if="!isRepost && !isEdit">
      <input type="checkbox" :checked="articleMode" @change="onToggleArticle" />
      {{ t('postComposer.articleToggle') }}
    </SC_ArticleToggle>

    <!-- Заголовок статьи / видео (peertube-видео требует caption) -->
    <SC_TitleInput
      v-if="articleMode || needsCaption"
      :value="caption"
      :placeholder="titlePlaceholder"
      :aria-label="titlePlaceholder"
      @input="onCaptionInput(($event.target as HTMLInputElement).value)"
    />

    <!-- Тело статьи (Editor.js) -->
    <ComposerArticleEditor
      v-if="articleMode"
      :model-value="articleContent"
      @update:model-value="onArticleChange"
    />

    <!-- Тело обычного поста -->
    <SC_Textarea
      v-if="!articleMode"
      :value="message"
      :placeholder="isRepost ? t('postComposer.repostPlaceholder') : t('postComposer.placeholder')"
      :aria-label="t('postComposer.placeholder')"
      @input="onMessageInput(($event.target as HTMLTextAreaElement).value)"
    />

    <!-- Превью видео по ссылке (youtube/vimeo/peertube), найденной в тексте -->
    <ComposerUrlPreview v-if="!articleMode && parsedVideo.kind" :parsed="parsedVideo" />

    <ComposerImages
      v-if="!isRepost && !articleMode"
      :images="images"
      :full="imagesFull"
      @add="addImageFiles"
      @remove="removeImage"
    />

    <ComposerTags
      v-if="!isRepost"
      :tags="tags"
      :full="tagsFull"
      :input-value="tagInput"
      @update:input-value="tagInput = $event"
      @add="addTag"
      @remove="removeTag"
      @backspace="onTagBackspace"
    />

    <ComposerPoll
      v-if="!isRepost && !articleMode"
      :active="pollActive"
      :title="pollTitle"
      :options="pollOptions"
      @toggle="togglePoll"
      @update:title="setPollTitle"
      @update-option="setPollOption"
      @add-option="addPollOption"
      @remove-option="removePollOption"
    />

    <ComposerSettings
      :visibility="visibility"
      :language="language"
      :is-trial="isTrial"
      :scheduled-time="scheduledTime"
      @update:visibility="visibility = $event"
      @update:language="language = $event"
      @update:scheduled-time="setScheduledTime"
    />

    <SC_Footer>
      <SC_Hint :danger="showError">
        {{ hintText }}
      </SC_Hint>
      <Button type="primary" :loading="submitting" :disabled="!canPublish" @click="publish">
        {{ publishLabel }}
      </Button>
    </SC_Footer>
  </SC_Composer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/button'

import ComposerArticleEditor from './composer-article-editor.vue'
import ComposerImages from './composer-images.vue'
import ComposerPoll from './composer-poll.vue'
import ComposerRepost from './composer-repost.vue'
import ComposerSettings from './composer-settings.vue'
import ComposerTags from './composer-tags.vue'
import ComposerUrlPreview from './composer-url-preview.vue'
import type { ComposerMode, ComposerSource } from './composer-source'
import {
  SC_ArticleToggle,
  SC_Composer,
  SC_Footer,
  SC_Hint,
  SC_Textarea,
  SC_TitleInput,
} from './post-composer.styled'
import { MAX_TAGS } from './consts'
import { usePostComposer } from './use-post-composer'

const props = defineProps<{ mode?: ComposerMode; source?: ComposerSource | null }>()
const emit = defineEmits<{ (e: 'published', txid: string): void }>()

const { t } = useI18n()

const {
  isEdit,
  isRepost,
  repostSource,
  publishLabel,
  message,
  caption,
  tags,
  tagInput,
  submitting,
  images,
  imagesFull,
  visibility,
  language,
  isTrial,
  articleMode,
  articleContent,
  parsedVideo,
  needsCaption,
  pollActive,
  pollTitle,
  pollOptions,
  scheduledTime,
  validationError,
  canPublish,
  tagsFull,
  onMessageInput,
  onCaptionInput,
  onArticleChange,
  togglePoll,
  setPollTitle,
  setPollOption,
  addPollOption,
  removePollOption,
  setScheduledTime,
  addTag,
  removeTag,
  onTagBackspace,
  addImageFiles,
  removeImage,
  publish,
} = usePostComposer({
  onPublished: (txid) => emit('published', txid),
  mode: props.mode,
  source: props.source,
})

const onToggleArticle = (e: Event): void => {
  articleMode.value = (e.target as HTMLInputElement).checked
}

const titlePlaceholder = computed(() =>
  articleMode.value
    ? t('postComposer.articleTitlePlaceholder')
    : t('postComposer.videoTitlePlaceholder')
)

// Подсказка: при ошибке валидации (когда уже что-то введено) — показать её; иначе счётчик тегов.
const hasContent = computed(
  () => message.value.trim().length > 0 || (articleMode.value && !!articleContent.value)
)
const showError = computed(() => validationError.value !== null && hasContent.value)
const hintText = computed(() => {
  if (showError.value) return t(`postMsg.validation.${validationError.value}`)
  if (isRepost) return ''
  return t('postComposer.tagsCount', { count: tags.value.length, max: MAX_TAGS })
})
</script>
