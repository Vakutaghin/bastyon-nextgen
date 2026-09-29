/**
 * Страница «Mesh-сети»: подключение радио MeshCore и то, что с ним делают —
 * контакты, каналы, начало переписки. Состояние радио живёт в
 * mesh-connection-store; здесь — выбор устройства и действия страницы.
 */

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { appToast } from '@/b-components/app-toast'
import { useMessengerStore } from '@/b-components/messenger/store'
import { NUS_SERVICE, DEFAULT_TCP_PORT } from '@/mesh/meshcore/constants'
import type { McContact } from '@/mesh/meshcore/codec'
import type { SessionChannel } from '@/mesh/meshcore/session'
import { radioAvailability, targetLabel, type MeshTarget } from '@/mesh/radio/open-link'
import { listSerialPorts, scanBle } from '@/mesh/radio/tauri-radio'
import { radioErrorFrom, type BleDeviceInfo, type SerialPortInfo } from '@/mesh/radio/types'
import { useMeshChatStore } from '@/mesh/store/mesh-chat-store'
import { meshErrorCode, useMeshConnectionStore } from '@/mesh/store/mesh-connection-store'

export type TransportTab = 'serial' | 'ble' | 'tcp'

/** Текст ошибки радио: известный код — своим текстом, прочие — общим. */
export function useMeshErrorText() {
  const { t, te } = useI18n()
  return (code: string | null | undefined): string => {
    if (!code) return ''
    const key = `mesh.errors.${code}`
    return te(key) ? t(key) : t('mesh.errors.generic', { code })
  }
}

export function useMeshConnect() {
  const connection = useMeshConnectionStore()
  const { status, lastDevice } = storeToRefs(connection)
  const errorText = useMeshErrorText()
  const availability = radioAvailability()

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
      devices.value = await scanBle(all ? [] : [NUS_SERVICE], 5000)
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
    String(lastDevice.value?.transport === 'tcp' ? lastDevice.value.port : DEFAULT_TCP_PORT)
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

/** Открыть переписку в мессенджере — из контакта или канала на этой странице. */
export function useMeshOpenChat() {
  const connection = useMeshConnectionStore()
  const meshChat = useMeshChatStore()
  const messenger = useMessengerStore()

  async function openDialog(id: string): Promise<void> {
    await messenger.openMessenger()
    await messenger.openChat(id)
  }

  async function writeTo(contact: McContact): Promise<void> {
    const self = connection.self
    if (!self) return
    await openDialog(await meshChat.ensureDirectDialog(self.publicKey, contact))
  }

  async function openChannel(channel: SessionChannel): Promise<void> {
    const self = connection.self
    if (!self) return
    await openDialog(await meshChat.ensureChannelDialog(self.publicKey, channel))
  }

  return { writeTo, openChannel }
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
