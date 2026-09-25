<template>
  <!-- Под Tor iframe мини-аппы грузился бы напрямую с её хоста, с реальным IP (V21). -->
  <SC_Error v-if="app && mediaBlocked">
    <TorBlockedNotice :message="t('torMedia.miniAppBlocked')" />
  </SC_Error>
  <SC_Frame v-else-if="app">
    <SC_IframeWrap>
      <!--
        :key="iframeSrc" — принудительный re-mount iframe при смене src.
        credentialless — обязательно для cross-origin миниапп под нашим COEP credentialless.
      -->
      <SC_Iframe
        :key="iframeSrc"
        ref="iframeRef"
        :src="iframeSrc"
        credentialless
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        :allow="iframeAllow"
        referrerpolicy="no-referrer"
        allowfullscreen
        @load="onIframeLoad"
        @error="onIframeError"
      />
      <SC_Loader :class="{ hidden: loaded }">
        <SC_LoaderIcon :src="app.icon" :alt="app.manifest.name" />
        <SC_LoaderText>{{ loaderText }}</SC_LoaderText>
      </SC_Loader>
    </SC_IframeWrap>

    <!-- Лепесток-закрывашка справа сверху. По дефолту виден только иконка-«язычок». -->
    <SC_ClosePetal
      type="button"
      :title="t('miniapps.closeAppTitle', { name: app.manifest.name })"
      @click="askClose"
    >
      <SC_ClosePetalIcon>
        <CloseOutlined />
      </SC_ClosePetalIcon>
      <SC_ClosePetalLabel>{{ t('miniapps.close') }}</SC_ClosePetalLabel>
    </SC_ClosePetal>
  </SC_Frame>

  <SC_Error v-else> {{ t('miniapps.appNotFound') }} </SC_Error>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CloseOutlined } from '@/components/icons'
import { Modal } from 'ant-design-vue'
import { useAppsStore } from '@/mini-apps/store/apps-store'
import { usePermissionsStore } from '@/mini-apps/store/permissions-store'
import { miniAppsBridge } from '@/mini-apps/core/bridge'
import { onIframeLifecycleEvent } from './use-mini-app-bridge'
import TorBlockedNotice from '@/components/tor-blocked-notice'
import { useTorMedia } from '@/composables/use-tor-media'
import {
  SC_Frame,
  SC_IframeWrap,
  SC_Iframe,
  SC_Loader,
  SC_LoaderIcon,
  SC_LoaderText,
  SC_Error,
  SC_ClosePetal,
  SC_ClosePetalLabel,
  SC_ClosePetalIcon,
} from './mini-app-frame.styled'

const props = defineProps<{
  appId: string
  innerPath?: string
}>()

const router = useRouter()
const { t } = useI18n()
const appsStore = useAppsStore()

const app = computed(() => appsStore.byId(props.appId))
const { mediaBlocked } = useTorMedia()
const loaded = ref(false)
const iframeStatus = ref<'pending' | 'loaded-html' | 'load-error' | 'load-timeout'>('pending')

// Таймаут на HTML-загрузку iframe. Если сервер миниаппы зависнет, без таймаута
// спиннер останется навсегда. См. CODE_AUDIT.md §9.1.
const IFRAME_LOAD_TIMEOUT_MS = 45_000
let loadTimerId: ReturnType<typeof setTimeout> | null = null

function clearLoadTimer() {
  if (loadTimerId != null) {
    clearTimeout(loadTimerId)
    loadTimerId = null
  }
}

function armLoadTimer() {
  clearLoadTimer()
  loadTimerId = setTimeout(() => {
    if (iframeStatus.value === 'pending') {
      iframeStatus.value = 'load-timeout'
    }
    loadTimerId = null
  }, IFRAME_LOAD_TIMEOUT_MS)
}

const loaderText = computed(() => {
  if (!app.value) return ''
  if (iframeStatus.value === 'load-error')
    return t('miniapps.loadFailed', { name: app.value.manifest.name })
  if (iframeStatus.value === 'load-timeout')
    return t('miniapps.notResponding', { name: app.value.manifest.name })
  if (iframeStatus.value === 'loaded-html')
    return t('miniapps.initializing', { name: app.value.manifest.name })
  return app.value.manifest.name
})

