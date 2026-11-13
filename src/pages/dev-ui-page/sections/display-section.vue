<template>
  <DevUiSection title="Avatar, Tag, Card">
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Avatar</SC_DevUiRowLabel>
      <Avatar v-for="s in SIZES" :key="s" :size="s" fallback-text="Иван Петров" />
      <Avatar :size="40" fallback-text="Alice" shape="square" />
      <Avatar :size="40" fallback-text="Alice" pending />
      <Avatar :size="40" fallback-text="Alice" mark="verified" />
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Tag</SC_DevUiRowLabel>
      <Tag>🌐 Bastyon/Pocketnet</Tag>
      <Tag>#news</Tag>
      <Tag>#crypto</Tag>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Card</SC_DevUiRowLabel>
      <SC_DevUiStack>
        <Card>Тело карточки с отступом --ui-card-padding (24px, на узком экране 16px).</Card>
      </SC_DevUiStack>
    </SC_DevUiRow>
  </DevUiSection>
</template>

<script setup lang="ts">
import Avatar from '@/components/avatar'
import Card from '@/components/card'
import Tag from '@/components/tag'
import DevUiSection from '../dev-ui-section.vue'
import { SC_DevUiRow, SC_DevUiRowLabel, SC_DevUiStack } from '../dev-ui-page.styled'

const SIZES = [16, 24, 32, 40, 64] as const
</script>
