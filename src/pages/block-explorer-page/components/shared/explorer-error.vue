<template>
  <SC_ExplorerError>
    <SC_ExplorerErrorMessage>{{ message }}</SC_ExplorerErrorMessage>
    <SC_ExplorerErrorActions>
      <SC_ExplorerErrorBtn type="button" @click="retry">
        {{ t('explorerPage.errorRetry') }}
      </SC_ExplorerErrorBtn>
      <SC_ExplorerErrorBtn v-if="preferredNode" type="button" class="secondary" @click="resetNode">
        {{ t('explorerPage.errorTryAnotherNode') }}
      </SC_ExplorerErrorBtn>
    </SC_ExplorerErrorActions>
  </SC_ExplorerError>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { useExplorerPreferredNode } from '@/composables/use-explorer-preferred-node'
import {
  SC_ExplorerError,
  SC_ExplorerErrorMessage,
  SC_ExplorerErrorActions,
  SC_ExplorerErrorBtn,
} from './explorer-error.styled'

defineOptions({ name: 'ExplorerError' })

defineProps<{ message: string }>()

// Страницы с не-vue-query источником (кастомная пагинация адреса) слушают @retry,
// чтобы перезапустить свой собственный fetch. Для остальных хватает инвалидации.
const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
const queryClient = useQueryClient()
const { preferredNode, clearPreferredNode } = useExplorerPreferredNode()

function retry() {
  queryClient.invalidateQueries({ queryKey: ['explorer'] })
  emit('retry')
}

function resetNode() {
  // Сброс закреплённой ноды сам инвалидирует ['explorer'] и уводит запросы на
  // round-robin по servers.json — это и есть «попробовать другую ноду».
  clearPreferredNode()
  emit('retry')
}
</script>
