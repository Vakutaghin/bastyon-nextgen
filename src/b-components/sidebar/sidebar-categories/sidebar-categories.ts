import { defineComponent, computed, ref, onMounted, } from 'vue'
import { Switch, Modal, Input, Button, message } from 'ant-design-vue'
import {
  CaretUpOutlined,
  CaretDownOutlined,
  StopOutlined,
  PlusOutlined,
  CloseOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'

import { useFiltersStore } from '@/stores/filters-store'
import { useRpcQuery } from '@/composables/use-rpc-query'
import type { GetTagsResponse } from '@/types/rpc-responses/get-tags'
import {
  SC_Categories,
  SC_CategoriesHeader,
  SC_CategoriesTitle,
  SC_CategoriesToggle,
  SC_CategoriesControls,
  SC_ControlBtn,
  SC_CategoriesList,
  SC_CategoriesItem,
  SC_CategoriesIcon,
  SC_CategoriesName,
  SC_TopFirstWrapper,
  SC_TopFirstLabel
} from './styled'


export const sidebarCategoriesOptions = defineComponent({
  name: 'SidebarCategories',
  components: {
    ASwitch: Switch,
    AModal: Modal,
    AInput: Input,
    AButton: Button,
    CaretUpOutlined,
    CaretDownOutlined,
    StopOutlined,
    PlusOutlined,
    CloseOutlined,
    ExclamationCircleOutlined,
    SC_Categories,
    SC_CategoriesHeader,
    SC_CategoriesTitle,
    SC_CategoriesToggle,
    SC_CategoriesControls,
    SC_ControlBtn,
    SC_CategoriesList,
    SC_CategoriesItem,
    SC_CategoriesIcon,
    SC_CategoriesName,
    SC_TopFirstWrapper,
    SC_TopFirstLabel
  },
  setup() {
    const filtersStore = useFiltersStore()
    const isExpanded = ref(false)
    const isModalVisible = ref(false)
    const newCategoryName = ref('')
    const searchDebounce = ref<any>(null)
    const searchTerm = ref('')

    // Загружаем теги для автокомплита
    const { data: tagsResponse } = useRpcQuery<GetTagsResponse>(
      ['tags', 'cloud', 'ru'],
      {
        method: 'gettags',
        parameters: ['', '50', '', 'ru'],
        options: { auth: false }
      },
      {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false
      }
    )

    const categories = computed(() => {
      // Используем allCategories из стора, который уже включает статические, кастомные и временные
      return filtersStore.allCategories.map(category => ({
        ...category,
        selected: filtersStore.selectedCategories.includes(category.id),
        // Определяем, можно ли удалить категорию (кастомная или временная)
        isRemovable: category.id.startsWith('custom_') || category.id.startsWith('temp_')
      }))
    })

    const visibleCategories = computed(() => {
      // Показываем больше категорий, если добавлены кастомные
      const limit = isExpanded.value ? categories.value.length : 4 + filtersStore.customCategories.length + filtersStore.temporaryCategories.length
      // Но не больше 10 в свернутом виде, чтобы не растягивать слишком сильно
      const effectiveLimit = isExpanded.value ? categories.value.length : Math.min(limit, 10)

      return categories.value.slice(0, effectiveLimit)
    })

    const toggleCategory = (categoryId: string) => {
      filtersStore.toggleCategorySelection(categoryId)
    }

    const toggleExpanded = () => {
      isExpanded.value = !isExpanded.value
    }

    const clearSelection = (e: Event) => {
      e.stopPropagation()
      filtersStore.clearCategorySelection()
    }

    const hasSelection = computed(() => filtersStore.selectedCategories.length > 0)

    const toggleTopFirst = () => {
      filtersStore.toggleTopFirst()
    }

    const topFirst = computed(() => filtersStore.topFirst)

    // --- Логика модального окна добавления категории ---

    const openModal = (e: Event) => {
      e.stopPropagation()
      newCategoryName.value = ''
      isModalVisible.value = true
    }

    const closeModal = () => {
      isModalVisible.value = false
    }

    // --- Логика модального окна удаления категории ---

    const isDeleteModalVisible = ref(false)
    const categoryToDelete = ref<string | null>(null)

    const closeDeleteModal = () => {
      isDeleteModalVisible.value = false
      categoryToDelete.value = null
    }

    const confirmDeleteCategory = () => {
      if (categoryToDelete.value) {
        filtersStore.removeCustomCategory(categoryToDelete.value)
      }
      closeDeleteModal()
    }

    /**
     * Обработка ввода названия новой категории.
     * Автоматически заменяет пробелы на подчеркивания и удаляет недопустимые символы.
     * Разрешены: буквы, цифры, подчеркивание.
     */
    const handleInput = (e: any) => {
      let val = e.target.value
      // Заменяем пробелы на подчеркивания
      val = val.replace(/\s+/g, '_')
      // Оставляем только буквы, цифры и подчеркивания
      // \p{L} - любые буквы (Unicode), \p{N} - цифры
      val = val.replace(/[^\p{L}\p{N}_]/gu, '')

      newCategoryName.value = val
    }

    /**
     * Добавляет новую кастомную категорию.
     * Категория сохраняется в IDB и отображается вверху списка со звездочкой.
     */
    const addCategory = () => {
      const tagName = newCategoryName.value
      if (!tagName) return

      // Проверяем наличие в существующих категориях (статических, кастомных и временных)
      const existingCategory = filtersStore.allCategories.find(c =>
        c.tags.includes(tagName.toLowerCase())
      )

      if (existingCategory) {
        // Если категория уже существует, выбираем её
        filtersStore.toggleCategorySelection(existingCategory.id)
        message.info(`Такой тег существует, он был выбран`)
        closeModal()
        return
      }

      // Проверяем наличие в списке тегов с бэка
      const response = tagsResponse.value as any
      let serverTags: any[] = []

      if (Array.isArray(response)) serverTags = response
      else if (response?.data && Array.isArray(response.data)) serverTags = response.data
      else if (response?.result && Array.isArray(response.result)) serverTags = response.result
      else if (response?.tags && Array.isArray(response.tags)) serverTags = response.tags

      const isServerTag = serverTags?.some((t: any) =>
        (t.tag || t.name || String(t)).toLowerCase() === tagName.toLowerCase()
      )

      if (isServerTag) {
        message.info(`Такой тег существует, он был выбран`)
      }

      filtersStore.addCustomCategory(tagName)
      closeModal()
    }

    /**
     * Удаляет категорию (кастомную или временную).
     * Кастомная удаляется из IDB, временная - из памяти.
     * Для кастомных категорий запрашивается подтверждение.
     */
    const removeCategory = (e: Event, id: string) => {
      e.stopPropagation()

      // Если это временная категория (temp_), удаляем без подтверждения
      if (id.startsWith('temp_')) {
        filtersStore.removeCustomCategory(id)
        return
      }

      categoryToDelete.value = id
      isDeleteModalVisible.value = true
    }

    onMounted(() => {
      filtersStore.init()
    })

    return {
      categories,
      visibleCategories,
      toggleCategory,
      isExpanded,
      toggleExpanded,
      clearSelection,
      hasSelection,
      topFirst,
      toggleTopFirst,

      // Modal
      isModalVisible,
      newCategoryName,
      openModal,
      closeModal,
      handleInput,
      addCategory,
      removeCategory,

      // Delete Modal
      isDeleteModalVisible,
      closeDeleteModal,
      confirmDeleteCategory
    }
  }
})
