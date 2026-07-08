<template>
  <Dropdown
    v-if="isAuthenticated"
    v-model:open="visible"
    :trigger="['click']"
    placement="bottomRight"
    :get-popup-container="getPopupContainer"
    overlay-class-name="header-notifications-dropdown"
    :overlay-style="{ zIndex: 3000 }"
    @open-change="onOpenChange"
  >
    <SC_NotificationsWrapper>
      <Badge
        :count="unreadCount"
        :offset="[0, 5]"
        :number-style="{ backgroundColor: 'var(--color-ant-blue)' }"
      >
        <BellOutlined :style="ICON_SIZE_XL" />
      </Badge>
    </SC_NotificationsWrapper>

    <template #overlay>
      <SC_NotificationsMenu @click.stop @mousedown.stop>
        <SC_NotificationsHeader>
          <SC_NotificationsTitle>{{ t('header.notifications') }}</SC_NotificationsTitle>
          <SC_NotificationsHeaderActions v-if="list.length > 0">
            <SC_ClearAllButton type="button" @click.stop="onClearAll">
              {{ t('header.clearAll') }}
            </SC_ClearAllButton>
          </SC_NotificationsHeaderActions>
        </SC_NotificationsHeader>

        <SC_EnrichingHint v-if="isEnriching && list.length > 0" />

        <SC_LoaderWrap v-if="isLoading && list.length === 0">
          {{ t('header.loading') }}
        </SC_LoaderWrap>
        <SC_EmptyMessage v-else-if="list.length === 0">
          {{ t('header.noNewNotifications') }}
        </SC_EmptyMessage>
        <SC_NotificationsList v-else>
          <SC_NotificationItem v-for="item in list" :key="item.id" :seen="isSeen(item)">
            <SC_NotificationItemBody @click="onItemClick(item)">
              <SC_NotificationHead>
                <SC_NotificationTypePill :variant="item.type">
                  <component :is="iconComponentFor(item)" />
                  <span>{{ getTypeLabel(item) }}</span>
                </SC_NotificationTypePill>
                <SC_NotificationItemTime>
                  {{ formatTime(item) }}
                </SC_NotificationItemTime>
              </SC_NotificationHead>

              <SC_NotificationActor>
                <SC_NotificationAvatar v-if="getAvatar(item)">
                  <img
                    :src="getAvatar(item) ?? undefined"
                    :alt="getDisplayName(item)"
                    loading="lazy"
                    decoding="async"
                  />
                </SC_NotificationAvatar>
                <SC_NotificationAvatarLetter v-else>
                  {{ getInitial(item) }}
                </SC_NotificationAvatarLetter>

                <SC_NotificationActorText>
                  <SC_NotificationActorName>
                    {{ getDisplayName(item) }}
                  </SC_NotificationActorName>
                  <SC_NotificationAction>{{ getActionLine(item) }}</SC_NotificationAction>
                </SC_NotificationActorText>
              </SC_NotificationActor>

              <SC_NotificationPreview v-if="hasPreview(item)" :variant="item.type">
                <SC_RatingValue
                  v-if="item.type === 'rating' && item.upvoteVal != null"
                  :positive="getRatingDisplay(item).positive"
                >
                  {{ getRatingDisplay(item).label }}
                </SC_RatingValue>

                <SC_CommentPreview v-if="getCommentText(item)" :expanded="isExpanded(item.id)">{{
                  getCommentDisplay(item)
                }}</SC_CommentPreview>

                <SC_ExpandToggle
                  v-if="isCommentLong(item)"
                  type="button"
                  @click.stop="toggleExpand(item.id)"
                >
                  {{ isExpanded(item.id) ? t('header.collapse') : t('header.showFull') }}
                </SC_ExpandToggle>

                <SC_PostRef v-if="getPostCaption(item)">
                  <SC_PostRefLabel>{{ t('header.postLabel') }}</SC_PostRefLabel>
                  <SC_PostRefText>{{ getPostCaption(item) }}</SC_PostRefText>
                </SC_PostRef>
              </SC_NotificationPreview>
            </SC_NotificationItemBody>

            <SC_NotificationItemActions @click.stop>
              <Dropdown
                trigger="click"
                placement="bottomRight"
                :get-popup-container="getPopupContainerInner"
              >
                <SC_NotificationItemTrigger><EllipsisOutlined /></SC_NotificationItemTrigger>
                <template #overlay>
                  <Menu
                    :items="[{ key: item.id, label: t('header.hideNotification') }]"
                    @click="onItemMenuClick"
                  />
                </template>
              </Dropdown>
            </SC_NotificationItemActions>
          </SC_NotificationItem>
        </SC_NotificationsList>
      </SC_NotificationsMenu>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Dropdown, Badge, Menu } from 'ant-design-vue'
