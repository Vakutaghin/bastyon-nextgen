/**
 * Транспорт до LoRa-радио — то, что протоколам (MeshCore, дальше Meshtastic)
 * нужно от платформы. Две формы:
 *
 * - `ByteLink` — поток байтов (USB-serial, TCP): кадры протокол режет сам;
 * - `GattLink` — Bluetooth LE: запись, чтение и уведомления характеристик.
 *   Протоколы пользуются GATT по-разному (MeshCore — кадр на запись,
 *   Meshtastic — вычитывание fromRadio по уведомлению), поэтому наружу
 *   отдаются примитивы, а не поток.
 *
 * Реализации: Tauri (Rust, ./tauri-radio.ts) и браузер (Web Serial, Web
 * Bluetooth — ./web-radio.ts).
 */

export type RadioLinkKind = 'serial' | 'tcp' | 'ble'

export type Unsubscribe = () => void

/** Причина, по которой соединение пропало само (не по `close()`). */
export type CloseReason = string | null

export interface ByteLink {
  readonly kind: 'serial' | 'tcp'
  /** Подпись для интерфейса: порт, адрес. */
  readonly label: string
  write(data: Uint8Array): Promise<void>
  onData(cb: (data: Uint8Array) => void): Unsubscribe
  onClose(cb: (reason: CloseReason) => void): Unsubscribe
  close(): Promise<void>
}

export interface GattLink {
  readonly kind: 'ble'
  readonly label: string
  write(characteristic: string, data: Uint8Array, withResponse?: boolean): Promise<void>
  read(characteristic: string): Promise<Uint8Array>
  /** Включить уведомления. Колбэк получает каждое значение. */
  subscribe(characteristic: string, cb: (data: Uint8Array) => void): Promise<Unsubscribe>
  onClose(cb: (reason: CloseReason) => void): Unsubscribe
  close(): Promise<void>
}

export type RadioLink = ByteLink | GattLink

/** Порт USB-serial в системе. */
export interface SerialPortInfo {
  path: string
  kind: 'usb' | 'bluetooth' | 'pci' | 'unknown'
  vid?: number | null
  pid?: number | null
  manufacturer?: string | null
  product?: string | null
  serialNumber?: string | null
}

/** Устройство, найденное сканированием BLE. */
export interface BleDeviceInfo {
  id: string
  name: string | null
  rssi: number | null
  services: string[]
}

/**
 * Ошибка транспорта с кодом из Rust («код: подробности») или браузера. Код
 * переводит интерфейс (`mesh.errors.<code>`).
 */
export class RadioError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'RadioError'
  }
}

/** Разобрать «код: подробности» из ответа команды. */
export function radioErrorFrom(error: unknown): RadioError {
  if (error instanceof RadioError) return error
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const colon = raw.indexOf(':')
  const code = (colon === -1 ? raw : raw.slice(0, colon)).trim()
  return new RadioError(/^[a-z_]+$/.test(code) ? code : 'radio_error', raw)
}