const iframeSrc = computed(() => {
  if (!app.value) return 'about:blank'
  const scope = app.value.scope.replace(/\/+$/, '')
  const start = app.value.manifest.startUrl ?? ''
  const path = props.innerPath ?? ''
  const withScheme = /^https?:\/\//i.test(scope) ? scope : `https://${scope}`
  const tail = path || start
  return tail ? `${withScheme}/${tail.replace(/^\/+/, '')}` : withScheme
})

const iframeAllow = computed(() => {
  if (!app.value) return ''
  const map: Record<string, string> = {
    mobilecamera: 'camera',
    geolocation: 'geolocation',
    notifications: 'notifications',
  }
  const granted = app.value.grantedPermissions ?? []
  const features = granted.map((p) => map[p]).filter(Boolean)
  return ['clipboard-write', ...features].join('; ')
})

// Окно iframe — единственный источник сообщений, который bridge принимает от
// этого приложения (S48). Привязываем при монтировании и на каждой перезагрузке
// фрейма: popup, открытый миниаппой, имеет тот же origin, но это не её фрейм.
const iframeRef = ref<{ $el?: HTMLIFrameElement } | HTMLIFrameElement | null>(null)

function iframeElement(): HTMLIFrameElement | null {
  const raw = iframeRef.value
  if (!raw) return null
  const el = '$el' in raw ? raw.$el : raw
  return el instanceof HTMLIFrameElement ? el : null
}

function attachFrameWindow() {
  const win = iframeElement()?.contentWindow ?? null
  miniAppsBridge.attachFrame(props.appId, win)
}

const onIframeLoad = () => {
  iframeStatus.value = 'loaded-html'
  clearLoadTimer()
  attachFrameWindow()
}
const onIframeError = () => {
  iframeStatus.value = 'load-error'
  clearLoadTimer()
}

// `event: 'loaded'` от миниаппы → снимаем спиннер
const onIframeEvent = (eventApp: { manifest: { id: string } }, event: string) => {
  if (eventApp.manifest.id === props.appId && event === 'loaded') {
    loaded.value = true
  }
}

onIframeLifecycleEvent.add(onIframeEvent)

// Полноэкранный режим — скрываем хост-хедер через body class (см. style.css)
const BODY_CLASS = 'miniapp-fullscreen'
onMounted(() => {
  document.body.classList.add(BODY_CLASS)
  armLoadTimer()
  attachFrameWindow()
})

// При смене источника iframe (новое приложение / innerPath) — перезапускаем
// таймер и заново привязываем окно: :key пересоздаёт элемент.
watch(iframeSrc, async () => {
  armLoadTimer()
  await nextTick()
  attachFrameWindow()
})

watch(
  () => props.appId,
  (_next, prev) => {
    loaded.value = false
    iframeStatus.value = 'pending'
    if (prev) releaseApp(prev)
  }
)

/**
 * Закрытие миниаппы = конец доступа: снимаем окно и соединение, гасим
 * session-гранты и убираем каталожную регистрацию, иначе её origin продолжает
 * резолвиться и любое окно этого хоста считается «своим» (S48).
 */
function releaseApp(appId: string) {
  miniAppsBridge.unregisterApp(appId)
  usePermissionsStore().clearSessionGrants(appId)
  appsStore.dropSession(appId)
}

const askClose = () => {
  if (!app.value) {
    void router.push('/')
    return
  }
  Modal.confirm({
    title: t('miniapps.closeConfirmTitle', { name: app.value.manifest.name }),
    content: t('miniapps.closeConfirmContent'),
    okText: t('miniapps.close'),
    cancelText: t('miniapps.stay'),
    okType: 'danger',
    centered: true,
    onOk: () => {
      void router.push('/')
    },
  })
}

onBeforeUnmount(() => {
  document.body.classList.remove(BODY_CLASS)
  onIframeLifecycleEvent.delete(onIframeEvent)
  clearLoadTimer()
  releaseApp(props.appId)
})
</script>
