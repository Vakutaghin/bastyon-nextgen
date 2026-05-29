/**
 * Навигация по выбранному результату в header-search dropdown.
 * Каждый `onSelect*` коммитит выбор в `useSearchStore`, эмитит `close`
 * и переходит роутером в нужный раздел. Дополнительно — текстовые утилиты
 * для отображения.
 *
 * См. CODE_AUDIT.md §1.
 */
import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import { useSearchStore } from '@/stores/search-store'
import { useAppsStore } from '@/mini-apps/store/apps-store'
import { safeDecode } from '@/composables/use-feed'
import type { RemoteAppEntry } from '@/mini-apps/registry/remote-registry'
import type { SearchUserResult } from '@/types/rpc-responses/search-users'
import type { SearchPost } from '@/types/rpc-responses/search-posts'
import type { SearchTag } from '@/types/rpc-responses/search-tags'

export interface SearchNavigation {
  onSelectUser: (u: SearchUserResult) => void
  onSelectTag: (t: SearchTag) => void
  onSelectPost: (p: SearchPost) => void
  onSelectApp: (entry: RemoteAppEntry) => void
  onSeeAll: (type: 'users' | 'tags' | 'posts') => void
  initialOf: (u: SearchUserResult) => string
  initialOfApp: (name: string) => string
  postTitle: (p: SearchPost) => string
  truncate: (text: string, max: number) => string
}

export function useSearchNavigation(
  router: Router,
  query: Ref<string>,
  emitClose: () => void
): SearchNavigation {
  const searchStore = useSearchStore()
  const appsStore = useAppsStore()

  function commitAndClose(): string {
    const value = searchStore.commit(query.value)
    emitClose()
    return value
  }

  function onSelectUser(u: SearchUserResult): void {
    searchStore.commitUser(u.address, u.name, u.i)
    emitClose()
    router.push({ name: 'profile', params: { userName: u.address } })
  }

  function onSelectTag(t: SearchTag): void {
    searchStore.commitTag(t.tag)
    emitClose()
    router.push({ path: '/search', query: { q: `#${t.tag}`, type: 'posts' } })
  }

  function onSelectPost(p: SearchPost): void {
    const value = commitAndClose()
    router.push({ path: '/search', query: { q: value, type: 'posts', focus: p.txid || p.hash } })
  }

  function onSelectApp(entry: RemoteAppEntry): void {
    // Открываем mini-app по той же схеме, что и mini-apps-grid:
    // если приложение ещё не установлено — регистрируем его в локальном
    // сторе, затем переходим на /app/<id>.
    appsStore.installFromRemoteEntry(entry)
    searchStore.commitApp(entry.id, entry.name, entry.icon)
    emitClose()
    router.push(`/app/${encodeURIComponent(entry.id)}`)
  }

  function onSeeAll(type: 'users' | 'tags' | 'posts'): void {
    const value = commitAndClose()
    if (!value) return
    router.push({ path: '/search', query: { q: value, type } })
  }

  function initialOf(u: SearchUserResult): string {
    const src = u.name || u.address
    return (src?.[0] ?? '?').toUpperCase()
  }

  function initialOfApp(name: string): string {
    return (name?.[0] ?? '?').toUpperCase()
  }

  function truncate(text: string, max: number): string {
    if (!text) return ''
    return text.length > max ? text.slice(0, max - 1) + '…' : text
  }

  function postTitle(p: SearchPost): string {
    // Поля `c` и `m` приходят URL-encoded — без декода в UI получаются
    // кракозябры (см. safeDecode в use-feed.ts, используется в adaptPostData).
    const caption = safeDecode(p.c || '')
    if (caption) return caption
    const message = safeDecode(p.m || '')
    if (message) return message.slice(0, 80)
    return p.txid || 'Пост'
  }

  return {
    onSelectUser,
    onSelectTag,
    onSelectPost,
    onSelectApp,
    onSeeAll,
    initialOf,
    initialOfApp,
    postTitle,
    truncate,
  }
}
