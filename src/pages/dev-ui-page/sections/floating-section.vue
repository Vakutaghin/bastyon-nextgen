<template>
  <DevUiSection title="Tooltip, Popover, Dropdown">
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Tooltip</SC_DevUiRowLabel>
      <Tooltip v-for="side in SIDES" :key="side" :title="`Подсказка: ${side}`" :placement="side">
        <Button size="small" :data-testid="`dev-tip-${side}`">{{ side }}</Button>
      </Tooltip>
      <Tooltip :title="LONG" :trigger="['hover', 'focus', 'click']">
        <Button size="small" aria-label="Справка" data-testid="dev-tip-click">
          <template #icon><InfoCircleOutlined /></template>
        </Button>
      </Tooltip>
    </SC_DevUiRow>
  </DevUiSection>
</template>

<script setup lang="ts">
// Плавающие панели: подсказка по наведению и фокусу, справка по нажатию.
import Button from '@/components/button'
import Tooltip from '@/components/tooltip'
import { InfoCircleOutlined } from '@/components/icons'
import DevUiSection from '../dev-ui-section.vue'
import { SC_DevUiRow, SC_DevUiRowLabel } from '../dev-ui-page.styled'

const SIDES = ['top', 'bottom', 'left', 'right'] as const

const LONG =
  'Справка по нажатию: на телефоне подсказка открывается касанием и закрывается касанием мимо.'
</script>
