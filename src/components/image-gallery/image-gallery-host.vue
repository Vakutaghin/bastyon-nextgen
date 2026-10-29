<template>
  <!-- Единственный просмотрщик картинок: открывает modalStore.openImageGallery
       откуда угодно — пост, комментарий, встройка. Свой у каждой карточки
       узнавал «свои» картинки по ссылке на массив, а под Tor в стор уходит
       новый массив с blob-URL, и просмотрщик не открывался вовсе. -->
  <ImageGallery
    :visible="gallery.isOpen"
    :images="gallery.images"
    :initial-index="gallery.index"
    @hide="modalStore.closeImageGallery()"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useModalStore } from '@/stores/modal-store'
import { useCloseOnBack } from '@/composables/use-back-button'
import ImageGallery from './image-gallery.vue'

const modalStore = useModalStore()
const gallery = computed(() => modalStore.imageGallery)

// «Назад» на Android закрывает картинку, а не страницу под ней.
useCloseOnBack(
  () => gallery.value.isOpen,
  () => modalStore.closeImageGallery()
)
</script>
