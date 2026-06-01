<template>
  <SC_HashLink :title="hash">
    <RouterLink v-if="to" v-slot="{ navigate, href }" custom :to="to">
      <SC_HashLinkAnchor :href="href" @click="navigate" @mouseenter="prefetch" @focus="prefetch">
        {{ display }}
      </SC_HashLinkAnchor>
    </RouterLink>
    <SC_HashLinkText v-else>{{ display }}</SC_HashLinkText>

    <SC_HashLinkCopy v-if="copyable" type="button" :title="t('explorerShared.copy')" @click.stop="copy">
      <CopyOutlined :style="ICON_SIZE_XS" />
    </SC_HashLinkCopy>
  </SC_HashLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { CopyOutlined } from '@ant-design/icons-vue'
import { appToast } from '@/b-components/app-toast'
import { prefetchExplorerTarget } from '@/composables/use-block-explorer-queries'
import { shortenHash } from './format-explorer'
import { ICON_SIZE_XS } from '@/styles/icon-styles'
import {
  SC_HashLink,
  SC_HashLinkAnchor,
  SC_HashLinkText,
  SC_HashLinkCopy,
} from './hash-link.styled'

const p = withDefaults(
  defineProps<{
    hash: string
    to?: RouteLocationRaw
    /** Если задано — показываем целиком, иначе укорачиваем middle-ellipsis. */
    full?: boolean
    copyable?: boolean
    head?: number
    tail?: number
  }>(),
  {
    full: false,
    copyable: true,
    head: 8,
    tail: 6,
  }
)

const { t } = useI18n()
const queryClient = useQueryClient()

const display = computed(() => (p.full ? p.hash : shortenHash(p.hash, p.head, p.tail)))

// Прогреваем кэш целевой страницы при наведении/фокусе — клик откроет её мгновенно
// из кэша. prefetchQuery уважает staleTime, поэтому повторные наведения не спамят сеть.
function prefetch() {
  prefetchExplorerTarget(queryClient, p.to)
}

async function copy() {
  try {
    await window.navigator.clipboard.writeText(p.hash)
    appToast.success({ message: t('explorerShared.copied') })
  } catch {
    appToast.error({ message: t('explorerShared.copyFailed') })
  }
}
</script>
