// Что за пункты в раскладке шапки, меню и левой панели: подпись, значок и есть
// ли пункт на этой платформе. Порядок и видимость — в stores/header-layout*.

import { computed, type Component, type ComputedRef } from 'vue'

import {
  AppstoreOutlined,
  BellOutlined,
  BlockOutlined,
  BookOutlined,
  BugOutlined,
  CollectionIcon,
  CategoriesIcon,
  CrownOutlined,
  FeedSettingsIcon,
  FileOutlined,
  FileTextOutlined,
  GlobalOutlined,
  HashtagIcon,
  HelpBookIcon,
  HomeOutlined,
  HourglassOutlined,
  MessageOutlined,
  PageWidthFullIcon,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  RadioTowerIcon,
  SafetyOutlined,
  SettingOutlined,
  SoundOutlined,
  StarOutlined,
  TeamOutlined,
  ThemeLightIcon,
  TrophyOutlined,
  UserOutlined,
  WalletOutlined,
} from '@/components/icons'
import { isTauriEnv } from '@/helpers/api/request-tor'
import { isRadioSupported } from '@/mesh/radio/platform'
import { useHeaderLayoutStore } from '@/stores/header-layout-store'
import {
  DEFAULT_MENU_LAYOUT,
  LOCKED_MENU_ITEMS,
  type HeaderItemId,
  type MenuItemId,
  type SidebarBlockId,
  type SidebarItemId,
} from '@/stores/header-layout'

export interface LayoutItemMeta {
  /** i18n-ключ подписи; у Tor и IPFS — `label`, они не переводятся. */
  labelKey?: string
  label?: string
  icon: Component
}

export const HEADER_ITEMS: Record<HeaderItemId, LayoutItemMeta> = {
  services: { labelKey: 'miniapps.pageTitle', icon: AppstoreOutlined },
  notifications: { labelKey: 'header.notifications', icon: BellOutlined },
  messenger: { labelKey: 'bottomNav.messenger', icon: MessageOutlined },
  tor: { label: 'Tor', icon: SafetyOutlined },
  ipfs: { label: 'IPFS', icon: GlobalOutlined },
  theme: { labelKey: 'settings.layout.itemTheme', icon: ThemeLightIcon },
  pageWidth: { labelKey: 'settings.layout.itemPageWidth', icon: PageWidthFullIcon },
  reportBug: { labelKey: 'header.reportBug', icon: BugOutlined },
}

export const MENU_ITEMS: Record<MenuItemId, LayoutItemMeta> = {
  profile: { labelKey: 'accountMsg.menuProfile', icon: UserOutlined },
  wallets: { labelKey: 'accountMsg.menuWallets', icon: WalletOutlined },
  paidSubscriptions: { labelKey: 'accountMsg.menuPaidSubscriptions', icon: CrownOutlined },
  mediaStudio: { labelKey: 'accountMsg.menuMyVideos', icon: PlayCircleOutlined },
  collections: { labelKey: 'accountMsg.menuCollections', icon: CollectionIcon },
  myFiles: { labelKey: 'accountMsg.menuMyFiles', icon: FileOutlined },
  limits: { labelKey: 'accountMsg.menuLimits', icon: HourglassOutlined },
  mesh: { labelKey: 'accountMsg.menuMesh', icon: RadioTowerIcon },
  help: { labelKey: 'accountMsg.menuHelp', icon: QuestionCircleOutlined },
  reportBug: { labelKey: 'header.reportBug', icon: BugOutlined },
  settings: { labelKey: 'accountMsg.menuSettings', icon: SettingOutlined },
}

