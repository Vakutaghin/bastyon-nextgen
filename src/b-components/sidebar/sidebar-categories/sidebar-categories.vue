<template>
  <SC_Categories>
    <SC_TopFirstWrapper>
      <SC_TopFirstLabel>{{ t('sidebar.topFirst') }}</SC_TopFirstLabel>
      <ASwitch :checked="topFirst" size="small" @change="toggleTopFirst" />
    </SC_TopFirstWrapper>

    <SC_CategoriesHeader @click="toggleExpanded">
      <SC_CategoriesTitle>{{ t('sidebar.categories') }}</SC_CategoriesTitle>

      <SC_CategoriesControls>
        <SC_ControlBtn :title="t('sidebar.addCategory')" @click.stop="openModal">
          <PlusOutlined />
        </SC_ControlBtn>

        <SC_ControlBtn v-if="hasSelection" :title="t('sidebar.resetFilter')" @click.stop="clearSelection">
          <StopOutlined />
        </SC_ControlBtn>
      </SC_CategoriesControls>

      <SC_CategoriesToggle>
        <CaretUpOutlined v-if="isExpanded" />
        <CaretDownOutlined v-else />
      </SC_CategoriesToggle>
    </SC_CategoriesHeader>

    <SC_CategoriesList>
      <SC_CategoriesItem
        v-for="category in visibleCategories"
        :key="category.id"
        :selected="category.selected"
        @click="toggleCategory(category.id)"
      >
        <SC_CategoriesIcon :selected="category.selected">
          {{ category.icon }}
        </SC_CategoriesIcon>

        <SC_CategoriesName :selected="category.selected">
          {{ category.labelKey ? t(category.labelKey) : category.name }}
        </SC_CategoriesName>

        <!-- Кнопка удаления для кастомных/временных категорий -->
        <div
          v-if="category.isRemovable"
          style="margin-left: auto; padding: 0 5px; opacity: 0.6; cursor: pointer"
          @click="(e) => removeCategory(e, category.id)"
        >
          <CloseOutlined style="font-size: 10px" />
        </div>
      </SC_CategoriesItem>
    </SC_CategoriesList>

    <AModal
      v-model:open="isModalVisible"
      :title="t('sidebar.addCategory')"
      :ok-text="t('sidebar.add')"
      :cancel-text="t('sidebar.cancel')"
      :body-style="{ padding: '20px' }"
      :width="400"
      @ok="addCategory"
      @cancel="closeModal"
    >
      <div style="margin-bottom: 10px; font-size: 13px; color: var(--color-gray-888)">
        {{ t('sidebar.enterTag') }}
      </div>

      <AInput
        v-model:value="newCategoryName"
        :placeholder="t('sidebar.tagPlaceholder')"
        allow-clear
        @input="handleInput"
        @press-enter="addCategory"
      />
    </AModal>

    <AModal
      v-model:open="isDeleteModalVisible"
      :title="t('sidebar.deleteCategoryTitle')"
      :ok-text="t('sidebar.delete')"
      ok-type="danger"
      :cancel-text="t('sidebar.cancel')"
      :width="400"
      @ok="confirmDeleteCategory"
      @cancel="closeDeleteModal"
    >
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px 0">
        <ExclamationCircleOutlined style="font-size: 22px; color: var(--color-warning-icon)" />
        <span>{{ t('sidebar.deleteCategoryConfirm') }}</span>
      </div>
    </AModal>
  </SC_Categories>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Switch as ASwitch, Modal as AModal, Input as AInput, message } from 'ant-design-vue'
import {
  CaretUpOutlined,
  CaretDownOutlined,
  StopOutlined,
  PlusOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons-vue'
import { useFiltersStore } from '@/stores/filters-store'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
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
  SC_TopFirstLabel,
} from './styled'

interface RawTag {
  tag?: string
  name?: string
}

