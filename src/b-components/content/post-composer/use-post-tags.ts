// Теги поста: ввод, нормализация (legacy kit.js regex), добавление/удаление,
// backspace-удаление последнего. Вынесено из use-post-composer.
import { computed, ref } from 'vue'
import { MAX_TAGS } from './consts'

/** Нормализует тег: lowercase + только буквы/цифры (legacy regex kit.js). */
export function normalizeTag(raw: string): string {
  return raw.toLowerCase().replace(/[^0-9a-zа-яё]/gi, '')
}

export function usePostTags(initial: string[]) {
  const tags = ref<string[]>(initial)
  const tagInput = ref('')
  const tagsFull = computed(() => tags.value.length >= MAX_TAGS)

  const addTag = (raw: string): void => {
    const norm = normalizeTag(raw)
    if (!norm) return
    if (tags.value.includes(norm)) return
    if (tags.value.length >= MAX_TAGS) return
    tags.value.push(norm)
    tagInput.value = ''
  }

  const commitTagInput = (): void => {
    if (tagInput.value.trim()) addTag(tagInput.value)
  }

  const removeTag = (tag: string): void => {
    tags.value = tags.value.filter((x) => x !== tag)
  }

  /** Backspace в пустом поле тега удаляет последний тег. */
  const onTagBackspace = (): void => {
    if (!tagInput.value && tags.value.length > 0) {
      tags.value = tags.value.slice(0, -1)
    }
  }

  const resetTags = (): void => {
    tags.value = []
    tagInput.value = ''
  }

  return { tags, tagInput, tagsFull, addTag, commitTagInput, removeTag, onTagBackspace, resetTags }
}