import { ICON_SIZE_XL } from '@/styles/icon-styles'
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
import { ICON_BY_TYPE, notificationTypeLabelKey } from './helpers/notification-type-map'
import {
  SC_NotificationsWrapper,
  SC_NotificationsMenu,
  SC_NotificationsHeader,
  SC_NotificationsTitle,
  SC_NotificationsHeaderActions,
  SC_ClearAllButton,
  SC_NotificationsList,
  SC_NotificationItem,
  SC_NotificationItemBody,
  SC_NotificationItemActions,
  SC_NotificationItemTrigger,
  SC_NotificationItemTime,
  SC_NotificationHead,
  SC_NotificationTypePill,
  SC_NotificationActor,
  SC_NotificationAvatar,
  SC_NotificationAvatarLetter,
  SC_NotificationActorText,
  SC_NotificationActorName,
  SC_NotificationAction,
  SC_NotificationPreview,
  SC_RatingValue,
  SC_CommentPreview,
  SC_ExpandToggle,
  SC_PostRef,
  SC_PostRefLabel,
  SC_PostRefText,
  SC_EmptyMessage,
  SC_LoaderWrap,
  SC_EnrichingHint,
} from './styled'

// ICON_BY_TYPE возвращает строковые имена; в script setup нужны сами компоненты.
const ICON_COMPONENTS: Record<string, Component> = {
  StarFilled,
  MessageOutlined,
  UserAddOutlined,
  RetweetOutlined,
  DollarOutlined,
  NotificationOutlined,
  EditOutlined,
}

const { t } = useI18n()

const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()
const modalStore = useModalStore()
const router = useRouter()

const isAuthenticated = computed<boolean>(() => authStore.isUserAuthenticated)

function runInit(): void {
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

function formatTime(n: NotificationItem): string {
  return formatNotificationTime(n.time)
}

/** Прочитано = `nblock` уведомления ниже указателя последнего просмотренного блока. */
function isSeen(item: NotificationItem): boolean {
  return (item.nblock ?? 0) <= lastBlock.value
}

function iconComponentFor(item: NotificationItem): Component {
  const name = ICON_BY_TYPE[item.type] ?? 'EditOutlined'
  return ICON_COMPONENTS[name] ?? EditOutlined
}

function getTypeLabel(item: NotificationItem): string {
  return t(notificationTypeLabelKey(item))
}

function enrichmentFor(item: NotificationItem) {
  return notificationsStore.getEnrichment(item)
}

function getDisplayName(item: NotificationItem): string {
  const e = enrichmentFor(item)
  const name = e.from?.name?.trim()
  if (name) return name
  const addr = item.from ?? e.from?.address
  if (addr) return addr.slice(0, 8) + '…'
  return t('header.someone')
}

function getInitial(item: NotificationItem): string {
  return getDisplayName(item).charAt(0).toUpperCase()
}

function getAvatar(item: NotificationItem): string | null {
  const e = enrichmentFor(item)
  return resolveImageUrl(e.from?.avatar) ?? null
}

function getActionLine(item: NotificationItem): string {
  switch (item.mesType) {
    case 'upvoteShare':
      return item.upvoteVal != null && item.upvoteVal < 0
        ? t('header.actionLowRating')
        : t('header.actionRated')
    case 'comment':
      return t('header.actionCommented')
    case 'answer':
      return t('header.actionAnswered')
    case 'subscribe':
      return t('header.actionSubscribed')
    case 'subscribePrivate':
      return t('header.actionSubscribedPrivate')
    case 'unsubscribe':
      return t('header.actionUnsubscribed')
    case 'repost':
      return t('header.actionReposted')
    case 'post':
      return t('header.actionPosted')
    case 'userInfo':
      return t('header.actionUpdatedProfile')
    default:
      // item.title — i18n-ключ заголовка (см. notifications-mappers).
      return item.title ? t(item.title) : ''
  }
}

function getCommentText(item: NotificationItem): string {
  return enrichmentFor(item).comment?.message ?? ''
}

function isCommentLong(item: NotificationItem): boolean {
  return getCommentText(item).length > COMMENT_PREVIEW_LIMIT
}

function getCommentDisplay(item: NotificationItem): string {
  const txt = getCommentText(item)
  if (!txt) return ''
  if (expandedIds.value.has(item.id)) return txt
  if (txt.length <= COMMENT_PREVIEW_LIMIT) return txt
  return trimText(txt, COMMENT_PREVIEW_LIMIT)
}

function isExpanded(id: string): boolean {
  return expandedIds.value.has(id)
}

function toggleExpand(id: string): void {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function getPostCaption(item: NotificationItem): string {
  const e = enrichmentFor(item)
  const cap = e.post?.caption?.trim()
  if (cap) return trimText(cap, POST_REF_PREVIEW_LIMIT)
  const msg = e.post?.message?.trim()
  if (msg) return trimText(msg, POST_REF_PREVIEW_LIMIT)
  return ''
}

function hasPreview(item: NotificationItem): boolean {
  if (item.type === 'rating' && item.upvoteVal != null) return true
  if (getCommentText(item)) return true
  if (getPostCaption(item)) return true
  return false
}

function getRatingDisplay(item: NotificationItem): { label: string; positive: boolean } {
  const v = item.upvoteVal ?? 0
  if (v > 0) {
    const stars = Math.max(1, Math.min(5, Math.round(v)))
    return { label: '★'.repeat(stars) + '☆'.repeat(5 - stars), positive: true }
  }
  return { label: t('header.lowRating'), positive: false }
}

function openPostFromItem(item: NotificationItem): boolean {
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
  } catch (err) {
    console.warn('[notifications] adapt post failed', err)
    return false
  }
}

function navigateToProfile(item: NotificationItem): boolean {
  const addr = item.from ?? item.fromSnapshot?.address
  if (!addr) return false
  router.push(`/${addr}`)
  return true
}

/** Доверенные хосты, на которые можно навигировать в том же окне (P1-5). */
const TRUSTED_LINK_HOSTS = ['bastyon.com', 'pocketnet.app']

function isTrustedLinkHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return TRUSTED_LINK_HOSTS.some((d) => h === d || h.endsWith(`.${d}`))
}

