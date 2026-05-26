<template>
  <SC_AttachmentRoot :ref="setRootRef">
    <SC_AttachButton type="button" :title="title" @click="toggleMenu">📎</SC_AttachButton>

    <SC_Menu v-if="menuOpen">
      <SC_MenuItem type="button" @click="pickImage">
        <span aria-hidden="true">🖼️</span> Фото
      </SC_MenuItem>
      <SC_MenuItem type="button" @click="pickFile">
        <span aria-hidden="true">📄</span> Файл
      </SC_MenuItem>
      <SC_MenuItem v-if="canSendPkoin" type="button" @click="pickPkoin">
        <span aria-hidden="true">💎</span> Отправить PKOIN
      </SC_MenuItem>
    </SC_Menu>

    <SC_HiddenInput
      :ref="setImageInputRef"
      type="file"
      accept="image/*"
      multiple
      @change="onImageFiles"
    />

    <SC_HiddenInput :ref="setFileInputRef" type="file" multiple @change="onFileFiles" />
  </SC_AttachmentRoot>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { SC_AttachmentRoot, SC_AttachButton, SC_Menu, SC_MenuItem, SC_HiddenInput } from './styled'

const props = defineProps<{
  title?: string
  canSendPkoin?: boolean
}>()

const emit = defineEmits<{
  (e: 'pickFiles', files: File[]): void
  (e: 'pickPkoin'): void
}>()

const title = props.title ?? 'Прикрепить'

const menuOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

/**
 * styled-component ref возвращает Vue-инстанс, а не DOM. Берём $el — это
 * фактический HTMLElement. function-ref удобен для unwrap без watch().
 */
const unwrapEl = <T extends HTMLElement>(val: unknown): T | null => {
  if (!val) return null
  if (val instanceof HTMLElement) return val as T
  const maybe = (val as { $el?: unknown }).$el
  return maybe instanceof HTMLElement ? (maybe as T) : null
}

const setRootRef = (el: unknown) => {
  rootRef.value = unwrapEl<HTMLElement>(el)
}
const setImageInputRef = (el: unknown) => {
  imageInputRef.value = unwrapEl<HTMLInputElement>(el)
}
const setFileInputRef = (el: unknown) => {
  fileInputRef.value = unwrapEl<HTMLInputElement>(el)
}

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value
}

const closeMenu = () => {
  menuOpen.value = false
}

const pickImage = () => {
  closeMenu()
  imageInputRef.value?.click()
}

const pickFile = () => {
  closeMenu()
  fileInputRef.value?.click()
}

const pickPkoin = () => {
  closeMenu()
  emit('pickPkoin')
}

const collectAndEmit = (input: HTMLInputElement) => {
  const files = input.files ? Array.from(input.files) : []
  if (files.length > 0) emit('pickFiles', files)
  input.value = ''
}

const onImageFiles = (event: Event) => collectAndEmit(event.target as HTMLInputElement)
const onFileFiles = (event: Event) => collectAndEmit(event.target as HTMLInputElement)

const onClickOutside = (e: MouseEvent) => {
  if (!menuOpen.value) return
  const target = e.target as Node
  if (rootRef.value && !rootRef.value.contains(target)) closeMenu()
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true)
})
</script>
