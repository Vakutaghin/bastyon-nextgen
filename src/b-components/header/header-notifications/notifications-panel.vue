<template>
  <SC_NotificationsMenu :class="{ sheet }" @click.stop @mousedown.stop>
    <SC_NotificationsHeader>
      <SC_NotificationsTitle>{{ t('header.notifications') }}</SC_NotificationsTitle>
      <SC_NotificationsHeaderActions>
        <SC_ClearAllButton v-if="source.length > 0" type="button" @click.stop="onClearAll">
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

    <!-- Комментарии отдельно: их легко потерять среди оценок и подписок. -->
    <SC_FilterRow
      v-if="notificationsStore.list.length > 0"
      role="group"
      :aria-label="t('header.filterLabel')"
    >
      <SC_FilterChip type="button" :aria-pressed="filter === 'all'" @click.stop="setFilter('all')">
        {{ t('header.filterAll') }}
      </SC_FilterChip>
      <SC_FilterChip
        type="button"
        :aria-pressed="filter === 'comments'"
        @click.stop="setFilter('comments')"
      >
        {{ t('header.filterComments') }}
        <SC_FilterCount v-if="unreadComments > 0">{{ unreadComments }}</SC_FilterCount>
      </SC_FilterChip>
    </SC_FilterRow>

    <SC_EnrichingHint v-if="isEnriching && list.length > 0" />

    <SC_LoaderWrap v-if="isLoading && list.length === 0">
      {{ t('header.loading') }}
    </SC_LoaderWrap>
    <SC_EmptyMessage v-else-if="list.length === 0">
      {{
        filter === 'comments' && notificationsStore.list.length > 0
          ? t('header.noComments')
          : t('header.noNewNotifications')
      }}
    </SC_EmptyMessage>
    <SC_NotificationsList v-else>
      <SC_NotificationItem
        v-for="item in list"
        :key="item.id"
        :seen="isSeen(item)"
        :aria-busy="openingId === item.id || undefined"
        data-testid="notification-item"
      >
        <SC_NotificationItemBody @click="openItem(item)">
          <SC_NotificationHead>
            <SC_NotificationTypePill :variant="item.type">
              <component :is="iconComponentFor(item)" />
              <span>{{ getTypeLabel(item) }}</span>
            </SC_NotificationTypePill>
            <SC_NotificationItemTime>
              <!-- Пока догружается пост или комментарий — крутилка вместо времени. -->
              <LoadingOutlined v-if="openingId === item.id" spin />
              <template v-else>{{ formatTime(item) }}</template>
            </SC_NotificationItemTime>
          </SC_NotificationHead>

          <SC_NotificationActor>
            <!-- Аватар и имя — в профиль; всё остальное — туда, о чём уведомление. -->
            <SC_ActorAvatarButton
              type="button"
              tabindex="-1"
              aria-hidden="true"
              @click.stop="openActor(item)"
            >
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
            </SC_ActorAvatarButton>

            <SC_NotificationActorText>
              <SC_NotificationActorName v-if="notificationsStore.isActorPending(item)">
                <Skeleton data-testid="actor-name-skeleton" :width="96" :height="12" />
              </SC_NotificationActorName>
              <SC_ActorNameButton
                v-else-if="actorAddress(item)"
                type="button"
                :aria-label="t('header.openActorProfile', { name: getDisplayName(item) })"
                @click.stop="openActor(item)"
              >
                {{ getDisplayName(item) }}
              </SC_ActorNameButton>
              <SC_NotificationActorName v-else>{{ getDisplayName(item) }}</SC_NotificationActorName>
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

          <!-- Комментарий к посту или ответ вам: ответить сразу, у самого комментария. -->
          <SC_ReplyRow v-if="isReplyableNotification(item)">
            <SC_ReplyButton
              type="button"
              :disabled="openingId !== null"
              @click.stop="openItem(item, true)"
            >
              <MessageOutlined />
              {{ t('header.reply') }}
            </SC_ReplyButton>
            <SC_AnsweredMark v-if="notificationsStore.answeredIds.has(item.id)">
              <CheckOutlined />
              {{ t('header.answered') }}
            </SC_AnsweredMark>
          </SC_ReplyRow>
        </SC_NotificationItemBody>

        <SC_NotificationItemActions @click.stop>
          <Dropdown
            trigger="click"
            placement="bottomRight"
            :get-popup-container="getPopupContainerInner"
          >
            <SC_NotificationItemTrigger type="button" :aria-label="t('header.more')">
              <EllipsisOutlined />
            </SC_NotificationItemTrigger>
            <template #overlay>
              <Menu :items="itemMenu(item)" @click="onItemMenuClick" />
            </template>
          </Dropdown>
        </SC_NotificationItemActions>
      </SC_NotificationItem>

      <SC_ShowMoreButton v-if="source.length > list.length" type="button" @click.stop="showMore">
        {{ t('header.showMore') }}
      </SC_ShowMoreButton>
    </SC_NotificationsList>
  </SC_NotificationsMenu>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, type Component } from 'vue'
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
  CheckOutlined,
  LoadingOutlined,
} from '@/components/icons'
import { useNotificationsStore } from '@/stores'
import { useChainInfoStore } from '@/stores/chain-info-store'
import { isTxid } from '@/b-components/chain-info/chain-link'
import type { NotificationItem } from '@/stores/notifications-store'
import { isLowRatingValue } from '@/stores/notification-filtering'
import { isReplyableNotification, notificationTarget } from '@/stores/notification-target'
import UserMark from '@/components/user-mark'
import Skeleton from '@/components/skeleton'
import { userMarkOf } from '@/services/user-marks'
import { userAvatar, userName } from '@/services/user-names'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import {
  trimText,
  COMMENT_PREVIEW_LIMIT,
  POST_REF_PREVIEW_LIMIT,
} from './helpers/notification-formatter'
import { formatTimeCompact } from '@/helpers/common/date-formatter'
import { ICON_BY_TYPE, notificationTypeLabelKey } from './helpers/notification-type-map'
import { openNotification } from './open-notification'
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
  SC_FilterRow,
  SC_FilterChip,
  SC_FilterCount,
  SC_ActorAvatarButton,
  SC_ActorNameButton,
  SC_ReplyRow,
  SC_ReplyButton,
  SC_AnsweredMark,
  SC_ShowMoreButton,
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
const router = useRouter()

