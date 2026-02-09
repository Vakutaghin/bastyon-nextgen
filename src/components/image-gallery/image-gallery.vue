<template>
  <VueEasyLightbox
    :visible='visible'
    :imgs='images'
    :index='index'
    @hide='handleHide'
  />
</template>

<script lang="ts">
import imageGallery from './image-gallery'

export default imageGallery
</script>

<style scoped src="./image-gallery.styles.css"></style>
