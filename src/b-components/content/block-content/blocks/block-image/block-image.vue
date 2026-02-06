<template>
  <SC_BlockImage>
    <SC_BlockImageImg 
      :src='imageUrl' 
      :alt='imageAlt'
      @error='handleImageError'
    />
    <SC_BlockImageCaption v-if='imageCaption'>
      {{ decodedCaption }}
    </SC_BlockImageCaption>
  </SC_BlockImage>
</template>

<script>
import { blockImageOptions } from './block-image.ts'

export default blockImageOptions
</script>
