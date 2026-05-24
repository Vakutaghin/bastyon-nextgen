<template>
  <SC_ExplorerLink>
    <SC_ExplorerHeader>
      <SC_ExplorerTitle>Блок-эксплорер</SC_ExplorerTitle>
    </SC_ExplorerHeader>

    <RouterLink
      v-slot='{ navigate, href }'
      custom
      :to='{ name: "explorer" }'
    >
      <SC_ExplorerCard :href='href' @click='navigate'>
        <SC_ExplorerIcon>
          <BlockOutlined :style="{ fontSize: '16px' }" />
        </SC_ExplorerIcon>
        <SC_ExplorerTextWrap>
          <SC_ExplorerLabel>Открыть эксплорер</SC_ExplorerLabel>
          <SC_ExplorerHint>Блоки, транзакции, адреса</SC_ExplorerHint>
        </SC_ExplorerTextWrap>
      </SC_ExplorerCard>
    </RouterLink>
  </SC_ExplorerLink>
</template>

<script setup lang='ts'>
import { RouterLink } from 'vue-router'
import { BlockOutlined } from '@ant-design/icons-vue'
import {
  SC_ExplorerLink,
  SC_ExplorerHeader,
  SC_ExplorerTitle,
  SC_ExplorerCard,
  SC_ExplorerIcon,
  SC_ExplorerTextWrap,
  SC_ExplorerLabel,
  SC_ExplorerHint,
} from './styled'

defineOptions({ name: 'SidebarExplorerLink' })
</script>
