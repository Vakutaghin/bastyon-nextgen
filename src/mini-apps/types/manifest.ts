/**
 * Парсер и схема манифеста мини-приложения (`b_manifest.json`).
 *
 * Контракт совместимости — см. §0.4 в `_DOCS/MINIAPPS_PLAN.md`.
 * Исходное поведение legacy — [index.js:11-60](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L11-L60).
 *
 * Отличия от legacy:
 * - `develop` по умолчанию `false` (legacy дефолтил в `true` — это считается багом
 *   и для новых манифестов небезопасно). Старые манифесты с явным `develop: true`
 *   парсятся как раньше.
 * - Все длиннотекстовые поля ограничены по длине (защита от raw-JSON-bomb).
 * - XSS-санитизация — нормализация строк, без зависимости от DOMPurify
 *   (текст в Vue экранируется автоматически в `{{ }}`).
 */

import { z } from 'zod'
import { isValidAddress } from '@/blockchain'
import { PERMISSION_IDS, type PermissionId } from './permissions'

const MAX_NAME = 64
const MAX_DESCRIPTION = 2000
const MAX_VERSION = 32
const MAX_ID = 128
const MAX_SCOPE = 256
const MAX_START_URL = 512

// Hard caps на сырые JSON-строки — защита от raw-bomb. Реальные лимиты
// длины полей применяются ниже в `normalizeText` (с truncate, как в legacy).
const HARD_MAX = 64 * 1024 // 64 KB любого текстового поля — заведомо больше любого ожидаемого

/**
 * Сырая схема того, что приходит в `b_manifest.json`.
 * Допускает legacy-форму с лишними/нестрогими полями. Реальная санитизация
 * длины — в `parseManifestObject` через `normalizeText`.
 */
const RawManifestSchema = z
  .object({
    id: z.string().min(1).max(HARD_MAX),
    name: z.string().min(1).max(HARD_MAX),
    version: z.string().min(1).max(HARD_MAX).optional(),
    description: z.string().max(HARD_MAX).optional(),
    descriptions: z.record(z.string().length(2), z.string().max(HARD_MAX)).optional(),
    author: z.string().min(1),
    scope: z.string().max(HARD_MAX).optional(),
    start_url: z.string().max(HARD_MAX).optional(),
    develop: z.boolean().optional(),
    permissions: z.array(z.string()).max(64).optional(),
    // Allowlist хостов для fetch-tunnel (core/fetch-tunnel.ts). Только origin
    // (схема + host), без пути. Пример: "https://api.example.com".
    // Если отсутствует — fetch-tunnel отвергает все запросы.
    fetch_hosts: z.array(z.string().max(512)).max(32).optional(),
  })
  .passthrough()

export type RawManifest = z.infer<typeof RawManifestSchema>

export interface ParsedManifest {
  readonly id: string
  readonly name: string
  /** Числовое представление версии для сравнения (как legacy `numfromreleasestring`). */
  readonly version: number
  /** Оригинальная строка версии для UI. */
  readonly versionText: string
  readonly description: string
  /** Локализованные описания, ключ — двухсимвольный locale. */
  readonly descriptions: Readonly<Record<string, string>>
  readonly author: string
  readonly scope?: string
  readonly startUrl?: string
  readonly develop: boolean
  readonly permissions: readonly PermissionId[]
  /**
   * Allowlist хостов (origin: `https://host[:port]`) для fetch-tunnel.
   * Пустой массив или отсутствие → fetch-tunnel недоступен этому приложению.
   */
  readonly fetchHosts: readonly string[]
}

export class ManifestParseError extends Error {
  constructor(
    public readonly code: ManifestErrorCode,
    public readonly hint?: string
  ) {
    super(code)
    this.name = 'ManifestParseError'
  }
}

export type ManifestErrorCode =
  | 'broken:manifest'
  | 'missing:id'
  | 'missing:name'
  | 'missing:version'
  | 'missing:description'
  | 'broken:author'
  | 'broken:permissions'

/**
 * Конвертирует строку версии типа `1.2.3` в число для сравнения.
 * Legacy эквивалент: `numfromreleasestring`.
 * `1.2.3` → `1*1e6 + 2*1e3 + 3 = 1002003`.
 */
