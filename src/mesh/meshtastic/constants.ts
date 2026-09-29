/**
 * Константы клиентского API Meshtastic (прошивка 2.x). Без импорта
 * протобуфов: этот модуль берут интерфейс и сторы, а сами протобуфы грузятся
 * только при подключении радио.
 *
 * Источник — прошивка meshtastic/firmware 2.7.26: src/mesh/StreamAPI.cpp
 * (кадр), src/nimble/NimbleBluetooth.cpp (BLE), src/mesh/PhoneAPI.cpp
 * (рукопожатие).
 */

/** Кадр по serial и TCP: START1 START2 длина (uint16 BE) protobuf. */
export const START1 = 0x94
export const START2 = 0xc3
/** Больше ToRadio/FromRadio прошивка не принимает и не шлёт. */
export const MAX_PACKET_SIZE = 512

export const DEFAULT_TCP_PORT = 4403
export const DEFAULT_BAUD = 115_200

/** Адрес «всем» — сообщение в канал. */
export const BROADCAST_NUM = 0xffff_ffff

/** GATT-сервис и характеристики радио. */
export const BLE_SERVICE = '6ba1b218-15a8-461f-9fa8-5dcae273eafd'
export const BLE_TO_RADIO = 'f75c76d2-129e-4dad-a1dd-7866124401e7'
export const BLE_FROM_RADIO = '2c55e69e-4993-11ed-b878-0242ac120002'
export const BLE_FROM_NUM = 'ed9da18c-a800-4f66-a670-aa7547e34453'

/**
 * Текст одного сообщения, байт UTF-8. Прошивка вмещает до 233 байт полезной
 * нагрузки, но шифрование ЛС (PKI) и поля пакета съедают часть — официальные
 * приложения режут текст на 200 байтах, и так же делаю я.
 */
export const MAX_TEXT_BYTES = 200

/** Имя узла: длинное — до 39 байт, короткое — до 4 (User в mesh.options). */
export const MAX_LONG_NAME_BYTES = 39
export const MAX_SHORT_NAME_BYTES = 4

/** Имя канала — до 11 байт (ChannelSettings.name в channel.options). */
export const MAX_CHANNEL_NAME_BYTES = 11

/** Слотов каналов на радио: 0 — основной, 1–7 — дополнительные. */
export const CHANNEL_SLOTS = 8

/** Регион не выбран: радио молчит, пока его не зададут. */
export const REGION_UNSET = 0

/**
 * Регионы, которые предлагаю выбрать (RegionCode в config.proto). Полный
 * список длиннее; редкие показываются по коду.
 */
export const REGION_CHOICES: ReadonlyArray<{ code: number; id: string }> = [
  { code: 9, id: 'RU' },
  { code: 3, id: 'EU_868' },
  { code: 2, id: 'EU_433' },
  { code: 1, id: 'US' },
  { code: 14, id: 'UA_433' },
  { code: 15, id: 'UA_868' },
  { code: 23, id: 'KZ_433' },
  { code: 24, id: 'KZ_863' },
  { code: 4, id: 'CN' },
  { code: 5, id: 'JP' },
  { code: 6, id: 'ANZ' },
  { code: 7, id: 'KR' },
  { code: 8, id: 'TW' },
  { code: 10, id: 'IN' },
  { code: 11, id: 'NZ_865' },
  { code: 12, id: 'TH' },
  { code: 16, id: 'MY_433' },
  { code: 17, id: 'MY_919' },
  { code: 18, id: 'SG_923' },
  { code: 26, id: 'BR_902' },
  { code: 13, id: 'LORA_24' },
]

/**
 * Пресеты модема (ModemPreset). Имя — как его показывает прошивка: пустое
 * имя основного канала превращается в имя пресета.
 */
export const MODEM_PRESETS: ReadonlyArray<{ code: number; name: string }> = [
  { code: 0, name: 'LongFast' },
  { code: 7, name: 'LongMod' },
  { code: 1, name: 'LongSlow' },
  { code: 2, name: 'VLongSlow' },
  { code: 3, name: 'MediumSlow' },
  { code: 4, name: 'MediumFast' },
  { code: 5, name: 'ShortSlow' },
  { code: 6, name: 'ShortFast' },
  { code: 8, name: 'ShortTurbo' },
  { code: 9, name: 'LongTurbo' },
]

export function presetName(code: number): string {
  return MODEM_PRESETS.find((p) => p.code === code)?.name ?? 'Custom'
}

/** Сколько ждать ответа на рукопожатие (конфиг, каналы, все узлы). */
export const CONFIG_TIMEOUT_MS = 30_000
/** Раз в сколько слать heartbeat, чтобы радио не закрыло сеанс. */
export const HEARTBEAT_MS = 60_000
