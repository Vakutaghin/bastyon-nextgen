<template>
  <!-- IPFS-браузер: адресная строка для ссылки IPFS. Содержимое открывается в
       отдельном окне-просмотрщике, как по клику: там чужие сайты, и строки,
       которую страница могла бы подделать, там нет. -->
  <Modal
    :open="open"
    :title="t('header.ipfsBrowserTitle')"
    :footer="null"
    :width="560"
    @cancel="emit('close')"
  >
    <SC_BrowserBody>
      <SC_BrowserBar @submit.prevent="go(address)">
        <Input
          ref="inputRef"
          v-model:value="address"
          :placeholder="t('header.ipfsBrowserPlaceholder')"
          :aria-label="t('header.ipfsBrowserPlaceholder')"
          :status="error ? 'error' : undefined"
          allow-clear
          autocomplete="off"
          spellcheck="false"
        />
        <Button type="primary" html-type="submit">{{ t('header.ipfsBrowserOpen') }}</Button>
      </SC_BrowserBar>
      <SC_BrowserError v-if="error" role="alert">{{ error }}</SC_BrowserError>
      <SC_BrowserHint>{{ t('header.ipfsBrowserHint') }}</SC_BrowserHint>

      <template v-if="recent.length">
        <SC_RecentTitle>{{ t('header.ipfsBrowserRecent') }}</SC_RecentTitle>
        <SC_RecentList>
          <SC_RecentItem v-for="item in recent" :key="item">
            <SC_RecentLink type="button" :title="item" @click="go(item)">{{ item }}</SC_RecentLink>
            <SC_RecentForget
              type="button"
              :aria-label="t('header.ipfsBrowserForget')"
              :title="t('header.ipfsBrowserForget')"
              @click="recent = forgetRecent(item)"
            >
              <CloseOutlined />
            </SC_RecentForget>
          </SC_RecentItem>
        </SC_RecentList>
      </template>
    </SC_BrowserBody>
  </Modal>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Input, Modal } from 'ant-design-vue'

import { CloseOutlined } from '@/components/icons'
import { openIpfsViewer } from '@/composables/use-ipfs-links'
import { parseIpfsInput } from '@/helpers/ipfs/ipfs-link'
import { forgetRecent, ipfsAddress, loadRecent, rememberRecent } from '@/helpers/ipfs/ipfs-recent'
import {
  SC_BrowserBar,
  SC_BrowserBody,
  SC_BrowserError,
  SC_BrowserHint,
  SC_RecentForget,
  SC_RecentItem,
  SC_RecentLink,
  SC_RecentList,
  SC_RecentTitle,
} from './ipfs-browser-dialog.styled'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const address = ref('')
const error = ref('')
const recent = ref<string[]>([])
const inputRef = ref<{ focus: () => void } | null>(null)

// Открыли — пустая строка с курсором, как новая вкладка: можно сразу вставлять.
watch(
  () => props.open,
  async (open) => {
    if (!open) return
    address.value = ''
    error.value = ''
    recent.value = loadRecent()
    await nextTick()
    inputRef.value?.focus()
  },
  { immediate: true }
)

watch(address, () => {
  error.value = ''
})

function go(text: string): void {
  const link = parseIpfsInput(text)
  if (!link) {
    error.value = t('header.ipfsBrowserInvalid')
    return
  }
  // Приватную ссылку не запоминаем: в ней ключ от файла.
  if (!link.secret) recent.value = rememberRecent(ipfsAddress(link.target))
  // Сначала закрыть: открытие может спросить, как открывать IPFS (своё окно).
  emit('close')
  void openIpfsViewer(link.target, link.secret, link.size)
}
</script>
