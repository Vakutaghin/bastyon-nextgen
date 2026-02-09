<template>
  <SC_PostImage :imageCount="imageCount">
    <SC_ImageWrapper
      v-for="(imageUrl, idx) in images"
      :key="idx"
      :imageCount="imageCount"
      :style="getImageWrapperStyle(idx)"
      @click.stop="openImageGallery(idx)"
    >
      <img
        :src="imageUrl"
        :alt="`Изображение ${idx + 1}`"
        :style="getImageStyle(idx)"
        @error="handleImageError"
        @load="(e) => handleImageLoad(e, idx)"
      />
      <SC_ImageOverlay @click.stop="openImageGallery(idx)">
        <SC_ZoomIconCircle>
          <ZoomInOutlined />
        </SC_ZoomIconCircle>
      </SC_ImageOverlay>
    </SC_ImageWrapper>
  </SC_PostImage>
</template>

<script>
import { postCardImagesOptions } from './post-card-images.ts'

export default postCardImagesOptions
</script>
