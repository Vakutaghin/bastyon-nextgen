<template>
  <SC_PostCategoriesAndTags v-if="displayItems && displayItems.length">
    <template v-for="item in displayItems" :key="item.id || item.name">
      <Tag
        v-if="item.type === 'category'"
        style="cursor: pointer"
        @click.stop.prevent="handleTagClick(item)"
      >
        {{ item.icon }} {{ item.name }}
      </Tag>
      <Tag v-else style="cursor: pointer" @click.stop.prevent="handleTagClick(item)">
        #{{ item.name }}
      </Tag>
    </template>
  </SC_PostCategoriesAndTags>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Tag from '@/components/tag/tag.vue'
import { useFiltersStore } from '@/stores/filters-store'
import { SC_PostCategoriesAndTags } from './styled'

export interface PostCategoriesTagsPost {
  tags?: string[]
}

interface DisplayItem {
  type: 'category' | 'tag'
  id?: string
  name: string
  icon?: string
}

const props = defineProps<{ post: PostCategoriesTagsPost }>()
const { t } = useI18n()
const filtersStore = useFiltersStore()

function decodeUrlEncoded(str: string): string {
  if (!str || typeof str !== 'string') return str
  const urlEncodedPattern = /%[0-9A-Fa-f]{2}/g
  if (!urlEncodedPattern.test(str)) return str
  try {
    const decoded = decodeURIComponent(str)
    if (decoded && decoded !== str) return decoded
  } catch {
    // ignore
  }
  return str
}

const decodedTags = computed<string[]>(() => {
  const tags = props.post.tags
  if (!tags || !Array.isArray(tags)) return []
  return tags.map(decodeUrlEncoded)
})

const displayItems = computed<DisplayItem[]>(() => {
  const tags = decodedTags.value
  if (tags.length === 0) return []

  const uniqueTags = Array.from(new Set(tags))
  const categories: DisplayItem[] = []
  const remainingTags: DisplayItem[] = []
  const allCategories = filtersStore.allCategories

  for (const cat of allCategories) {
    const matching = cat.tags.filter((catTag: string) =>
      uniqueTags.some((postTag) => postTag.toLowerCase() === catTag.toLowerCase())
    )
    if (matching.length > 0) {
      // Статические категории несут labelKey (i18n), кастомные/временные — сырое name.
      const displayName = cat.labelKey ? t(cat.labelKey) : (cat.name ?? '')
      categories.push({ type: 'category', id: cat.id, name: displayName, icon: cat.icon })
    }
  }

  for (const tag of uniqueTags) {
    const isCategoryTag = allCategories.some((cat) => cat.tags.includes(tag.toLowerCase()))
    if (!isCategoryTag) remainingTags.push({ type: 'tag', name: tag })
  }

  return [...categories, ...remainingTags]
})

function handleTagClick(item: DisplayItem): void {
  if (item.type === 'category') {
    filtersStore.toggleCategorySelection(item.id ?? '')
  } else {
    filtersStore.addTemporaryCategory(item.name)
  }
}
</script>
