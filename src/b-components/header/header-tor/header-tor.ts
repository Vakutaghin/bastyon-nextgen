import { defineComponent, computed, ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Modal } from 'ant-design-vue'
import {
  SafetyOutlined,
  LoadingOutlined,
  WarningFilled,
  CheckCircleFilled,
} from '@ant-design/icons-vue'
import { useTorStore, type TorBridgeKind } from '@/stores/tor-store'

export const headerTorOptions = defineComponent({
  name: 'HeaderTor',
  components: {
    SafetyOutlined,
    LoadingOutlined,
    WarningFilled,
    CheckCircleFilled,
  },
  setup() {
    const tor = useTorStore()
    const {
      available,
      enabled,
      status,
      bootstrapPct,
      message,
      install,
      useBridges,
      bridgeKind,
      customBridges,
    } = storeToRefs(tor)

    const visible = ref(false)
    const localUseBridges = ref(useBridges.value)
    const localKind = ref<TorBridgeKind>(bridgeKind.value)
    const localCustom = ref(customBridges.value)
    const dirty = ref(false)

    onMounted(() => {
      tor.hydrate().catch(() => {})
    })

    watch(useBridges, (v) => {
      if (!dirty.value) localUseBridges.value = v
    })
    watch(bridgeKind, (v) => {
      if (!dirty.value) localKind.value = v
    })
    watch(customBridges, (v) => {
      if (!dirty.value) localCustom.value = v
    })

    const variant = computed<'off' | 'busy' | 'ready' | 'failed'>(() => {
      if (status.value === 'ready') return 'ready'
      if (status.value === 'failed') return 'failed'
      if (
        status.value === 'starting' ||
        status.value === 'bootstrapping' ||
        status.value === 'installing'
      ) {
        return 'busy'
      }
      return 'off'
    })

    const statusLine = computed(() => {
      switch (status.value) {
        case 'off':
          return enabled.value ? 'Tor выключается…' : 'Tor выключен'
        case 'installing':
          return install.value
            ? `Загрузка: ${Math.round(install.value.fraction * 100)}% — ${install.value.message}`
            : 'Установка Tor…'
        case 'starting':
          return 'Запуск процесса…'
        case 'bootstrapping':
          return `Подключение к сети Tor: ${bootstrapPct.value}%`
        case 'ready':
          return 'Подключено к сети Tor'
        case 'failed':
          return message.value ? `Ошибка: ${message.value}` : 'Ошибка'
        default:
          return ''
      }
    })

    const progressPct = computed(() => {
      if (status.value === 'installing' && install.value) {
        return install.value.fraction * 100
      }
      if (status.value === 'bootstrapping') {
        return bootstrapPct.value
      }
      if (status.value === 'ready') return 100
      return 0
    })

    const showProgress = computed(
      () =>
        status.value === 'installing' ||
        status.value === 'bootstrapping' ||
        status.value === 'starting'
    )

    const onTriggerClick = async () => {
      if (!available.value) {
        Modal.info({
          title: 'Tor доступен только в десктопном приложении',
          content:
            'Откройте Bastyon в приложении для рабочего стола — браузерная версия не поддерживает встроенный Tor.',
        })
        return
      }
      visible.value = !visible.value
    }

    const onToggleSwitch = async (...args: unknown[]) => {
      // ASwitch passes (checked, event); other elements may pass an Event.
      // Stop propagation defensively when an Event is supplied — parent
      // SC_TorMenu also has @click.stop so this is belt-and-braces.
      for (const a of args) {
        if (a && typeof (a as { stopPropagation?: unknown }).stopPropagation === 'function') {
          ;(a as Event).stopPropagation()
          break
        }
      }
      if (!enabled.value) {
        // First-run consent if Tor is not yet installed.
        const seen = localStorage.getItem('tor:seen-consent') === '1'
        if (!seen) {
          const ok = await new Promise<boolean>((resolve) => {
            Modal.confirm({
              title: 'Включить Tor?',
              content:
                'При первом запуске будет загружен Tor (~30 МБ). Это может занять минуту. ' +
                'После подключения весь сетевой трафик приложения пойдёт через сеть Tor. ' +
                'Чат Matrix может работать с задержками.',
              okText: 'Включить',
              cancelText: 'Отмена',
              onOk: () => {
                localStorage.setItem('tor:seen-consent', '1')
                resolve(true)
              },
              onCancel: () => resolve(false),
            })
          })
          if (!ok) return
        }
        await tor.enable()
      } else {
        await tor.disable()
      }
    }

    const onSelectKind = (kind: TorBridgeKind) => {
      localKind.value = kind
      localUseBridges.value = kind !== 'none'
      dirty.value = true
    }

    const onCustomInput = (value: string) => {
      localCustom.value = value
      dirty.value = true
    }

    const onApplyBridges = async () => {
      dirty.value = false
      await tor.applyAndRestart({
        useBridges: localUseBridges.value,
        kind: localKind.value,
        customBridges: localCustom.value,
      })
    }

    return {
      available,
      enabled,
      status,
      visible,
      variant,
      statusLine,
      progressPct,
      showProgress,
      onTriggerClick,
      onToggleSwitch,
      localKind,
      localCustom,
      onSelectKind,
      onCustomInput,
      onApplyBridges,
      dirty,
    }
  },
})
