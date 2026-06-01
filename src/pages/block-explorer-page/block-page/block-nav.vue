<template>
  <SC_BlockNav>
    <SC_BlockNavBtn type="button" :disabled="!prevHash" @click="emit('go', prevHash)">
      <LeftOutlined :style="ICON_SIZE_XS" /> {{ t('explorerPage.blockNavPrev') }}
    </SC_BlockNavBtn>
    <SC_BlockNavBtn type="button" :disabled="!nextHash" @click="emit('go', nextHash)">
      {{ t('explorerPage.blockNavNext') }} <RightOutlined :style="ICON_SIZE_XS" />
    </SC_BlockNavBtn>
    <ShareButton v-if="hasBlock" :title="shareTitle" />
  </SC_BlockNav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LeftOutlined, RightOutlined } from '@ant-design/icons-vue'
import { ICON_SIZE_XS } from '@/styles/icon-styles'
import ShareButton from '../components/shared/share-button.vue'
import { SC_BlockNav, SC_BlockNavBtn } from './block-page.styled'

defineOptions({ name: 'BlockNav' })

defineProps<{
  prevHash: string
  nextHash: string
  hasBlock: boolean
  shareTitle: string
}>()

const emit = defineEmits<{ go: [hash: string] }>()

const { t } = useI18n()
</script>
