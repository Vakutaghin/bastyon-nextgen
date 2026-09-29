<template>
  <SC_MeshCard>
    <SC_MeshCardHead>
      <SC_MeshCardTitle>
        {{ t('mesh.rns.nomad.title') }}
        <SC_MeshCount>{{ nomadNodes.length }}</SC_MeshCount>
      </SC_MeshCardTitle>
    </SC_MeshCardHead>
    <SC_MeshNote>{{ t('mesh.rns.nomad.lead') }}</SC_MeshNote>
    <SC_MeshNote v-if="downloading">
      {{ t('mesh.rns.nomad.downloading', { name: downloading }) }}{{ percentText }}
    </SC_MeshNote>

    <template v-if="current">
      <SC_MeshRow>
        <Button size="small" :disabled="history.length === 0" @click="back">
          {{ t('mesh.rns.nomad.back') }}
        </Button>
        <Button size="small" :disabled="loading" @click="reload">
          {{ t('mesh.rns.nomad.reload') }}
        </Button>
        <Button size="small" @click="close">{{ t('mesh.rns.nomad.close') }}</Button>
        <SC_MeshItemMeta>{{ where }}</SC_MeshItemMeta>
      </SC_MeshRow>
      <SC_MeshNote v-if="loading">{{ t('mesh.rns.nomad.loading') }}{{ percentText }}</SC_MeshNote>
      <SC_MeshError v-else-if="error">{{ errorText(error) }}</SC_MeshError>
      <SC_MeshRow v-else-if="binary">
        <SC_MeshNote>{{ t('mesh.rns.nomad.binary') }}</SC_MeshNote>
        <Button
          size="small"
          :disabled="!!downloading"
          @click="current && download(current.node, current.path)"
        >
          {{ t('mesh.rns.nomad.download') }}
        </Button>
      </SC_MeshRow>
      <SC_MeshNote v-else-if="lines.length === 0">{{ t('mesh.rns.nomad.pageEmpty') }}</SC_MeshNote>
      <MicronPage
        v-else
        :lines="lines"
        :form="form"
        @open="follow"
        @field="(name, value) => (form[name] = value)"
        @check="(part, on) => setMicronChecked(form, part, on)"
      />
    </template>

    <template v-else>
      <SC_MeshNote v-if="nomadNodes.length === 0">{{ t('mesh.rns.nomad.empty') }}</SC_MeshNote>
      <SC_MeshList v-else>
        <SC_MeshItem v-for="n in shown" :key="n.dest">
          <SC_MeshItemMain>
            <SC_MeshItemName>{{ n.name || n.dest.slice(0, 12) }}</SC_MeshItemName>
            <SC_MeshItemMeta>{{ describe(n) }}</SC_MeshItemMeta>
          </SC_MeshItemMain>
          <Button size="small" type="primary" @click="open({ node: n.dest, path: DEFAULT_PAGE })">
            {{ t('mesh.rns.nomad.open') }}
          </Button>
        </SC_MeshItem>
      </SC_MeshList>

      <SC_MeshSubtitle>{{ t('mesh.rns.nomad.byAddress') }}</SC_MeshSubtitle>
      <SC_MeshForm @submit.prevent="openByAddress">
        <SC_MeshField>
          <SC_MeshInput
            v-model="addressInput"
            :placeholder="t('mesh.rns.nomad.addressPlaceholder')"
            autocomplete="off"
            spellcheck="false"
          />
        </SC_MeshField>
        <Button html-type="submit" :disabled="!typed">{{ t('mesh.rns.nomad.open') }}</Button>
      </SC_MeshForm>
    </template>
  </SC_MeshCard>
</template>

