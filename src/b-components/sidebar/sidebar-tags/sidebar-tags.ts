import { defineComponent, computed, ref } from 'vue'
import { useRpcQuery } from '@/composables/use-rpc-query'
import { useFiltersStore } from '@/stores/filters-store'
import type { GetTagsResponse } from '@/types/rpc-responses/get-tags'
import { CaretUpOutlined, CaretDownOutlined, StopOutlined } from '@ant-design/icons-vue'
import {
  SC_Tags,
  SC_TagsHeader,
  SC_TagsControls,
  SC_TagsReset,
  SC_TagsTitle,
  SC_TagsToggle,
  SC_TagsList,
  SC_TagsItem,
  SC_TagsName,
  SC_TagsCount
} from './styled'

export const sidebarTagsOptions = defineComponent({
  name: 'SidebarTags',
  components: {
    CaretUpOutlined,
    CaretDownOutlined,
    StopOutlined,
    SC_Tags,
    SC_TagsHeader,
    SC_TagsControls,
    SC_TagsReset,
    SC_TagsTitle,
    SC_TagsToggle,
    SC_TagsList,
    SC_TagsItem,
    SC_TagsName,
    SC_TagsCount
  },
  setup() {
    const filtersStore = useFiltersStore()

    // Состояние развернутости списка
    const isExpanded = ref(false)

    // Загружаем теги через API
    // Параметры: address (пустая строка), count (100), block (пустая строка для кеша), localization ('ru')
    const { data: tagsResponse, isLoading, error } = useRpcQuery<GetTagsResponse>(
      ['tags', 'cloud', 'ru'],
      {
        method: 'gettags',
        parameters: ['', '100', '', 'ru'], // address, count, block, localization
        options: { auth: false }
      },
      {
        staleTime: 5 * 60 * 1000, // 5 минут
        gcTime: 10 * 60 * 1000, // 10 минут
        refetchOnWindowFocus: false,
        refetchOnReconnect: true
      }
    )

    // Преобразуем ответ API в формат компонента
    const tagsData = computed(() => {
      const response = tagsResponse.value as any

      // API может возвращать данные в разных форматах:
      // 1. Напрямую массив: [...]
      // 2. Обернутый в объект: { data: [...] }
      // 3. Обернутый в объект: { result: [...] }

      let tags: any[] = []

      if (Array.isArray(response)) {
        tags = response
      } else if (response && typeof response === 'object') {
        // Проверяем разные варианты обертки
        if (Array.isArray(response.data)) {
          tags = response.data
        } else if (Array.isArray(response.result)) {
          tags = response.result
        } else if (Array.isArray(response.tags)) {
          tags = response.tags
        }
      }

      if (!tags || tags.length === 0) {
        return []
      }

      return tags.map((tag, index) => ({
        id: index + 1,
        name: tag.tag || tag.name || String(tag),
        count: tag.count || 0
      }))
    })

    // Видимые теги (первые 7 или все, в зависимости от состояния)
    const visibleTags = computed(() => {
      if (isExpanded.value) {
        return tagsData.value
      }
      return tagsData.value.slice(0, 7)
    })

    // Показывать ли кнопку разворачивания (если тегов больше 7)
    const showToggle = computed(() => {
      return tagsData.value.length > 7
    })

    // Метод для переключения состояния
    const toggleExpanded = () => {
      isExpanded.value = !isExpanded.value
    }

    const selectTag = (tagName: string) => {
      filtersStore.toggleTag(tagName)
    }

    const isTagSelected = (tagName: string) => {
      return filtersStore.selectedTags.includes(tagName)
    }

    const clearSelection = (e: Event) => {
      e.stopPropagation()
      filtersStore.selectedTags = []
      filtersStore.saveSettings()
    }

    const hasSelection = computed(() => filtersStore.selectedTags.length > 0)

    const formatCount = (count: number): string => {
      if (count >= 1000) {
        return (count / 1000).toFixed(1) + 'K'
      }
      return String(count)
    }

    return {
      tagsData,
      visibleTags,
      isExpanded,
      showToggle,
      isLoading,
      error,
      toggleExpanded,
      selectTag,
      isTagSelected,
      clearSelection,
      hasSelection,
      formatCount,
    }
  }
})