const expandedIds = ref(new Set<string>())

/** Сколько показывать за раз; «Показать ещё» — следующие столько же. */
const PAGE_SIZE = 20

/** «Все» или только комментарии и ответы — те, на которые можно ответить. */
const filter = ref<'all' | 'comments'>('all')
const limit = ref(PAGE_SIZE)

const source = computed(() =>
  filter.value === 'comments'
    ? notificationsStore.list.filter(isReplyableNotification)
    : notificationsStore.list
)
const list = computed(() => source.value.slice(0, limit.value))
const unreadComments = computed(
  () => notificationsStore.unreadList.filter(isReplyableNotification).length
)
const isLoading = computed(() => notificationsStore.loading)
const isEnriching = computed(() => notificationsStore.enriching)

function setFilter(next: 'all' | 'comments'): void {
  filter.value = next
  limit.value = PAGE_SIZE
}

function showMore(): void {
  limit.value += PAGE_SIZE
}

// Закрыли список — в следующий раз он снова с начала.
watch(
  () => props.visible,
  (open) => {
    if (!open) limit.value = PAGE_SIZE
  }
)

// Имена, тексты и посты догружаются, пока список открыт: и при открытии, и
// когда уведомления пришли уже при открытом (первая загрузка, новое событие).
// Раньше только при открытии, и пришедшие позже оставались с адресами.
// Потом — ответили ли вы на показанные комментарии: для этого нужна их ветка.
watch(
  () => (props.visible ? list.value.map((i) => i.id).join(',') : ''),
  (ids) => {
    if (!ids) return
    const shown = list.value
    void notificationsStore.enrichVisible(shown).then(() => notificationsStore.checkAnswered(shown))
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
  // Профиль не догрузился: общий сервис имён спросит лёгкий профиль ещё раз
  // (с повторами) и подставит ник, когда он придёт, — а пока короткий адрес.
  const addr = item.from ?? e.from?.address
  if (addr) return userName(addr, e.from)
  return t('header.someone')
}

function getInitial(item: NotificationItem): string {
  return getDisplayName(item).charAt(0).toUpperCase()
}

/** Загруженные картинки аватаров — без пульсации; битые — буквой. */
const loadedAvatars = reactive(new Set<string>())
const brokenAvatars = reactive(new Set<string>())

function avatarOf(item: NotificationItem): string | null {
  const from = enrichmentFor(item).from
  const url =
    resolveImageUrl(from?.avatar) ?? userAvatar(item.from ?? from?.address ?? null) ?? null
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

/** Кто это сделал — адрес для перехода в профиль; у награды сети его нет. */
function actorAddress(item: NotificationItem): string | undefined {
  if (item.mesType === 'win') return undefined
  return item.from ?? item.fromSnapshot?.address
}

/** Уведомление, которое сейчас открывается: догружается пост или комментарий. */
const openingId = ref<string | null>(null)

/**
 * Туда, о чём уведомление: к комментарию, посту, в кошелёк. `reply` — сразу
 * с формой ответа на комментарий. Список закрывается, когда нужное
 * догрузилось, — а пока на уведомлении крутилка.
 */
async function openItem(item: NotificationItem, reply = false): Promise<void> {
  if (openingId.value) return
  openingId.value = item.id
  try {
    await openNotification(item, { router, reply, onLeave: () => emit('close') })
  } finally {
    openingId.value = null
  }
}

function openActor(item: NotificationItem): void {
  const address = actorAddress(item)
  if (!address) {
    void openItem(item)
    return
  }
  emit('close')
  void router.push(`/${address}`)
}

/**
 * Меню уведомления: «Открыть» — то же, что нажатие (с клавиатуры иначе не
 * открыть), «В блокчейне» — у событий с транзакцией, и «Скрыть».
 */
function itemMenu(item: NotificationItem): { key: string; label: string }[] {
  const menu: { key: string; label: string }[] = []
  if (notificationTarget(item, notificationsStore.getEnrichment(item).comment).kind !== 'none') {
    menu.push({ key: `open:${item.id}`, label: t('header.open') })
  }
  if (isTxid(item.id)) menu.push({ key: `chain:${item.id}`, label: t('chainInfo.action') })
  menu.push({ key: `hide:${item.id}`, label: t('header.hideNotification') })
  return menu
}

function onItemMenuClick({ key }: { key: string | number }): void {
  const [action, ...rest] = String(key).split(':')
  const id = rest.join(':')
  if (action === 'open') {
    const item = list.value.find((n) => n.id === id)
    if (item) void openItem(item)
    return
  }
  if (action === 'chain') {
    // Транзакция события: перевод, оценка, комментарий, подписка.
    emit('close')
    useChainInfoStore().open({ kind: 'tx', txid: id })
    return
  }
  notificationsStore.hideNotification(id)
}

/** «Убрать все» — то, что сейчас в списке: при фильтре — только комментарии. */
function onClearAll(): void {
  notificationsStore.hideAllNotifications(source.value.map((n) => n.id))
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
