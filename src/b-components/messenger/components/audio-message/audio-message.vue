<template>
  <SC_AudioMessage>
    <SC_PlayButton v-if="isLoadingWave || isBlocked" :disabled="true">
      <SC_Spinner />
    </SC_PlayButton>
    <SC_PlayButton v-else :class="{ playing: isPlaying }" @click="togglePlay" :disabled="!!hasError">
      <img v-if="!isPlaying" :src="playIcon" alt="" width="20" height="20" />
      <img v-else :src="pauseIcon" alt="" width="20" height="20" />
    </SC_PlayButton>

    <SC_WaveContainer ref="container" :compact="compact" @click="onSeekByClick">
      <SC_WaveSpinnerOverlay v-if="isLoadingWave || isBlocked">
        <div style="display:flex; align-items:center; gap:6px;">
          <SC_Spinner />
          <span v-if="message?.info?.uploadProgress" style="font-size: 11px; color: #607d8b;">
            {{ message.info.uploadProgress }}%
          </span>
        </div>
      </SC_WaveSpinnerOverlay>
    </SC_WaveContainer>
    <SC_TimeLabel>{{ timeLabel }}</SC_TimeLabel>
    <SC_Error v-if="hasError">{{ hasError }}</SC_Error>
  </SC_AudioMessage>
</template>

<script lang="ts">
import { audioMessageOptions } from './audio-message'
import playIcon from './img/play.svg'
import pauseIcon from './img/pause.svg'

export default {
  ...audioMessageOptions,
  data () {
    return { playIcon, pauseIcon }
  },
}
</script>
