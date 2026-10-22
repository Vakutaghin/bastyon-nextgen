<template>
  <Modal
    :open="store.isOpen"
    :width="760"
    :centered="true"
    :z-index="2700"
    :destroy-on-close="true"
    wrap-class-name="chain-info-modal"
    @cancel="store.close()"
  >
    <template #title>
      <SC_ChainTitleRow>
        <SC_ChainBackBtn
          v-if="store.canGoBack"
          type="button"
          :aria-label="t('chainInfo.back')"
          :title="t('chainInfo.back')"
          @click="store.back()"
        >
          <ArrowLeftIcon />
        </SC_ChainBackBtn>
        <span>{{ t('chainInfo.title') }}</span>
      </SC_ChainTitleRow>
    </template>

    <SC_ChainBody>
      <template v-if="current">
        <ChainPostView v-if="current.kind === 'post'" :key="viewKey" :txid="current.txid" />
        <ChainCommentView
          v-else-if="current.kind === 'comment'"
          :key="viewKey"
          :id="current.id"
          :post-id="current.postId"
        />
        <ChainAccountView
          v-else-if="current.kind === 'account'"
          :key="viewKey"
          :address="current.address"
        />
        <ChainTxView v-else :key="viewKey" :txid="current.txid" />
      </template>
    </SC_ChainBody>

    <template #footer>
      <SC_ChainFooter>
        <SC_ChainFooterLink v-if="explorerHref" :href="explorerHref" @click.prevent="openExplorer">
          <BlockOutlined />
          {{ t('chainInfo.openInExplorer') }}
        </SC_ChainFooterLink>
      </SC_ChainFooter>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, provide, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Modal } from 'ant-design-vue'
import { ArrowLeftIcon, BlockOutlined } from '@/components/icons'
import { useChainInfoStore } from '@/stores/chain-info-store'
import { CHAIN_LINK_KEY, explorerRouteFor } from './chain-link'
import ChainTxView from './views/chain-tx-view.vue'
import ChainPostView from './views/chain-post-view.vue'
import ChainCommentView from './views/chain-comment-view.vue'
import ChainAccountView from './views/chain-account-view.vue'
import {
  SC_ChainTitleRow,
  SC_ChainBackBtn,
  SC_ChainBody,
  SC_ChainFooter,
  SC_ChainFooterLink,
} from './chain-info.styled'

defineOptions({ name: 'ChainInfoModal' })

const { t } = useI18n()
const store = useChainInfoStore()
const route = useRoute()
const router = useRouter()

// Ссылки на транзакции и адреса внутри модалки открываются в ней же.
provide(CHAIN_LINK_KEY, (target) => store.push(target))

const current = computed(() => store.current)
/** Новый вид на каждый шаг: состояние прошлого (раскрытый JSON) не переносится. */
const viewKey = computed(() => `${store.stack.length}:${JSON.stringify(current.value)}`)

// Шаг внутри окна убирает нажатую кнопку вместе с прошлым видом, и фокус
// уходит из окна — Escape и Tab перестают в нём работать. Возвращаем фокус.
watch(viewKey, async () => {
  if (!store.isOpen) return
  await nextTick()
  const wrap = document.querySelector<HTMLElement>('.chain-info-modal')
  if (wrap && !wrap.contains(document.activeElement)) wrap.focus({ preventScroll: true })
})

const explorerHref = computed(() =>
  current.value ? router.resolve(explorerRouteFor(current.value)).href : ''
)

function openExplorer(): void {
  if (!current.value) return
  const to = explorerRouteFor(current.value)
  store.leave()
  void router.push(to)
}

// Лента под окном стоит на месте. `overflow: hidden` запирает только
// прокрутку колесом и пальцем, а фокус и scrollIntoView внутри окна двигают
// страницу и при нём: WebKit — уже на открытии, когда antd ставит фокус в
// окно. Пока окно открыто, возвращаем страницу туда, где её оставили.
let pinnedY = 0
function keepPagePinned(): void {
  if (window.scrollY !== pinnedY) {
    window.scrollTo({ top: pinnedY, left: window.scrollX, behavior: 'instant' })
  }
}
watch(
  () => store.isOpen,
  (open) => {
    if (open) {
      pinnedY = window.scrollY
      window.addEventListener('scroll', keepPagePinned, { passive: true })
    } else {
      window.removeEventListener('scroll', keepPagePinned)
    }
  }
)
onBeforeUnmount(() => window.removeEventListener('scroll', keepPagePinned))

// Ушли на другую страницу (профиль, блок в обозревателе) — модалка своё
// отслужила. Смена query на той же странице (вкладка, якорь) — не уход.
watch(
  () => route.path,
  () => {
    if (store.isOpen) store.leave()
  }
)
</script>
