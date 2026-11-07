<template>
  <SC_ComposePage>
    <SC_ComposeCard>
      <SC_ComposeTitle>{{ t('postComposer.title') }}</SC_ComposeTitle>
      <PostComposer :video="prefillVideo" :share="prefillShare" @published="onPublished" />
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

// На телефоне «Создать пост» из «Моих видео» и «Поделиться в Bastyon» из
// приложения ведут сюда: заготовку забираем один раз.
const modalStore = useModalStore()
const prefillVideo = modalStore.postComposerModal.video
const prefillShare = modalStore.postComposerModal.share
modalStore.postComposerModal.video = null
modalStore.postComposerModal.share = null

const onPublished = (): void => {
  void router.push({ name: 'home' })
}
</script>
