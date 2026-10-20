/**
 * Недавние адреса IPFS-браузера: удобство одного человека, поэтому в
 * localStorage этого браузера. Приватные ссылки сюда не попадают — в них ключ.
 */

import type { IpfsTarget } from './ipfs-link'

const STORAGE_KEY = 'ipfs:recent'
export const MAX_RECENT = 8

/** Адрес как в адресной строке: `ipfs://<CID>/путь` или `ipns://<имя>/путь`. */
export function ipfsAddress(target: IpfsTarget): string {
  const path = target.path ? `/${target.path}` : ''
  return `${target.namespace}://${target.root}${path}`
}

export function loadRecent(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT)
      : []
  } catch {
    return []
  }
}

function save(list: string[]): string[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* хранилище недоступно — список живёт до перезагрузки */
  }
  return list
}

/** Адрес — наверх списка, без повторов. */
export function rememberRecent(address: string): string[] {
  return save([address, ...loadRecent().filter((a) => a !== address)].slice(0, MAX_RECENT))
}

export function forgetRecent(address: string): string[] {
  return save(loadRecent().filter((a) => a !== address))
}
