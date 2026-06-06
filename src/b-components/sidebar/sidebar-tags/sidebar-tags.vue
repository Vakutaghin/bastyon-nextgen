<template>
  <SC_Tags>
    <SC_TagsHeader @click="toggleExpanded">
      <SC_TagsTitle>{{ t('sidebar.trendingTags') }}</SC_TagsTitle>
      <SC_TagsControls v-if="hasSelection">
        <SC_TagsReset :title="t('sidebar.resetTags')" @click.stop="clearSelection">
          <StopOutlined />
        </SC_TagsReset>
      </SC_TagsControls>
      <SC_TagsToggle v-if="showToggle">
        <CaretUpOutlined v-if="isExpanded" />
        <CaretDownOutlined v-else />
      </SC_TagsToggle>
    </SC_TagsHeader>

    <SC_TagsLoading v-if="isLoading">
      <Spin size="small">
        <template #indicator>
          <LoadingOutlined :style="ICON_PRIMARY_24" spin />
        </template>
      </Spin>
    </SC_TagsLoading>
    <SC_TagsList v-else-if="!error && weightedTags.length > 0">
      <SC_TagsItem
        v-for="tag in weightedTags"
        :key="tag.id"
        :selected="isTagSelected(tag.name)"
        :weight="tag.weight"
        type="button"
        @click="selectTag(tag.name)"
      >
        <SC_TagsName>#{{ tag.name }}</SC_TagsName>
        <SC_TagsCount>{{ formatCount(tag.count) }}</SC_TagsCount>
      </SC_TagsItem>
    </SC_TagsList>
  </SC_Tags>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CaretUpOutlined,
  CaretDownOutlined,
  StopOutlined,
  LoadingOutlined,
} from '@ant-design/icons-vue'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { useRpcQuery } from '@/composables/use-rpc-query'
import { useFiltersStore } from '@/stores/filters-store'
import type { GetTagsResponse } from '@/types/rpc-responses/get-tags'
import Spin from '@/components/spin/spin.vue'
import { ICON_PRIMARY_24 } from '@/styles/icon-styles'
import {
  SC_Tags,
  SC_TagsHeader,
  SC_TagsControls,
  SC_TagsReset,
  SC_TagsTitle,
  SC_TagsToggle,
  SC_TagsLoading,
  SC_TagsList,
  SC_TagsItem,
  SC_TagsName,
  SC_TagsCount,
} from './styled'

interface TagItem {
  id: number
  name: string
  count: number
}

// Возможные формы ответа API getTags — поэтому работаем через unknown + narrow.
interface RawTag {
  tag?: string
  name?: string
  count?: number
}

const { t } = useI18n()
const filtersStore = useFiltersStore()
const isExpanded = ref(false)

const {
  data: tagsResponse,
  isLoading,
  error,
} = useRpcQuery<GetTagsResponse>(
  ['tags', 'cloud', 'ru'],
  {
    method: rpcEndpoints.getTags,
    parameters: ['', '100', '', 'ru'],
    options: { auth: false },
  },
  {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  }
)

const tagsData = computed<TagItem[]>(() => {
  const response = tagsResponse.value as unknown
  let tags: RawTag[] = []

  if (Array.isArray(response)) {
    tags = response as RawTag[]
  } else if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>
    if (Array.isArray(r.data)) tags = r.data as RawTag[]
    else if (Array.isArray(r.result)) tags = r.result as RawTag[]
    else if (Array.isArray(r.tags)) tags = r.tags as RawTag[]
  }

  if (tags.length === 0) return []

  return tags.map((tag, idx) => ({
    id: idx + 1,
    name: tag.tag || tag.name || String(tag),
    count: tag.count || 0,
  }))
})

const visibleTags = computed<TagItem[]>(() =>
  isExpanded.value ? tagsData.value : tagsData.value.slice(0, 7)
)

// Облако с весами: размер шрифта тега пропорционален его частоте (count).
// Нормализуем count по min/max видимых тегов в бакеты 1..5.
const weightedTags = computed<(TagItem & { weight: number })[]>(() => {
  const tags = visibleTags.value
  if (tags.length === 0) return []
  const counts = tags.map((tag) => tag.count)
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  return tags.map((tag) => {
    const weight = max > min ? 1 + Math.round(((tag.count - min) / (max - min)) * 4) : 3
    return { ...tag, weight }
  })
})
const showToggle = computed<boolean>(() => tagsData.value.length > 7)
const hasSelection = computed<boolean>(() => filtersStore.selectedTags.length > 0)

function toggleExpanded(): void {
  isExpanded.value = !isExpanded.value
}

function selectTag(tagName: string): void {
  filtersStore.toggleTag(tagName)
}

function isTagSelected(tagName: string): boolean {
  return filtersStore.selectedTags.includes(tagName)
}

function clearSelection(e: Event): void {
  e.stopPropagation()
  filtersStore.selectedTags = []
  filtersStore.saveSettings()
}

function formatCount(count: number): string {
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K'
  return String(count)
}
</script>
