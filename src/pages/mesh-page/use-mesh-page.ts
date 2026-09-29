/**
 * Страница «Mesh-сети»: подключение радио (Meshtastic или MeshCore) и то, что
 * с ним делают — узлы, контакты, каналы, начало переписки. Состояние радио
 * живёт в сторах соединения; здесь — выбор устройства и действия страницы.
 */

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { appToast } from '@/b-components/app-toast'
import { useMessengerStore } from '@/b-components/messenger/store'
import type { MeshNetwork } from '@/mesh/ids'
import { NUS_SERVICE, DEFAULT_TCP_PORT as MC_TCP_PORT } from '@/mesh/meshcore/constants'
import type { McContact } from '@/mesh/meshcore/codec'
import type { SessionChannel } from '@/mesh/meshcore/session'
import {
  BLE_SERVICE as MT_BLE_SERVICE,
  DEFAULT_TCP_PORT as MT_TCP_PORT,
} from '@/mesh/meshtastic/constants'
import type { MtSessionChannel } from '@/mesh/meshtastic/session'
import { radioAvailability, targetLabel, type MeshTarget } from '@/mesh/radio/open-link'
import { listSerialPorts, scanBle } from '@/mesh/radio/platform'
import { radioErrorFrom, type BleDeviceInfo, type SerialPortInfo } from '@/mesh/radio/types'
import { useMeshChatStore } from '@/mesh/store/mesh-chat-store'
import { useMeshConnectionStore } from '@/mesh/store/mesh-connection-store'
import { useMeshtasticConnectionStore } from '@/mesh/store/meshtastic-connection-store'
import { meshErrorCode } from '@/mesh/store/radio-common'

export type TransportTab = 'serial' | 'ble' | 'tcp'

/** Параметры сети для экрана подключения. */
const NETWORK_RADIO: Record<MeshNetwork, { tcpPort: number; bleService: string }> = {
  meshtastic: { tcpPort: MT_TCP_PORT, bleService: MT_BLE_SERVICE },
  meshcore: { tcpPort: MC_TCP_PORT, bleService: NUS_SERVICE },
}

/** Стор соединения сети: у обеих одинаковые поля подключения. */
export function useRadioStore(network: MeshNetwork) {
  return network === 'meshtastic' ? useMeshtasticConnectionStore() : useMeshConnectionStore()
}

/** Текст ошибки радио: известный код — своим текстом, прочие — общим. */
export function useMeshErrorText() {
  const { t, te } = useI18n()
  return (code: string | null | undefined): string => {
    if (!code) return ''
    const key = `mesh.errors.${code}`
    return te(key) ? t(key) : t('mesh.errors.generic', { code })
  }
}

