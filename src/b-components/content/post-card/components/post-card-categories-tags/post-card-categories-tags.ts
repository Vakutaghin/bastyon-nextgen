import { defineComponent, type PropType } from 'vue'
import Tag from '@/components/tag/tag.vue'
import { useFiltersStore } from '@/stores/filters-store'
import { SC_PostCategoriesAndTags } from './styled'

export interface PostCategoriesTagsPost {
  tags?: string[]
}

export const postCardCategoriesTagsOptions = defineComponent({
  name: 'PostCardCategoriesTags',
  components: {
    Tag,
    SC_PostCategoriesAndTags
  },
  props: {
    post: {
      type: Object as PropType<PostCategoriesTagsPost>,
      required: true
    }
  },
  setup() {
    const filtersStore = useFiltersStore()
    return { filtersStore }
  },
  computed: {
    decodedTags(): string[] {
      if (!this.post.tags || !Array.isArray(this.post.tags)) return []
      return this.post.tags.map((tag: string) => this.decodeUrlEncoded(tag))
    },
    displayItems(): Array<{ type: string; id?: string; name: string; icon?: string }> {
      const tags = this.decodedTags
      if (!tags || tags.length === 0) return []

      const uniqueTags = Array.from(new Set(tags))
      const categories: Array<{ type: string; id?: string; name: string; icon?: string }> = []
      const remainingTags: Array<{ type: string; name: string }> = []
      const allCategories = this.filtersStore.allCategories

      for (const cat of allCategories) {
        const matchingTags = cat.tags.filter((catTag: string) =>
          uniqueTags.some((postTag: string) => postTag.toLowerCase() === catTag.toLowerCase())
        )
        if (matchingTags.length > 0) {
          categories.push({
            type: 'category',
            id: cat.id,
            name: cat.name,
            icon: cat.icon
          })
        }
      }

      uniqueTags.forEach((tag: string) => {
        const isCategoryTag = allCategories.some((cat: { tags: string[] }) =>
          cat.tags.includes(tag.toLowerCase())
        )
        if (!isCategoryTag) {
          remainingTags.push({ type: 'tag', name: tag })
        }
      })

      return [...categories, ...remainingTags]
    }
  },
  methods: {
    decodeUrlEncoded(str: string): string {
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
    },
    handleTagClick(item: { type: string; id?: string; name: string }) {
      if (item.type === 'category') {
        this.filtersStore.toggleCategorySelection(item.id ?? '')
      } else {
        this.filtersStore.addTemporaryCategory(item.name)
      }
    }
  }
})
