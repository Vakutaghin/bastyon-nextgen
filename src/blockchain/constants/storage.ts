/**
 * Константы для хранилища
 */

/**
 * Ключ для хранения мнемоники в localStorage/sessionStorage
 */
export const MNEMONIC_STORAGE_KEY = 'BST_MNEMONIC'

/**
 * Ключ для хранения адреса пользователя
 */
export const USER_ADDRESS_STORAGE_KEY = 'BST_USER_ADDRESS'

/**
 * Ключ для флага "был авторизован"
 */
export const WAS_LOGGED_KEY = 'BST_WAS_LOGGED'

/**
 * Ключ для device fingerprint
 */
export const DEVICE_FINGERPRINT_KEY = 'BST_DEVICE_FINGERPRINT'

/**
 * Конверт сейфа (P0-1): обёрнутый секрет S + метаданные режима (device/passphrase).
 * Хранится открытым — шифротекст бесполезен без device-ключа (IndexedDB) или passphrase.
 * См. src/blockchain/storage/vault/crypto-vault.ts.
 */
export const VAULT_ENVELOPE_KEY = 'BST_VAULT'
/** Байт-в-байт зеркало BST_VAULT — фолбэк при повреждении первичного конверта. */
export const VAULT_ENVELOPE_BACKUP_KEY = 'BST_VAULT_BACKUP'
/** Транзиентный маркер незавершённой миграции/enable/disable passphrase (crash-safety). */
export const VAULT_MIGRATION_KEY = 'BST_VAULT_MIGRATION'
/** Транзиентный счётчик неверных попыток passphrase (троттлинг; не секрет). */
export const VAULT_ATTEMPTS_KEY = 'BST_VAULT_ATTEMPTS'

/** Префикс пинов ключей собеседников мессенджера (TOFU): `BST_MSG_KEYPINS_<ownAddress>`. */
export const MESSENGER_KEY_PINS_PREFIX = 'BST_MSG_KEYPINS_'

/** Отметка «бэкап 12 слов проверен»: `BST_BACKUP_VERIFIED_<address>` = timestamp (мс). */
export const BACKUP_VERIFIED_PREFIX = 'BST_BACKUP_VERIFIED_'
/** Когда в последний раз показывали напоминание о бэкапе (timestamp, мс). */
export const BACKUP_NUDGED_AT_KEY = 'BST_BACKUP_NUDGED_AT'

/**
 * Пользовательские данные вне `BST_*`, которые тоже обязаны уходить при
 * выходе (аудит V14): OAuth-токены PeerTube `token_<address>_<host>`
 * (access+refresh — доступ к каналу пользователя), resume-состояние загрузок
 * `resumable_<host>_<address>_<key>`, черновик поста `bastyon_post_draft` и
 * черновики комментариев `bastyon_comment_draft:<postId>` (текст следующему
 * аккаунту на устройстве не принадлежит).
 */
export const PEERTUBE_TOKEN_PREFIX = 'token_'
export const PEERTUBE_RESUME_PREFIX = 'resumable_'
export const POST_DRAFT_KEY = 'bastyon_post_draft'
export const COMMENT_DRAFT_PREFIX = 'bastyon_comment_draft:'

/**
 * Ключ для громкости видео плеера
 */
export const VIDEO_PLAYER_VOLUME_KEY = 'BST_VIDEO_PLAYER_VOLUME'

/**
 * Префикс ключа для флага показа сид-фразы
 */
export const NEED_SHOW_KEY_PREFIX = 'BST_NEED_SHOW_KEY_'

/**
 * Ключ для капчи
 */
export const CAPTCHA_STORAGE_KEY = 'BST_CAPTCHA'

/**
 * Префикс ключа для хранения данных аккаунта
 */
export const ACCOUNT_STORAGE_PREFIX = 'BST_ACCOUNT_'

/**
 * Префикс ключа для хранения позиции скролла
 */
export const SCROLL_POSITION_PREFIX = 'BST_SCROLL_POSITION_'

/**
 * Ключ для хранения позиции скролла модального окна поста
 */
export const POST_MODAL_SCROLL_POSITION_KEY = 'BST_POST_MODAL_SCROLL_POSITION'

/** Префикс ключа для списка адресов кошелька (как в старом приложении: wallets2) */
export const WALLET_ADDRESSES_PREFIX = 'BST_WALLET_ADDRS_'

/** Ключ для списка дополнительных кошельков (адреса от индекса 1 и далее). Значение: JSON Record<address, string[]> */
export const ADDITIONAL_WALLETS_LIST_KEY = 'BST_ADDITIONAL_WALLETS_LIST'

/**
 * Локальные ярлыки кошельков (только косметика). Значение: JSON
 * Record<accountAddress, Record<walletAddress, label>>. Ярлыки хранятся отдельно
 * от derivation-критичного списка адресов — на восстановление по мнемонике не
 * влияют (адреса детерминированы, ярлыки локальны и при recovery теряются).
 */
export const WALLET_LABELS_KEY = 'BST_WALLET_LABELS'

/**
 * Незавершённая регистрация: `{ nickname, address, step, timestamp }` и
 * дублирующий ник для быстрого чтения. Чистятся в clearAllUserData и при
 * удалении своего аккаунта (аудит V8/X10).
 */
export const PENDING_REGISTRATION_KEY = 'pending_registration'
export const PENDING_NICKNAME_KEY = 'pending_nickname'
