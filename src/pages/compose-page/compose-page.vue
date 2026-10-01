<template>
  <SC_ComposePage>
    <SC_ComposeCard>
      <SC_ComposeTitle>{{ t('postComposer.title') }}</SC_ComposeTitle>
      <PostComposer :video="prefillVideo" @published="onPublished" />
    </SC_ComposeCard>
  </SC_ComposePage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PostComposer from '@/b-components/content/post-composer/post-composer.vue'
import { useModalStore } from '@/stores'

import { SC_ComposeCard, SC_ComposePage, SC_ComposeTitle } from './compose-page.styled'

const { t } = useI18n()
const router = useRouter()

// На телефоне «Создать пост» из «Моих видео» ведёт сюда: видео забираем один раз.
const modalStore = useModalStore()
const prefillVideo = modalStore.postComposerModal.video
modalStore.postComposerModal.video = null

const onPublished = (): void => {
  void router.push({ name: 'home' })
}
</script>
