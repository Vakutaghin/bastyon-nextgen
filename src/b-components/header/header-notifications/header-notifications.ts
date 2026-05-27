import { defineComponent, computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Dropdown, Badge, Menu } from 'ant-design-vue'
import {
  BellOutlined,
  EllipsisOutlined,
  StarFilled,
  MessageOutlined,
  UserAddOutlined,
  RetweetOutlined,
  DollarOutlined,
  NotificationOutlined,
  EditOutlined,
} from '@ant-design/icons-vue'
import { SC_NotificationsWrapper } from './styled'
import { useAuthStore, useNotificationsStore } from '@/stores'
import { useModalStore } from '@/stores/modal-store'
import type { NotificationItem } from '@/stores/notifications-store'
import { adaptPostData } from '@/composables/use-feed'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import {
  formatNotificationTime,
  trimText,
  COMMENT_PREVIEW_LIMIT,
  POST_REF_PREVIEW_LIMIT,
} from './helpers/notification-formatter'
import { ICON_BY_TYPE, notificationTypeLabel } from './helpers/notification-type-map'

export const headerNotificationsOptions = defineComponent({
  name: 'HeaderNotifications',
  components: {
    Dropdown,
    Badge,
    // eslint-disable-next-line vue/no-reserved-component-names
    Menu,
    BellOutlined,
    EllipsisOutlined,
    StarFilled,
    MessageOutlined,
    UserAddOutlined,
    RetweetOutlined,
    DollarOutlined,
    NotificationOutlined,
    EditOutlined,
    SC_NotificationsWrapper,
  },
  setup() {
    const authStore = useAuthStore()
    const notificationsStore = useNotificationsStore()
    const modalStore = useModalStore()
    const router = useRouter()

    const runInit = () => {
      if (authStore.isUserAuthenticated && authStore.getUserAddress) {
        notificationsStore.init()
      }
    }

    onMounted(runInit)

    watch(
      () => authStore.isUserAuthenticated && authStore.getUserAddress,
      (authenticated) => {
        if (authenticated) runInit()
      }
    )

    const visible = ref(false)
    const expandedIds = ref(new Set<string>())
    const unreadCount = computed(() => notificationsStore.unreadCount)
    const list = computed(() => notificationsStore.list.slice(0, 20))
    const isLoading = computed(() => notificationsStore.loading)
    const isEnriching = computed(() => notificationsStore.enriching)
    const lastBlock = computed(() => notificationsStore.lastBlock)

    const formatTime = (n: NotificationItem) => formatNotificationTime(n.time)

    /** Прочитано = ниже указателя блока (показано после открытия выпадашки) */
    const isSeen = (item: NotificationItem) => (item.nblock ?? 0) <= lastBlock.value

    const iconFor = (item: NotificationItem) => ICON_BY_TYPE[item.type] ?? 'EditOutlined'

    const getTypeLabel = (item: NotificationItem) => notificationTypeLabel(item)

    const enrichmentFor = (item: NotificationItem) => notificationsStore.getEnrichment(item)

    const getDisplayName = (item: NotificationItem): string => {
      const e = enrichmentFor(item)
      const name = e.from?.name?.trim()
      if (name) return name
      const addr = item.from ?? e.from?.address
      if (addr) return addr.slice(0, 8) + '…'
      return 'Кто-то'
    }

    const getInitial = (item: NotificationItem): string => {
      const name = getDisplayName(item)
      return name.charAt(0).toUpperCase()
    }

    const getAvatar = (item: NotificationItem): string | null => {
      const e = enrichmentFor(item)
      return resolveImageUrl(e.from?.avatar) ?? null
    }

    const getActionLine = (item: NotificationItem): string => {
      switch (item.mesType) {
        case 'upvoteShare':
          return item.upvoteVal != null && item.upvoteVal < 0
            ? 'поставил низкую оценку посту'
            : 'оценил ваш пост'
        case 'comment':
          return 'прокомментировал ваш пост'
        case 'answer':
          return 'ответил на ваш комментарий'
        case 'subscribe':
          return 'подписался на вас'
        case 'subscribePrivate':
          return 'оформил приватную подписку'
        case 'unsubscribe':
          return 'отписался от вас'
        case 'repost':
          return 'поделился вашим постом'
        case 'post':
          return 'опубликовал новый пост'
        case 'userInfo':
          return 'обновил профиль'
        default:
          return item.title
      }
    }

    const getCommentText = (item: NotificationItem): string => {
      const e = enrichmentFor(item)
      const raw = e.comment?.message
      if (!raw) return ''
      return raw
    }

    const isCommentLong = (item: NotificationItem): boolean => {
      const txt = getCommentText(item)
      return txt.length > COMMENT_PREVIEW_LIMIT
    }

    const getCommentDisplay = (item: NotificationItem): string => {
      const txt = getCommentText(item)
      if (!txt) return ''
      if (expandedIds.value.has(item.id)) return txt
      if (txt.length <= COMMENT_PREVIEW_LIMIT) return txt
      return trimText(txt, COMMENT_PREVIEW_LIMIT)
    }

    const isExpanded = (id: string) => expandedIds.value.has(id)

    const toggleExpand = (id: string) => {
      const next = new Set(expandedIds.value)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      expandedIds.value = next
    }

    const getPostCaption = (item: NotificationItem): string => {
      const e = enrichmentFor(item)
      const cap = e.post?.caption?.trim()
      if (cap) return trimText(cap, POST_REF_PREVIEW_LIMIT)
      const msg = e.post?.message?.trim()
      if (msg) return trimText(msg, POST_REF_PREVIEW_LIMIT)
      return ''
    }

    const hasPreview = (item: NotificationItem): boolean => {
      if (item.type === 'rating' && item.upvoteVal != null) return true
      if (getCommentText(item)) return true
      if (getPostCaption(item)) return true
      return false
    }

    const getRatingDisplay = (item: NotificationItem): { label: string; positive: boolean } => {
      const v = item.upvoteVal ?? 0
      if (v > 0) {
        const stars = Math.max(1, Math.min(5, Math.round(v)))
        return { label: '★'.repeat(stars) + '☆'.repeat(5 - stars), positive: true }
      }
      return { label: 'Низкая оценка', positive: false }
    }

    const openPostFromItem = (item: NotificationItem): boolean => {
      const e = enrichmentFor(item)
      const postId = item.shareId ?? e.comment?.postid
      if (!postId) return false
      const cached =
        (e.post as Record<string, unknown> | undefined) ?? notificationsStore.postCache[postId]
      if (!cached) return false
      try {
        const usersMap: Record<string, unknown> = {}
        const sender = e.from
        if (sender?.address) {
          usersMap[sender.address] = {
            address: sender.address,
            name: sender.name,
            i: sender.avatar,
            reputation: sender.reputation,
          }
        }
        const adapted = adaptPostData(cached, 0, usersMap)
        modalStore.openPostModal(adapted as never)
        return true
      } catch (e) {
        console.warn('[notifications] adapt post failed', e)
        return false
      }
    }

    const navigateToProfile = (item: NotificationItem) => {
      const addr = item.from ?? item.fromSnapshot?.address
      if (!addr) return false
      router.push(`/${addr}`)
      return true
    }

    const onItemClick = (item: NotificationItem) => {
      visible.value = false

      // Подписки / профильные события — переход на профиль отправителя
      if (item.type === 'subscribe' || item.mesType === 'userInfo') {
        if (navigateToProfile(item)) return
      }

      // Связано с постом — открыть PostModal
      if (openPostFromItem(item)) return

      // Фолбэк: если есть прямая ссылка
      if (item.link) {
        if (item.link.startsWith('http')) {
          window.location.href = item.link
        } else {
          router.push(item.link)
        }
        return
      }

      // Последний фолбэк — на профиль отправителя
      navigateToProfile(item)
    }

    const onOpenChange = (open: boolean) => {
      visible.value = open
      if (open) {
        notificationsStore.persistReadPointer()
        if (notificationsStore.list.length === 0 && !notificationsStore.loading) {
          notificationsStore.init({ forceRefresh: true })
        }
        // Догружаем превью для видимых уведомлений
        notificationsStore.enrichVisible(list.value)
      }
    }

    const onItemMenuClick = ({ key }: { key: string }) => {
      notificationsStore.hideNotification(key)
    }

    const onClearAll = () => {
      notificationsStore.hideAllNotifications()
    }

    /** Контейнер для overlay: body, чтобы выпадашка была выше мессенджера и полноэкранного оверлея (z-index). В Tauri document может быть недоступен в момент вызова */
    const getPopupContainer = (_trigger: HTMLElement | undefined) => {
      const doc =
        typeof document !== 'undefined'
          ? document
          : typeof window !== 'undefined'
            ? (window as Window & { document?: Document }).document
            : undefined
      if (doc?.body) return doc.body
      return undefined
    }

    const getPopupContainerInner = (trigger: HTMLElement | undefined) => {
      const doc =
        typeof document !== 'undefined'
          ? document
          : typeof window !== 'undefined'
            ? (window as Window & { document?: Document }).document
            : undefined
      const node = trigger?.closest?.('.ant-dropdown')
      if (node) return node
      if (doc?.body) return doc.body
      return undefined
    }

    return {
      authStore,
      notificationsStore,
      visible,
      unreadCount,
      list,
      isLoading,
      isEnriching,
      lastBlock,
      formatTime,
      isSeen,
      iconFor,
      getTypeLabel,
      getDisplayName,
      getInitial,
      getAvatar,
      getActionLine,
      hasPreview,
      getCommentText,
      getCommentDisplay,
      isCommentLong,
      isExpanded,
      toggleExpand,
      getPostCaption,
      getRatingDisplay,
      onItemClick,
      onOpenChange,
      onItemMenuClick,
      onClearAll,
      getPopupContainer,
      getPopupContainerInner,
    }
  },
  computed: {
    isAuthenticated(): boolean {
      return this.authStore.isUserAuthenticated
    },
  },
})
