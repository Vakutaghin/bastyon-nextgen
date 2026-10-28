// Личные списки видео и аудио и свои коллекции — у вошедшего аккаунта.
// Мессенджер подключает их при входе в Matrix; здесь — на случай, если раздел
// открыли раньше, чем он успел.

import { watch } from 'vue'
import { useAuthStore } from '@/blockchain'
import { useMediaLibraryStore } from '@/stores/media-library-store'
import { useCollectionsStore } from '@/stores/collections-store'

export function useMediaLibrary() {
  const library = useMediaLibraryStore()
  const collections = useCollectionsStore()
  const authStore = useAuthStore()
  watch(
    () => authStore.getUserAddress,
    (address) => {
      if (!address) return
      library.attach(address)
      collections.attach(address)
    },
    { immediate: true }
  )
  return { library, collections }
}
