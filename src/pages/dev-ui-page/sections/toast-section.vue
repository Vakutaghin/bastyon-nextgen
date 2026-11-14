<template>
  <DevUiSection title="Toast">
    <SC_DevUiRow>
      <SC_DevUiRowLabel>виды</SC_DevUiRowLabel>
      <Button
        v-for="type in TYPES"
        :key="type"
        size="small"
        :data-testid="`dev-toast-${type}`"
        @click="show(type)"
      >
        {{ type }}
      </Button>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>особые</SC_DevUiRowLabel>
      <Button size="small" data-testid="dev-toast-loading" @click="toggleLoading">
        {{ hideLoading ? 'loading: закрыть' : 'loading' }}
      </Button>
      <Button size="small" data-testid="dev-toast-keyed" @click="showKeyed">тот же key</Button>
      <Button size="small" data-testid="dev-toast-clickable" @click="showClickable">
        с onClick
      </Button>
      <Button size="small" data-testid="dev-toast-sticky" @click="showSticky">duration 0</Button>
    </SC_DevUiRow>
  </DevUiSection>
</template>

<script setup lang="ts">
// Тосты appToast: место выбирается по окну — внизу слева на компьютере,
// сверху под шапкой в каркасе телефона.
import { shallowRef } from 'vue'
import Button from '@/components/button'
import { appToast } from '@/b-components/app-toast'
import DevUiSection from '../dev-ui-section.vue'
import { SC_DevUiRow, SC_DevUiRowLabel } from '../dev-ui-page.styled'

const TYPES = ['success', 'info', 'warning', 'error'] as const

const TEXT: Record<(typeof TYPES)[number], [string, string?]> = {
  success: ['Скопировано', 'Ссылка в буфере обмена'],
  info: ['Публикации alice_ng теперь в мессенджере'],
  warning: ['Загрузка идёт в другой вкладке', 'Приостановить или отменить её можно только там.'],
  error: ['Не удалось сохранить'],
}

function show(type: (typeof TYPES)[number]): void {
  const [message, description] = TEXT[type]
  appToast[type]({ message, description })
}

const hideLoading = shallowRef<(() => void) | null>(null)

function toggleLoading(): void {
  if (hideLoading.value) {
    hideLoading.value()
    hideLoading.value = null
  } else {
    hideLoading.value = appToast.loading('Публикую в IPFS…')
  }
}

let keyed = 0
function showKeyed(): void {
  keyed += 1
  appToast.info({ message: `Обновлён на месте: ${keyed}`, key: 'dev-keyed' })
}

function showClickable(): void {
  appToast.info({
    message: 'Нажмите на тост',
    onClick: () => {
      appToast.close('dev-clickable')
      appToast.success({ message: 'Нажали' })
    },
    key: 'dev-clickable',
  })
}

function showSticky(): void {
  appToast.warning({ message: 'Висит, пока не закроют', duration: 0 })
}
</script>
