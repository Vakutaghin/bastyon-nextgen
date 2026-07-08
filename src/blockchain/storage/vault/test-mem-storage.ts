// Map-backed Storage-заглушка для тестов сейфа. В отличие от helper'а в
// storage-keys.test, реализует length + key(i) — vault-код перечисляет ключи
// BST_ACCOUNT_*. Не .test-файл, чтобы vitest не собирал его как сьют.

export interface MemStorage {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
  clear(): void
  key(i: number): string | null
  readonly length: number
}

export function memStorage(): MemStorage {
  const store = new Map<string, string>()
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    },
  }
}
