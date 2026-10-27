<template>
  <SC_NotificationsMenu :class="{ sheet }" @click.stop @mousedown.stop>
    <SC_NotificationsHeader>
      <SC_NotificationsTitle>{{ t('header.notifications') }}</SC_NotificationsTitle>
      <SC_NotificationsHeaderActions>
        <SC_ClearAllButton v-if="list.length > 0" type="button" @click.stop="onClearAll">
          {{ t('header.clearAll') }}
        </SC_ClearAllButton>
        <SC_CloseButton
          v-if="sheet"
          type="button"
          :aria-label="t('common.close')"
          @click.stop="emit('close')"
        >
          <CloseOutlined />
        </SC_CloseButton>
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
            <UserMark :mark="userMarkOf(item.from ?? item.fromSnapshot?.address)" :size="14">
              <!-- Профиль ещё грузится: скелетоны вместо адреса и буквы. -->
              <Skeleton
                v-if="notificationsStore.isActorPending(item)"
                data-testid="actor-avatar-skeleton"
                :width="28"
                :height="28"
                radius="50%"
              />
              <SC_NotificationAvatar
                v-else-if="avatarOf(item)"
                :class="{ loaded: loadedAvatars.has(avatarOf(item)!) }"
              >
                <img
                  :src="avatarOf(item)!"
                  :alt="getDisplayName(item)"
                  loading="lazy"
                  decoding="async"
                  @load="loadedAvatars.add(avatarOf(item)!)"
                  @error="brokenAvatars.add(avatarOf(item)!)"
                />
              </SC_NotificationAvatar>
              <SC_NotificationAvatarLetter v-else>
                {{ getInitial(item) }}
              </SC_NotificationAvatarLetter>
            </UserMark>

            <SC_NotificationActorText>
              <SC_NotificationActorName>
                <Skeleton
                  v-if="notificationsStore.isActorPending(item)"
                  data-testid="actor-name-skeleton"
                  :width="96"
                  :height="12"
                />
                <template v-else>{{ getDisplayName(item) }}</template>
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

            <!-- Сумма входящего перевода или награды: «+1.5 PKOIN». -->
            <SC_RatingValue v-if="item.description" :positive="true">
              {{ item.description }}
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
              <Menu :items="itemMenu(item)" @click="onItemMenuClick" />
            </template>
          </Dropdown>
        </SC_NotificationItemActions>
      </SC_NotificationItem>
    </SC_NotificationsList>
  </SC_NotificationsMenu>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, type Component } from 'vue'
