<template>
  <DevUiSection title="Spin, Progress, Badge, Alert">
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Spin</SC_DevUiRowLabel>
      <Spin size="small" />
      <Spin />
      <Spin size="large" />
      <Spin tip="Загрузка ленты…" />
      <Spin tip="Свой значок">
        <template #indicator><LoadingOutlined :style="ICON_PRIMARY_40" spin /></template>
      </Spin>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Progress</SC_DevUiRowLabel>
      <SC_DevUiStack>
        <Progress :percent="percent" :show-info="false" status="active" />
        <Progress :percent="65" :show-info="false" size="small" />
        <Progress :percent="percent" />
      </SC_DevUiStack>
      <Button size="small" @click="percent = (percent + 15) % 115">+15%</Button>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Badge</SC_DevUiRowLabel>
      <SC_DevUiBadgeBox v-for="n in [0, 3, 42, 120]" :key="n">
        <Badge :count="n"><BellOutlined :style="ICON_SIZE_XL" /></Badge>
      </SC_DevUiBadgeBox>
    </SC_DevUiRow>
    <SC_DevUiRow v-for="type in TYPES" :key="type">
      <SC_DevUiRowLabel>Alert {{ type }}</SC_DevUiRowLabel>
      <SC_DevUiStack>
        <Alert :type="type" show-icon>
          <template #description>
            <strong>Мнемоника:</strong> 12 или 24 слова через пробел.
          </template>
        </Alert>
        <Alert :type="type" title="С заголовком">Текст плашки слотом по умолчанию.</Alert>
      </SC_DevUiStack>
    </SC_DevUiRow>
  </DevUiSection>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Alert, { type AlertType } from '@/components/alert'
import Badge from '@/components/badge'
import Button from '@/components/button'
import Progress from '@/components/progress'
import Spin from '@/components/spin'
import { BellOutlined, LoadingOutlined } from '@/components/icons'
import { ICON_PRIMARY_40, ICON_SIZE_XL } from '@/styles/icon-styles'
import DevUiSection from '../dev-ui-section.vue'
import {
  SC_DevUiBadgeBox,
  SC_DevUiRow,
  SC_DevUiRowLabel,
  SC_DevUiStack,
} from '../dev-ui-page.styled'

const TYPES: readonly AlertType[] = ['info', 'success', 'warning', 'error']
const percent = ref(40)
</script>