export function useMeshConnect(network: MeshNetwork) {
  const connection = useRadioStore(network)
  const { status, lastDevice } = storeToRefs(connection)
  const errorText = useMeshErrorText()
  const availability = radioAvailability()
  const radio = NETWORK_RADIO[network]

  const transport = ref<TransportTab>(lastDevice.value?.transport ?? 'serial')
  const busy = ref(false)

  // USB
  const ports = ref<SerialPortInfo[]>([])
  const portsLoaded = ref(false)
  const usbPorts = computed(() => ports.value.filter((p) => p.kind === 'usb'))
  const otherPorts = computed(() => ports.value.filter((p) => p.kind !== 'usb'))

  async function refreshPorts(): Promise<void> {
    try {
      ports.value = await listSerialPorts()
    } catch (e) {
      ports.value = []
      appToast.error({ message: errorText(radioErrorFrom(e).code) })
    } finally {
      portsLoaded.value = true
    }
  }

  // Bluetooth
  const devices = ref<BleDeviceInfo[]>([])
  const scanning = ref(false)
  const scanned = ref(false)

  /** `all` — все устройства с именем: не каждое радио объявляет свой сервис. */
  async function scan(all = false): Promise<void> {
    if (scanning.value) return
    scanning.value = true
    try {
      devices.value = await scanBle(all ? [] : [radio.bleService], 5000)
    } catch (e) {
      devices.value = []
      appToast.error({ message: errorText(radioErrorFrom(e).code) })
    } finally {
      scanning.value = false
      scanned.value = true
    }
  }

  // Wi-Fi
  const host = ref(lastDevice.value?.transport === 'tcp' ? lastDevice.value.host : '')
  const port = ref(
    String(lastDevice.value?.transport === 'tcp' ? lastDevice.value.port : radio.tcpPort)
  )
  const tcpValid = computed(() => {
    const p = Number(port.value)
    return host.value.trim().length > 0 && Number.isInteger(p) && p > 0 && p < 65536
  })

  async function connectTo(target: MeshTarget): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    try {
      const code = await connection.connect(target)
      return code === null
    } finally {
      busy.value = false
    }
  }

  const connectSerial = (p: SerialPortInfo) =>
    connectTo({ transport: 'serial', path: p.path, label: portTitle(p) })
  const connectBle = (d: BleDeviceInfo) => connectTo({ transport: 'ble', id: d.id, name: d.name })
  const connectTcp = () =>
    tcpValid.value
      ? connectTo({ transport: 'tcp', host: host.value.trim(), port: Number(port.value) })
      : Promise.resolve(false)

  return {
    availability,
    status,
    lastDevice,
    transport,
    busy,
    ports,
    portsLoaded,
    usbPorts,
    otherPorts,
    refreshPorts,
    devices,
    scanning,
    scanned,
    scan,
    host,
    port,
    tcpValid,
    defaultPort: radio.tcpPort,
    connectTo,
    connectSerial,
    connectBle,
    connectTcp,
    targetLabel,
    connectionError: computed(() => errorText(connection.error)),
  }
}

/** Подпись порта: имя платы от USB, иначе путь. */
export function portTitle(p: SerialPortInfo): string {
  const name = [p.manufacturer, p.product].filter(Boolean).join(' ').trim()
  return name || p.path
}

/** Открыть переписку в мессенджере — из узла, контакта или канала на этой странице. */
export function useMeshOpenChat() {
  const meshChat = useMeshChatStore()
  const messenger = useMessengerStore()

  async function openDialog(id: string): Promise<void> {
    await messenger.openMessenger()
    await messenger.openChat(id)
  }

  // MeshCore
  async function writeTo(contact: McContact): Promise<void> {
    const self = useMeshConnectionStore().self
    if (!self) return
    await openDialog(await meshChat.ensureDirectDialog(self.publicKey, contact))
  }

  async function openChannel(channel: SessionChannel): Promise<void> {
    const self = useMeshConnectionStore().self
    if (!self) return
    await openDialog(await meshChat.ensureChannelDialog(self.publicKey, channel))
  }

  // Meshtastic
  async function writeToNode(node: { num: number; name: string }): Promise<void> {
    const self = useMeshtasticConnectionStore().self
    if (!self) return
    await openDialog(await meshChat.ensureMeshtasticDirectDialog(self.nodeNum, node))
  }

  async function openMtChannel(channel: MtSessionChannel): Promise<void> {
    const self = useMeshtasticConnectionStore().self
    if (!self) return
    await openDialog(await meshChat.ensureMeshtasticChannelDialog(self.nodeNum, channel))
  }

  return { writeTo, openChannel, writeToNode, openMtChannel }
}

/** Действие с радио: ошибка — тостом, а не в консоль. */
export function useMeshAction() {
  const errorText = useMeshErrorText()
  return async (run: () => Promise<unknown>, success?: string): Promise<boolean> => {
    try {
      await run()
      if (success) appToast.success({ message: success })
      return true
    } catch (e) {
      appToast.error({ message: errorText(meshErrorCode(e)) })
      return false
    }
  }
}

/** Скопировать текст (ключ, ссылку) с тостом об успехе или ошибке. */
export function useCopy() {
  const { t } = useI18n()
  return async (text: string, done: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      appToast.success({ message: done })
    } catch {
      appToast.error({ message: t('mesh.errors.generic', { code: 'clipboard' }) })
    }
  }
}
