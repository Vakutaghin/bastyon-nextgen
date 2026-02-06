<template>
  <SC_AudioMessage>
    <SC_PlayButton v-if="isLoadingWave || isBlocked" :disabled="true">
      <SC_Spinner />
    </SC_PlayButton>
    <SC_PlayButton v-else :class="{ playing: isPlaying }" @click="togglePlay" :disabled="!!hasError">
      <svg v-if="!isPlaying" viewBox="0 0 24 24" width="20" height="20"><path fill="#00A4DB" d="M8 5v14l11-7z"/></svg>
      <svg v-else viewBox="0 0 24 24" width="20" height="20"><path fill="#00A4DB" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
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
export default audioMessageOptions
</script>
