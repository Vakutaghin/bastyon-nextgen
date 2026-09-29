/**
 * Протокол companion-радио MeshCore: коды и размеры.
 *
 * Сверено с прошивкой meshcore-dev/MeshCore (main, 20.09.2026):
 * examples/companion_radio/MyMesh.cpp, src/MeshCore.h, src/helpers/*. Там, где
 * docs/companion_protocol.md расходится с прошивкой, прав код прошивки:
 * - отправка в канал отвечает RESP_OK, а не RESP_SENT;
 * - PUSH_SEND_CONFIRMED — 4 байта ACK и 4 байта времени пути, а не 6 байт.
 */

export const CMD = {
  APP_START: 1,
  SEND_TXT_MSG: 2,
  SEND_CHANNEL_TXT_MSG: 3,
  GET_CONTACTS: 4,
  GET_DEVICE_TIME: 5,
  SET_DEVICE_TIME: 6,
  SEND_SELF_ADVERT: 7,
  SET_ADVERT_NAME: 8,
  ADD_UPDATE_CONTACT: 9,
  SYNC_NEXT_MESSAGE: 10,
  RESET_PATH: 13,
  REMOVE_CONTACT: 15,
  GET_BATT_AND_STORAGE: 20,
  DEVICE_QUERY: 22,
  /** Вход в комнату (room server) или на репитер: ключ и пароль. */
  SEND_LOGIN: 26,
  GET_CONTACT_BY_KEY: 30,
  GET_CHANNEL: 31,
  SET_CHANNEL: 32,
} as const

export const RESP = {
  OK: 0,
  ERR: 1,
  CONTACTS_START: 2,
  CONTACT: 3,
  END_OF_CONTACTS: 4,
  SELF_INFO: 5,
  SENT: 6,
  CONTACT_MSG_RECV: 7,
  CHANNEL_MSG_RECV: 8,
  CURR_TIME: 9,
  NO_MORE_MESSAGES: 10,
  BATT_AND_STORAGE: 12,
  DEVICE_INFO: 13,
  DISABLED: 15,
  CONTACT_MSG_RECV_V3: 16,
  CHANNEL_MSG_RECV_V3: 17,
  CHANNEL_INFO: 18,
  CHANNEL_DATA_RECV: 27,
} as const

/** Уведомления, которые радио шлёт само, в любой момент. */
export const PUSH = {
  ADVERT: 0x80,
  PATH_UPDATED: 0x81,
  SEND_CONFIRMED: 0x82,
  MSG_WAITING: 0x83,
  LOGIN_SUCCESS: 0x85,
  LOGIN_FAIL: 0x86,
  LOG_RX_DATA: 0x88,
  NEW_ADVERT: 0x8a,
  CONTACT_DELETED: 0x8f,
  CONTACTS_FULL: 0x90,
} as const

export const ERR_CODE = {
  UNSUPPORTED_CMD: 1,
  NOT_FOUND: 2,
  TABLE_FULL: 3,
  BAD_STATE: 4,
  FILE_IO_ERROR: 5,
  ILLEGAL_ARG: 6,
} as const

export const TXT_TYPE = {
  PLAIN: 0,
  CLI_DATA: 1,
  SIGNED_PLAIN: 2,
} as const

/** Тип узла из его объявления (advert). */
export const ADV_TYPE = {
  NONE: 0,
  CHAT: 1,
  REPEATER: 2,
  ROOM: 3,
  SENSOR: 4,
} as const

export const PUB_KEY_SIZE = 32
export const MAX_PATH_SIZE = 64
/** Больше кадр радио не примет и не пришлёт. */
export const MAX_FRAME_SIZE = 176
/** Текст сообщения — в байтах UTF-8, не в символах. */
export const MAX_TEXT_LEN = 160
export const OUT_PATH_UNKNOWN = 0xff
/** Размер имени узла и канала в кадрах. */
export const NAME_FIELD_SIZE = 32
export const CHANNEL_SECRET_SIZE = 16

/** Версия протокола, которую понимает приложение: с 3 сообщения несут SNR. */
export const APP_PROTOCOL_VERSION = 3

/** Nordic UART Service: так companion-радио MeshCore работает по BLE. */
export const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
/** Запись: приложение → радио. */
export const NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
/** Уведомления: радио → приложение. */
export const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'

/** Порт companion-радио по Wi-Fi (ESP32). */
export const DEFAULT_TCP_PORT = 5000
export const DEFAULT_BAUD = 115200

/** Ключ канала Public — общеизвестный, сообщения в нём открыты всем. */
export const PUBLIC_CHANNEL_SECRET = '8b3387e9c5cdea6ac9e5edbaa115cd72'

/** Сколько ждать ответа на команду. */
export const COMMAND_TIMEOUT_MS = 5000
