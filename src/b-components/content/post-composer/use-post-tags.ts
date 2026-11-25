// Теги поста: ввод, добавление/удаление, backspace-удаление последнего, теги из
// хэштегов текста. Вынесено из use-post-composer; запись тега — post-tags.
import { computed, ref } from 'vue'
import { MAX_TAGS } from './consts'
import { seenHashtags, tagsFromText, withTypedTag } from './post-tags'

/**
 * @param initial теги при открытии.
 * @param text текст, хэштеги которого тоже теги; null — текст тегов не даёт
 *   (статья, репост). Хэштеги, с которыми форма открылась, уже разобраны: в
 *   черновике и в опубликованном посте теги стоят такие, какие выбрал автор.
 */
export function usePostTags(initial: string[], text: () => string | null = () => null) {
  const tags = ref<string[]>(initial)
  const tagInput = ref('')
  const seen = ref<string[]>(seenHashtags(text() ?? ''))
  const tagsFull = computed(() => tags.value.length >= MAX_TAGS)

  /**
   * Теги, с которыми пост уйдёт: с хэштегом, который ещё набирают в тексте, и
   * со словом в поле, после которого не нажали Enter. Без этого «Опубликовать»
   * оставалась серой, хотя тег на экране набран.
   */
  const postTags = computed(() => {
    const body = text()
    const list =
      body === null
        ? tags.value
        : tagsFromText({ tags: tags.value, seen: seen.value }, body, body, null).tags
    return withTypedTag(list, tagInput.value)
  })

  const addTag = (raw: string): void => {
    const list = withTypedTag(tags.value, raw)
    if (list.length === tags.value.length) return
    tags.value = list
    tagInput.value = ''
  }

  const commitTagInput = (): void => {
    if (tagInput.value.trim()) addTag(tagInput.value)
  }

  /**
   * Текст поменялся: новые хэштеги — в теги. `before` — текст до правки,
   * `caret` — где курсор; без них (ушли из поля, публикуют) слово под курсором
   * тоже считается законченным.
   */
  const addTextTags = (before?: string, caret: number | null = null): void => {
    const body = text()
    if (body === null) return
    const next = tagsFromText({ tags: tags.value, seen: seen.value }, body, before ?? body, caret)
    tags.value = next.tags
    seen.value = next.seen
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
    seen.value = []
  }

  return {
    tags,
    tagInput,
    tagsFull,
    postTags,
    addTag,
    addTextTags,
    commitTagInput,
    removeTag,
    onTagBackspace,
    resetTags,
  }
}