import { openExternal } from '@/helpers/common/open-external'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Dropdown, Menu } from 'ant-design-vue'
import {
  CloseOutlined,
  EllipsisOutlined,
  StarFilled,
  MessageOutlined,
  UserAddOutlined,
  RetweetOutlined,
  DollarOutlined,
  NotificationOutlined,
  EditOutlined,
} from '@/components/icons'
import { useNotificationsStore } from '@/stores'
import { useModalStore } from '@/stores/modal-store'
import { useChainInfoStore } from '@/stores/chain-info-store'
import { isTxid } from '@/b-components/chain-info/chain-link'
import type { NotificationItem } from '@/stores/notifications-store'
import { isLowRatingValue } from '@/stores/notification-filtering'
import { adaptPostData } from '@/composables/use-feed'
import UserMark from '@/components/user-mark'
import Skeleton from '@/components/skeleton'
import { userMarkOf } from '@/services/user-marks'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import {
  trimText,
  COMMENT_PREVIEW_LIMIT,
  POST_REF_PREVIEW_LIMIT,
} from './helpers/notification-formatter'
import { formatTimeCompact } from '@/helpers/common/date-formatter'
import { ICON_BY_TYPE, notificationTypeLabelKey } from './helpers/notification-type-map'
import { classifyNotificationLink } from './helpers/notification-link'
import {
  SC_NotificationsMenu,
  SC_NotificationsHeader,
  SC_NotificationsTitle,
  SC_NotificationsHeaderActions,
  SC_ClearAllButton,
  SC_CloseButton,
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

const props = withDefaults(
  defineProps<{
    /** Список на экране: пока он открыт, догружаются имена и тексты. */
    visible: boolean
    /** Окно во весь экран телефона, а не выпадашка: своя кнопка закрытия. */
    sheet?: boolean
  }>(),
  { sheet: false }
)

const emit = defineEmits<{ close: [] }>()

const notificationsStore = useNotificationsStore()
const modalStore = useModalStore()
const router = useRouter()

const expandedIds = ref(new Set<string>())

const list = computed(() => notificationsStore.list.slice(0, 20))
const isLoading = computed(() => notificationsStore.loading)
const isEnriching = computed(() => notificationsStore.enriching)

// Имена, тексты и посты догружаются, пока список открыт: и при открытии, и
// когда уведомления пришли уже при открытом (первая загрузка, новое событие).
// Раньше только при открытии, и пришедшие позже оставались с адресами.
watch(
  () => (props.visible ? list.value.map((i) => i.id).join(',') : ''),
  (ids) => {
    if (ids) void notificationsStore.enrichVisible(list.value)
  }
)
// Read-pointer (P2-8): «прочитано до» двигается только по явному открытию
// выпадашки, а не на head сети при каждом фоновом опросе.
const readBlock = computed(() => notificationsStore.readBlock)

function formatTime(n: NotificationItem): string {
  return formatTimeCompact(n.time)
}

/** Прочитано = `nblock` уведомления ниже read-pointer последнего явного просмотра. */
function isSeen(item: NotificationItem): boolean {
  return (item.nblock ?? 0) <= readBlock.value
}

// Бейдж в шапке — непрочитанные (новее read-pointer), а не «все нескрытые» (S53).

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
  // Награду из лотереи присылает сеть, а не человек.
  if (item.mesType === 'win') return 'Bastyon'
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

/** Загруженные картинки аватаров — без пульсации; битые — буквой. */
const loadedAvatars = reactive(new Set<string>())
const brokenAvatars = reactive(new Set<string>())

function avatarOf(item: NotificationItem): string | null {
  const url = resolveImageUrl(enrichmentFor(item).from?.avatar) ?? null
  return url && !brokenAvatars.has(url) ? url : null
}

function getActionLine(item: NotificationItem): string {
  switch (item.mesType) {
    case 'upvoteShare':
      return isLowRatingValue(item.upvoteVal)
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
    case 'upvoteComment':
      return (item.upvoteVal ?? 0) < 0
        ? t('header.actionDislikedComment')
        : t('header.actionLikedComment')
    case 'repost':
      return t('header.actionReposted')
    case 'postfromprivate':
      return t('header.actionPosted')
    case 'boost':
      return t('header.actionBoosted')
    case 'transaction':
      return t('header.actionSentCoins')
    case 'donation':
      return t('header.actionSentTip')
    case 'paidSubscription':
      return t('header.actionPaidSubscription')
    case 'win':
      return t('header.actionWin')
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
  if (item.description) return true
  if (item.type === 'rating' && item.upvoteVal != null) return true
  if (getCommentText(item)) return true
  if (getPostCaption(item)) return true
  return false
}

function getRatingDisplay(item: NotificationItem): { label: string; positive: boolean } {
  // Оценка комментария — лайк или дизлайк, а не звёзды.
  if (item.mesType === 'upvoteComment') {
    const liked = (item.upvoteVal ?? 0) > 0
    return { label: liked ? '👍' : '👎', positive: liked }
  }
  // upvoteVal — звёзды 1..5. Низкая оценка (<= 2) показывается словами, как в
  // legacy; раньше «низкой» считалась только отрицательная, которой не бывает.
  const v = item.upvoteVal ?? 0
  if (!isLowRatingValue(item.upvoteVal) && v > 0) {
    const stars = Math.max(1, Math.min(5, Math.round(v)))
    return { label: '★'.repeat(stars) + '☆'.repeat(5 - stars), positive: true }
  }
  const stars = Math.max(1, Math.min(5, Math.round(v)))
  return {
    label: `${t('header.lowRating')} · ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`,
    positive: false,
  }
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

/**
 * Безопасно открывает `item.link` из уведомления (P1-5, open-redirect guard).
 * Решение — в чистом `classifyNotificationLink` (тестируемо); здесь только
 * исполнение намерения.
 */
function openNotificationLink(link: string): void {
  const action = classifyNotificationLink(link)
  switch (action.kind) {
    case 'same-tab':
      window.location.href = action.href
      break
    case 'new-tab':
      // Общий openExternal: в десктопной сборке window.open ничего не делает (V40).
      void openExternal(action.href)
      break
    case 'router':
      router.push(action.path)
      break
    case 'ignore':
      break
  }
}

function onItemClick(item: NotificationItem): void {
  emit('close')

  // Оплата платной подписки — к списку своих платных подписчиков.
  if (item.mesType === 'paidSubscription') {
    void router.push({ name: 'paid-subscriptions', query: { tab: 'subscribers' } })
    return
  }

  // Монеты — перевод или награда — видны в истории кошелька.
  if (item.type === 'tip' || item.mesType === 'win') {
    void router.push({ name: 'wallets' })
    return
  }

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

/** Меню уведомления: «В блокчейне» — у событий с транзакцией, и «Скрыть». */
function itemMenu(item: NotificationItem): { key: string; label: string }[] {
  const hide = { key: `hide:${item.id}`, label: t('header.hideNotification') }
  return isTxid(item.id)
    ? [{ key: `chain:${item.id}`, label: t('chainInfo.action') }, hide]
    : [hide]
}

function onItemMenuClick({ key }: { key: string | number }): void {
  const [action, ...rest] = String(key).split(':')
  const id = rest.join(':')
  if (action === 'chain') {
    // Транзакция события: перевод, оценка, комментарий, подписка.
    emit('close')
    useChainInfoStore().open({ kind: 'tx', txid: id })
    return
  }
  notificationsStore.hideNotification(id)
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

function getPopupContainerInner(
  trigger: HTMLElement | undefined
): Element | HTMLElement | undefined {
  const node = trigger?.closest?.('.ant-dropdown')
  if (node) return node
  return safeDocument()?.body
}
</script>