/** Значки — те же, что у разделов в самой панели (sidebar-tabs). */
export const SIDEBAR_ITEMS: Record<SidebarItemId, LayoutItemMeta> = {
  feed: { labelKey: 'sidebarData.tabs.feed', icon: HomeOutlined },
  subscriptions: { labelKey: 'sidebarData.tabs.subscriptions', icon: TeamOutlined },
  video: { labelKey: 'sidebarData.tabs.video', icon: PlayCircleOutlined },
  audio: { labelKey: 'sidebarData.tabs.audio', icon: SoundOutlined },
  articles: { labelKey: 'sidebarData.tabs.articles', icon: FileTextOutlined },
  favorites: { labelKey: 'sidebarData.tabs.favorites', icon: BookOutlined },
  collections: { labelKey: 'sidebarData.tabs.collections', icon: CollectionIcon },
  discussed: { labelKey: 'sidebarData.tabs.discussed', icon: StarOutlined },
  miniApps: { labelKey: 'sidebarData.tabs.miniApps', icon: AppstoreOutlined },
  topAccounts: { labelKey: 'sidebarData.tabs.topAccounts', icon: TrophyOutlined },
  explorer: { labelKey: 'sidebarData.tabs.explorer', icon: BlockOutlined },
  help: { labelKey: 'sidebarData.tabs.help', icon: HelpBookIcon },
}

export const SIDEBAR_BLOCKS: Record<SidebarBlockId, LayoutItemMeta> = {
  feedSettings: { labelKey: 'settings.layout.blockFeedSettings', icon: FeedSettingsIcon },
  categories: { labelKey: 'sidebar.categories', icon: CategoriesIcon },
  tags: { labelKey: 'sidebar.trendingTags', icon: HashtagIcon },
}

/** Куда ведут пункты меню; профиль — по имени, его адрес считает меню, «Сообщить об ошибке» — действие. */
export const MENU_ITEM_PATHS: Partial<Record<MenuItemId, string>> = {
  wallets: '/wallets',
  paidSubscriptions: '/paid-subscriptions',
  mediaStudio: '/my-videos',
  collections: '/collections',
  myFiles: '/my-files',
  limits: '/limits',
  mesh: '/mesh',
  help: '/help',
  settings: '/settings',
}

/** Меню по умолчанию на этой платформе — без своей раскладки и без Pinia. */
export function defaultMenuItems(): MenuItemId[] {
  return DEFAULT_MENU_LAYOUT.filter((e) => e.visible && !unavailableReason(e.id)).map((e) => e.id)
}

/** Значки, которые помещаются в тесную шапку телефона; остальное там — в боковом меню. */
export const PHONE_HEADER_ITEMS: readonly HeaderItemId[] = ['notifications', 'theme']

/**
 * Почему пункта здесь нет: i18n-ключ причины или null, если он есть. Tor, IPFS
 * и «Мои файлы» — своя нода, только в приложении для компьютера; радио mesh —
 * ещё и на Android.
 */
export function unavailableReason(
  id: HeaderItemId | MenuItemId | SidebarItemId | SidebarBlockId
): string | null {
  switch (id) {
    case 'tor':
    case 'ipfs':
    case 'myFiles':
      return isTauriEnv() ? null : 'settings.layout.desktopOnly'
    case 'mesh':
      return isRadioSupported() ? null : 'settings.layout.radioOnly'
    default:
      return null
  }
}

export function isLockedMenuItem(id: MenuItemId): boolean {
  return LOCKED_MENU_ITEMS.includes(id)
}

/** Что сейчас показывать: видимые пункты, которые есть на этой платформе, по порядку. */
export function useHeaderLayout(): {
  headerItems: ComputedRef<HeaderItemId[]>
  menuItems: ComputedRef<MenuItemId[]>
  sidebarItems: ComputedRef<SidebarItemId[]>
  sidebarBlocks: ComputedRef<SidebarBlockId[]>
} {
  const layout = useHeaderLayoutStore()
  void layout.ensureLoaded()
  const shown = <Id extends HeaderItemId | MenuItemId | SidebarItemId | SidebarBlockId>(
    list: { id: Id; visible: boolean }[]
  ) => list.filter((e) => e.visible && !unavailableReason(e.id)).map((e) => e.id)
  return {
    headerItems: computed(() => shown(layout.headerLayout)),
    menuItems: computed(() => shown(layout.menuLayout)),
    sidebarItems: computed(() => shown(layout.sidebarLayout)),
    sidebarBlocks: computed(() => shown(layout.blocksLayout)),
  }
}
