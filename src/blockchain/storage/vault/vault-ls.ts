// Низкоуровневый доступ к localStorage для vault-слоя: безопасен к отсутствию
// (SSR/приватный режим) и к бросающим реализациям. Общий примитив для
// vault-envelope-store, vault-attempts и стейт-машины crypto-vault.

export function ls(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

export function lsRemove(key: string): void {
  try {
    ls()?.removeItem(key)
  } catch {
    /* ignore */
  }
}
