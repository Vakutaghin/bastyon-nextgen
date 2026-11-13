<template>
  <DevUiSection title="Button">
    <SC_DevUiRow v-for="kind in KINDS" :key="kind">
      <SC_DevUiRowLabel>{{ kind }}</SC_DevUiRowLabel>
      <Button :type="kind" size="small">small</Button>
      <Button :type="kind">middle</Button>
      <Button :type="kind" size="large">large</Button>
      <Button :type="kind" disabled>disabled</Button>
      <Button :type="kind" loading>loading</Button>
      <Button :type="kind">
        <template #icon><PlusOutlined /></template>
        с иконкой
      </Button>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>сочетания</SC_DevUiRowLabel>
      <Button type="primary" danger>primary + danger</Button>
      <Button type="primary" ghost>primary + ghost</Button>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>block</SC_DevUiRowLabel>
      <Button type="primary" block>block</Button>
    </SC_DevUiRow>
  </DevUiSection>
</template>

<script setup lang="ts">
import { Button } from '@/components'
import { PlusOutlined } from '@/components/icons'
import type { ButtonProps } from '@/components/button/types'
import DevUiSection from '../dev-ui-section.vue'
import { SC_DevUiRow, SC_DevUiRowLabel } from '../dev-ui-page.styled'

const KINDS: ReadonlyArray<NonNullable<ButtonProps['type']>> = [
  'primary',
  'secondary',
  'danger',
  'link',
  'text',
]
</script>