<script setup lang="ts">
/**
 * NomadNet: узлы со страницами (доски, справочники, сервисы) и просмотр их
 * страниц. Страница приходит от узла по Link (rns_page) в разметке micron;
 * ссылки ведут на страницы этого и других узлов или в чат LXMF, ссылка с
 * полями отправляет форму, ссылка на `/file/…` скачивает файл (rns_download:
 * узел отдаёт его ресурсом, дальше системное окно «Сохранить как»).
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import {
  DEFAULT_PAGE,
  micronDefaults,
  micronRequestData,
  parseMicron,
  resolveMicronUrl,
  setMicronChecked,
  type MicronForm,
  type MicronLine,
  type MicronPart,
} from '@/mesh/reticulum/micron'
import { rnsDownload, rnsPage } from '@/mesh/reticulum/rns-api'
import { meshErrorCode } from '@/mesh/store/radio-common'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import MicronPage from './micron-page.vue'
import { useMeshErrorText, useMeshOpenChat, useRnsPeerMeta } from './use-mesh-page'
import {
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshCount,
  SC_MeshError,
  SC_MeshField,
  SC_MeshForm,
  SC_MeshInput,
  SC_MeshItem,
  SC_MeshItemMain,
  SC_MeshItemMeta,
  SC_MeshItemName,
  SC_MeshList,
  SC_MeshNote,
  SC_MeshRow,
  SC_MeshSubtitle,
} from './mesh-page.styled'

interface Visit {
  node: string
  path: string
  data?: Record<string, string>
}

const { t } = useI18n()
const rns = useReticulumStore()
const { nomadNodes } = storeToRefs(rns)
const shown = computed(() => nomadNodes.value.slice(0, 50))
const describe = useRnsPeerMeta()
const errorText = useMeshErrorText()
const { writeToLxmf } = useMeshOpenChat()

const current = ref<Visit | null>(null)
const history = ref<Visit[]>([])
const lines = ref<MicronLine[]>([])
const form = ref<MicronForm>({})
const loading = ref(false)
const error = ref<string | null>(null)
const binary = ref(false)
/** Имя файла, который сейчас скачивается. */
const downloading = ref<string | null>(null)
/** Ответ на устаревший запрос (ушли на другую страницу) не показывать. */
let request = 0

/** « 42%», пока ответ идёт ресурсом из нескольких частей. */
const percentText = computed(() => {
  const tr = rns.transfer
  return tr && tr.total > 1 ? ` ${Math.floor((tr.received / tr.total) * 100)}%` : ''
})

function showPage(content: string, isBinary: boolean): void {
  binary.value = isBinary
  lines.value = isBinary ? [] : parseMicron(content)
  form.value = micronDefaults(lines.value)
}

const where = computed(() => {
  if (!current.value) return ''
  const { node, path } = current.value
  const name = nomadNodes.value.find((n) => n.dest === node)?.name
  return `${name || node.slice(0, 12)} · ${path}`
})

async function load(visit: Visit): Promise<void> {
  const mine = ++request
  current.value = visit
  loading.value = true
  error.value = null
  rns.transfer = null
  try {
    const page = await rnsPage(visit.node, visit.path, visit.data ?? {})
    if (mine !== request) return
    showPage(page.content, page.binary)
  } catch (e) {
    if (mine === request) error.value = meshErrorCode(e)
  } finally {
    if (mine === request) loading.value = false
  }
}

function open(visit: Visit): void {
  if (current.value) history.value = [...history.value, current.value]
  void load(visit)
}

function back(): void {
  const previous = history.value[history.value.length - 1]
  if (!previous) return
  history.value = history.value.slice(0, -1)
  void load(previous)
}

function reload(): void {
  if (current.value) void load(current.value)
}

function close(): void {
  request++
  current.value = null
  history.value = []
  lines.value = []
  loading.value = false
}

/** Имя файла из пути `/file/…` — до ответа узла, для подписи. */
function fileNameOf(path: string): string {
  const last = path.split('/').pop() || 'file'
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

async function download(node: string, path: string): Promise<void> {
  if (downloading.value) return
  downloading.value = fileNameOf(path)
  rns.transfer = null
  try {
    const got = await rnsDownload(node, path)
    if (got.kind === 'saved') {
      appToast.success({ message: t('mesh.rns.nomad.saved', { name: got.name }) })
    } else if (got.kind === 'page') {
      // Вместо файла узел ответил страницей (обычно отказом) — показать её.
      request++
      if (current.value) history.value = [...history.value, current.value]
      current.value = { node, path }
      loading.value = false
      error.value = null
      showPage(got.content, got.binary)
    }
  } catch (e) {
    appToast.error({ message: errorText(meshErrorCode(e)) })
  } finally {
    downloading.value = null
    rns.transfer = null
  }
}

function follow(part: Extract<MicronPart, { kind: 'link' }>): void {
  const target = resolveMicronUrl(part.url, current.value?.node ?? null)
  if (!target) {
    appToast.error({ message: errorText('unsupported_link') })
    return
  }
  if (target.kind === 'anchor') return
  if (target.kind === 'lxmf') {
    void writeToLxmf(target.address, rns.peerName(target.address))
    return
  }
  if (target.path.startsWith('/file/')) {
    void download(target.node, target.path)
    return
  }
  const data = part.fields.length > 0 ? micronRequestData(part.fields, form.value) : undefined
  open({ node: target.node, path: target.path, data })
}

const addressInput = ref('')
const typed = computed(() => {
  const target = resolveMicronUrl(addressInput.value, null)
  return target?.kind === 'page' ? target : null
})

function openByAddress(): void {
  if (!typed.value) return
  const { node, path } = typed.value
  addressInput.value = ''
  if (path.startsWith('/file/')) void download(node, path)
  else open({ node, path })
}
</script>
