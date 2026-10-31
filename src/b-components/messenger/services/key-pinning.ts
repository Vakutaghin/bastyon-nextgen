// Пиннинг ключей собеседников (TOFU) — аудит P3-3.
//
// Ключи шифрования мессенджера (`profile.k`) приходят из on-chain профиля через
// RPC-ноду. Нода — доверенная сторона: она может подменить `k` и подставить
// свой ключ в новый диалог (MITM). Защита: запоминаем ключи собеседника при
// первом использовании и предупреждаем, если они ИЗМЕНИЛИСЬ. В Bastyon `k`
// детерминированно выводится из приватного ключа аккаунта, поэтому легитимная
// смена — событие исключительное.
//
// Хранение: localStorage `BST_MSG_KEYPINS_<owner>` → { [peerAddress]: keys }.
// Namespace по владельцу — набор собеседников не должен светиться другому
// аккаунту на том же устройстве; при signOut все пины стираются
// (clearAllUserData). Ключи не секрет (публичные), хранятся как есть.

import { MESSENGER_KEY_PINS_PREFIX } from '@/blockchain/constants/storage'

export const KEY_PINS_PREFIX = MESSENGER_KEY_PINS_PREFIX

export type PinCheck = 'pinned' | 'match' | 'changed'

type PinMap = Record<string, string>

/** Нормализация `k`: обрезаем пробелы, выкидываем пустые, порядок сохраняем. */
export function normalizeKeys(keys: string): string {
  return keys
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .join(',')
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/**
 * Последние разобранные пины. Их читают на каждого участника каждой
 * расшифровки в группе, а это JSON на сотни собеседников: разбор заново —
 * секунды главного потока на одно сообщение группы. Сверка с сырой строкой
 * держит кэш верным, кто бы её ни поменял (выход из аккаунтов, другая вкладка).
 */
let parsedPins: { owner: string; raw: string; pins: PinMap } | null = null

function readPins(owner: string): PinMap {
  const raw = storage()?.getItem(KEY_PINS_PREFIX + owner)
  if (!raw) return {}
  if (parsedPins?.owner === owner && parsedPins.raw === raw) return parsedPins.pins
  try {
    const parsed = JSON.parse(raw) as unknown
    const pins = parsed && typeof parsed === 'object' ? (parsed as PinMap) : {}
    parsedPins = { owner, raw, pins }
    return pins
  } catch {
    return {}
  }
}

function writePins(owner: string, pins: PinMap): void {
  const raw = JSON.stringify(pins)
  try {
    storage()?.setItem(KEY_PINS_PREFIX + owner, raw)
    parsedPins = { owner, raw, pins }
  } catch {
    /* quota/приватный режим — пиннинг best-effort */
    parsedPins = null
  }
}

/**
 * Сверяет ключи собеседника с закреплёнными. Первое появление — закрепляем
 * ('pinned'); совпали — 'match'; отличаются — 'changed' (старый пин НЕ
 * перезаписывается, пока пользователь явно не примет новый ключ).
 */
export function checkPeerKeys(owner: string, peer: string, keys: string): PinCheck {
  const normalized = normalizeKeys(keys)
  if (!owner || !peer || !normalized) return 'match'
  const pins = readPins(owner)
  const pinned = pins[peer]
  if (!pinned) {
    pins[peer] = normalized
    writePins(owner, pins)
    return 'pinned'
  }
  return pinned === normalized ? 'match' : 'changed'
}

/** Пользователь осознанно принял новые ключи собеседника. */
export function acceptPeerKeys(owner: string, peer: string, keys: string): void {
  const normalized = normalizeKeys(keys)
  if (!owner || !peer || !normalized) return
  const pins = readPins(owner)
  pins[peer] = normalized
  writePins(owner, pins)
}

/** Закреплённые ключи собеседника (null — ещё не видели). */
export function getPinnedKeys(owner: string, peer: string): string | null {
  return readPins(owner)[peer] ?? null
}

/** Снимает ВСЕ пины всех владельцев (signOut / очистка данных устройства). */
export function clearAllKeyPins(): void {
  const s = storage()
  if (!s) return
  const doomed: string[] = []
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i)
    if (k && k.startsWith(KEY_PINS_PREFIX)) doomed.push(k)
  }
  doomed.forEach((k) => s.removeItem(k))
}
