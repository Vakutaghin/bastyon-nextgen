<template>
  <SC_MyVideosWork>
    <SC_MyVideosPage>
      <SC_MyVideosTitle>{{ t('misc.myVideos') }}</SC_MyVideosTitle>

      <SC_MyVideosPlaceholder>
        {{ t('misc.myVideosPlaceholder') }}
      </SC_MyVideosPlaceholder>
    </SC_MyVideosPage>
  </SC_MyVideosWork>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  SC_MyVideosWork,
  SC_MyVideosPage,
  SC_MyVideosTitle,
  SC_MyVideosPlaceholder,
} from './my-videos-page.styled'

const { t } = useI18n()
</script>