const { t } = useI18n()
const filtersStore = useFiltersStore()
const isExpanded = ref(false)
const isModalVisible = ref(false)
const newCategoryName = ref('')

const { data: tagsResponse } = useRpcQuery<GetTagsResponse>(
  ['tags', 'cloud', 'ru'],
  {
    method: rpcEndpoints.getTags,
    parameters: ['', '50', '', 'ru'],
    options: { auth: false },
  },
  {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  }
)

const categories = computed(() =>
  filtersStore.allCategories.map((category) => ({
    ...category,
    selected: filtersStore.selectedCategories.includes(category.id),
    // Удалять можно только пользовательские (custom_) и временные (temp_).
    isRemovable: category.id.startsWith('custom_') || category.id.startsWith('temp_'),
  }))
)

const visibleCategories = computed(() => {
  const baseLimit =
    4 + filtersStore.customCategories.length + filtersStore.temporaryCategories.length
  const effectiveLimit = isExpanded.value ? categories.value.length : Math.min(baseLimit, 10)
  return categories.value.slice(0, effectiveLimit)
})

const hasSelection = computed<boolean>(() => filtersStore.selectedCategories.length > 0)
const topFirst = computed<boolean>(() => filtersStore.topFirst)

function toggleCategory(categoryId: string): void {
  filtersStore.toggleCategorySelection(categoryId)
}

function toggleExpanded(): void {
  isExpanded.value = !isExpanded.value
}

function clearSelection(e: Event): void {
  e.stopPropagation()
  filtersStore.clearCategorySelection()
}

function toggleTopFirst(): void {
  filtersStore.toggleTopFirst()
}

function openModal(e: Event): void {
  e.stopPropagation()
  newCategoryName.value = ''
  isModalVisible.value = true
}

function closeModal(): void {
  isModalVisible.value = false
}

const isDeleteModalVisible = ref(false)
const categoryToDelete = ref<string | null>(null)

function closeDeleteModal(): void {
  isDeleteModalVisible.value = false
  categoryToDelete.value = null
}

function confirmDeleteCategory(): void {
  if (categoryToDelete.value) {
    filtersStore.removeCustomCategory(categoryToDelete.value)
  }
  closeDeleteModal()
}

/**
 * Автозамена пробелов на `_` и фильтрация символов: разрешены буквы (любой
 * Unicode-алфавит), цифры и `_`.
 */
function handleInput(e: Event): void {
  const target = e.target as HTMLInputElement | null
  if (!target) return
  let val = target.value
  val = val.replace(/\s+/g, '_')
  val = val.replace(/[^\p{L}\p{N}_]/gu, '')
  newCategoryName.value = val
}

function addCategory(): void {
  const tagName = newCategoryName.value
  if (!tagName) return

  const existingCategory = filtersStore.allCategories.find((c) =>
    c.tags.includes(tagName.toLowerCase())
  )

  if (existingCategory) {
    filtersStore.toggleCategorySelection(existingCategory.id)
    message.info(t('sidebar.tagExistsSelected'))
    closeModal()
    return
  }

  const response = tagsResponse.value as unknown
  let serverTags: RawTag[] = []

  if (Array.isArray(response)) {
    serverTags = response as RawTag[]
  } else if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>
    if (Array.isArray(r.data)) serverTags = r.data as RawTag[]
    else if (Array.isArray(r.result)) serverTags = r.result as RawTag[]
    else if (Array.isArray(r.tags)) serverTags = r.tags as RawTag[]
  }

  const isServerTag = serverTags.some(
    (t) => (t.tag || t.name || String(t)).toLowerCase() === tagName.toLowerCase()
  )

  if (isServerTag) {
    message.info(t('sidebar.tagExistsSelected'))
  }

  filtersStore.addCustomCategory(tagName)
  closeModal()
}

function removeCategory(e: Event, id: string): void {
  e.stopPropagation()

  // Временные категории (temp_) удаляются молча, кастомные — с подтверждением.
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
</script>
