// Что за пункты в раскладке шапки и меню: подпись, значок и есть ли пункт на
// этой платформе. Порядок и видимость — в stores/header-layout*.

import { computed, type Component, type ComputedRef } from 'vue'

import {
  AppstoreOutlined,
  BellOutlined,
  BugOutlined,
  CrownOutlined,
  FileOutlined,
  GlobalOutlined,
  HourglassOutlined,
  MessageOutlined,
  PageWidthFullIcon,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  RadioTowerIcon,
  SafetyOutlined,
  SettingOutlined,
  ThemeLightIcon,
  UserOutlined,
  WalletOutlined,
} from '@/components/icons'
import { isTauriEnv } from '@/helpers/api/request-tor'
import { isRadioSupported } from '@/mesh/radio/platform'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import { useHeaderLayoutStore } from '@/stores/header-layout-store'
import {
  DEFAULT_MENU_LAYOUT,
  LOCKED_MENU_ITEMS,
  type HeaderItemId,
  type MenuItemId,
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
  myFiles: { labelKey: 'accountMsg.menuMyFiles', icon: FileOutlined },
  limits: { labelKey: 'accountMsg.menuLimits', icon: HourglassOutlined },
  mesh: { labelKey: 'accountMsg.menuMesh', icon: RadioTowerIcon },
  help: { labelKey: 'accountMsg.menuHelp', icon: QuestionCircleOutlined },
  reportBug: { labelKey: 'header.reportBug', icon: BugOutlined },
  settings: { labelKey: 'accountMsg.menuSettings', icon: SettingOutlined },
}

/** Куда ведут пункты меню; профиль — по имени, его адрес считает меню, «Сообщить об ошибке» — действие. */
export const MENU_ITEM_PATHS: Partial<Record<MenuItemId, string>> = {
  wallets: '/wallets',
  paidSubscriptions: '/paid-subscriptions',
  mediaStudio: '/my-videos',
  myFiles: '/my-files',
  limits: '/limits',
  mesh: '/mesh',
  help: '/help',
  settings: '/settings',
}

/** Меню по умолчанию на этой платформе — без своей раскладки и без Pinia. */
export function defaultMenuItems(messengerEnabled = true): MenuItemId[] {
  return DEFAULT_MENU_LAYOUT.filter(
    (e) => e.visible && !unavailableReason(e.id, messengerEnabled)
  ).map((e) => e.id)
}

/** Значки, которые помещаются в тесную шапку телефона; остальное там — в боковом меню. */
export const PHONE_HEADER_ITEMS: readonly HeaderItemId[] = ['notifications', 'theme']

/**
 * Почему пункта здесь нет: i18n-ключ причины или null, если он есть. Tor, IPFS
 * и «Мои файлы» — своя нода, только в приложении для компьютера; радио mesh —
 * ещё и на Android; чаты и «Сообщить об ошибке» живут в мессенджере.
 */
export function unavailableReason(
  id: HeaderItemId | MenuItemId,
  messengerEnabled: boolean
): string | null {
  switch (id) {
    case 'tor':
    case 'ipfs':
    case 'myFiles':
      return isTauriEnv() ? null : 'settings.layout.desktopOnly'
    case 'mesh':
      return isRadioSupported() ? null : 'settings.layout.radioOnly'
    case 'messenger':
    case 'reportBug':
      return messengerEnabled ? null : 'settings.layout.needsMessenger'
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
} {
  const layout = useHeaderLayoutStore()
  void layout.ensureLoaded()
  const prefs = useAppPreferencesStore()
  const shown = <Id extends HeaderItemId | MenuItemId>(list: { id: Id; visible: boolean }[]) =>
    list
      .filter((e) => e.visible && !unavailableReason(e.id, prefs.messengerEnabled))
      .map((e) => e.id)
  return {
    headerItems: computed(() => shown(layout.headerLayout)),
    menuItems: computed(() => shown(layout.menuLayout)),
  }
}