export function versionToNumber(version: string): number {
  const parts = version.split('.').map((p) => Number.parseInt(p, 10))
  if (parts.some((n) => !Number.isFinite(n))) return 0
  const [major = 0, minor = 0, patch = 0] = parts
  return major * 1_000_000 + minor * 1_000 + patch
}

/** Удаляет управляющие символы и нормализует пробелы. Не трогает Unicode-текст. */
function normalizeText(input: string, maxLen: number): string {
  /* eslint-disable-next-line no-control-regex -- intentionally stripping C0/DEL control chars */
  const stripControls = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
  return input.replace(stripControls, '').trim().slice(0, maxLen)
}

/** Чистит `id` мини-приложения: только `[a-z0-9.]`. */
function normalizeId(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .slice(0, MAX_ID)
}

/** Чистит permission id — формат тот же что и app id. */
function normalizePermissionId(p: string): string {
  return p.toLowerCase().replace(/[^a-z0-9.]/g, '')
}

/**
 * Парсит сырую строку манифеста (содержимое `b_manifest.json`).
 *
 * @throws {ManifestParseError} если структура невалидна или обязательные поля отсутствуют.
 */
export function parseManifest(json: string): ParsedManifest {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new ManifestParseError('broken:manifest')
  }

  const result = RawManifestSchema.safeParse(raw)
  if (!result.success) {
    // Различаем missing:id / missing:name / broken:manifest по issues
    const firstIssue = result.error.issues[0]
    if (firstIssue) {
      const path = firstIssue.path.join('.')
      if (path === 'id') throw new ManifestParseError('missing:id')
      if (path === 'name') throw new ManifestParseError('missing:name')
    }
    throw new ManifestParseError('broken:manifest', firstIssue?.message)
  }

  return parseManifestObject(result.data)
}

/** Внутренний хелпер: парсит уже распарсенный JSON. Используется в тестах напрямую. */
export function parseManifestObject(raw: RawManifest): ParsedManifest {
  const id = normalizeId(raw.id)
  if (!id) throw new ManifestParseError('missing:id')

  const name = normalizeText(raw.name, MAX_NAME)
  if (!name) throw new ManifestParseError('missing:name')

  const versionText = raw.version ? normalizeText(raw.version, MAX_VERSION) : '1.0.0'
  const version = versionToNumber(versionText)
  if (!version) throw new ManifestParseError('missing:version')

  const description = raw.description ? normalizeText(raw.description, MAX_DESCRIPTION) : ''
  const descriptions: Record<string, string> = {}
  if (raw.descriptions) {
    for (const [locale, text] of Object.entries(raw.descriptions)) {
      if (typeof text !== 'string') continue
      descriptions[locale.toLowerCase()] = normalizeText(text, MAX_DESCRIPTION)
    }
  }

  if (!description && !descriptions.en) {
    throw new ManifestParseError('missing:description')
  }

  if (!raw.author || !isValidAddress(raw.author)) {
    throw new ManifestParseError('broken:author')
  }

  const permissions: PermissionId[] = []
  for (const p of raw.permissions ?? []) {
    const normalized = normalizePermissionId(p)
    if (!normalized) throw new ManifestParseError('broken:permissions')
    if ((PERMISSION_IDS as readonly string[]).includes(normalized)) {
      permissions.push(normalized as PermissionId)
    }
    // Неизвестные permissions молча игнорируем (как legacy — он их просто не находит при проверке).
  }

  const fetchHosts: string[] = []
  for (const raw_origin of raw.fetch_hosts ?? []) {
    if (typeof raw_origin !== 'string') continue
    const trimmed = raw_origin.trim()
    if (!trimmed) continue
    try {
      const u = new URL(trimmed)
      // Только https/http origin. Без пути.
      if (u.protocol !== 'https:' && u.protocol !== 'http:') continue
      fetchHosts.push(u.origin)
    } catch {
      // Невалидный URL — молча игнорируем (так же как с permissions).
    }
  }

  return {
    id,
    name,
    version,
    versionText,
    description,
    descriptions,
    author: raw.author,
    scope: raw.scope ? normalizeText(raw.scope, MAX_SCOPE) : undefined,
    startUrl: raw.start_url ? normalizeText(raw.start_url, MAX_START_URL) : undefined,
    develop: raw.develop === true,
    permissions,
    fetchHosts,
  }
}
