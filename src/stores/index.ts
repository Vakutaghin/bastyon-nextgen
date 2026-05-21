/**
 * Централизованный экспорт всех Pinia stores
 */

export { useModalStore } from './modal-store'
export { useSearchStore } from './search-store'
export { useFiltersStore } from './filters-store'
export { usePostsStore } from './posts-store'
export { useUIStore } from './ui-store'
export { useVideoPlayerStore } from '@/b-components/content/video-player/store'
export { useAuthStore } from '@/blockchain/store/auth-store'
export { usePendingRatingsStore } from './pending-ratings-store'
export { useCommentsStore } from './comments-store'
export type { PendingComment } from './comments-store'
export { useNotificationsStore } from './notifications-store'
export { useNotificationSettingsStore } from './notification-settings-store'
export { useTorStore } from './tor-store'
export type {
  TorStatus,
  TorBridgeKind,
  TorStateSnapshot,
  TorInstallProgress,
} from './tor-store'