/**
 * Безопасно открывает `item.link` из уведомления (P1-5). `link` приходит с ноды —
 * `startsWith('http')` пропускал `http://evil.com`, который полной навигацией
 * подменял приложение (open-redirect/фишинг). Теперь: относительные пути → router;
 * доверенный Bastyon-хост → та же вкладка; чужой http(s) → новая вкладка с
 * noopener (приложение не подменяется); нестандартные схемы (javascript:) → игнор.
 */
function openNotificationLink(link: string): void {
  let url: URL | null = null
  try {
    url = new URL(link.trim())
  } catch {
    /* не абсолютный URL — url остаётся null */
  }

  if (url) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return
    if (isTrustedLinkHost(url.hostname)) {
      window.location.href = url.href
    } else {
      window.open(url.href, '_blank', 'noopener,noreferrer')
    }
    return
  }

  // Не абсолютный URL → внутренний маршрут роутера (защита от protocol-relative).
  const rel = link.trim()
  if (rel.startsWith('//')) return
  router.push(rel)
}

function onItemClick(item: NotificationItem): void {
  visible.value = false

  // Подписки/профильные события → переход на профиль отправителя.
  if (item.type === 'subscribe' || item.mesType === 'userInfo') {
    if (navigateToProfile(item)) return
  }

  // Связано с постом → PostModal.
  if (openPostFromItem(item)) return

  // Фолбэк: прямая ссылка из уведомления.
  if (item.link) {
    openNotificationLink(item.link)
    return
  }

  // Последний фолбэк — профиль отправителя.
  navigateToProfile(item)
}

function onOpenChange(open: boolean): void {
  visible.value = open
  if (open) {
    notificationsStore.persistReadPointer()
    if (notificationsStore.list.length === 0 && !notificationsStore.loading) {
      notificationsStore.init({ forceRefresh: true })
    }
    notificationsStore.enrichVisible(list.value)
  }
}

function onItemMenuClick({ key }: { key: string }): void {
  notificationsStore.hideNotification(key)
}

function onClearAll(): void {
  notificationsStore.hideAllNotifications()
}

function safeDocument(): Document | undefined {
  if (typeof document !== 'undefined') return document
  if (typeof window !== 'undefined') {
    return (window as Window & { document?: Document }).document
  }
  return undefined
}

/**
 * Контейнер для overlay: body, чтобы выпадашка была выше мессенджера и
 * полноэкранного оверлея (z-index). В Tauri document может быть недоступен
 * в момент вызова — отсюда защита через `safeDocument()`.
 */
function getPopupContainer(_trigger: HTMLElement | undefined): HTMLElement | undefined {
  return safeDocument()?.body
}

function getPopupContainerInner(
  trigger: HTMLElement | undefined
): Element | HTMLElement | undefined {
  const node = trigger?.closest?.('.ant-dropdown')
  if (node) return node
  return safeDocument()?.body
}
</script>
