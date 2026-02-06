import { defineComponent } from 'vue'
import { useSearchStore } from '@/stores/search-store'
import InputSearch from '@/components/input-search/input-search.vue'
import { searchData } from '@/b-components/header/dummy-data/search-data'

export const headerSearchOptions = defineComponent({
  name: 'HeaderSearch',
  components: {
    InputSearch
  },
  setup() {
    const searchStore = useSearchStore()
    return { searchStore }
  },
  data() {
    return {
      searchData
    }
  },
  computed: {
    searchQuery: {
      get(): string {
        return this.searchStore.query
      },
      set(value: string): void {
        this.searchStore.setQuery(value)
      }
    }
  },
  methods: {
    onSearchInput(): void {
      // Поиск можно выполнять при вводе (debounce можно добавить)
    },
    onSearch(value: string): void {
      // Обработка поиска при нажатии Enter
      this.searchStore.search(value)
    }
  }
})
