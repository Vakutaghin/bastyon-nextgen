<template>
  <!-- Выделение сообщений (use-select-gestures) и ответ смахиванием (use-swipe-reply):
       одни слушатели на всю ленту. -->
  <SC_MessageList
    ref="listRef"
    data-testid="message-list"
    :class="{
      selecting: !!selection?.active,
      pressing,
      'drag-selecting': dragging,
      'swipe-replying': swiping,
    }"
    @scroll="handleScroll"
    @pointerdown="onListPointerDown"
    @click.capture="onListClickCapture"
    @contextmenu="onContextMenu"
    @dragstart="onDragStart"
  >
    <SC_HistoryLoading v-if="loading" role="status" data-testid="history-loading">
      <SC_HistoryLoadingSpinner aria-hidden="true" />
      {{ t('messenger.loadingMessages') }}
    </SC_HistoryLoading>
    <!-- Лента долистана до начала (или не загрузилась): откуда у чата такая история.
         У пустого чата пометку показывает сама комната. -->
    <ChatHistoryNote
      v-if="
        history &&
        messages.length > 0 &&
        ((history.reachedStart && !history.archiveMore) || history.error)
      "
      :history="history"
      @retry="emit('retry')"
    />
    <template v-for="row in shownRows" :key="rowKey(row)">
      <!-- Граница: выше — то, что сервер уже стёр, а устройство сохранило. -->
      <SC_ArchiveDivider
        v-if="rowKey(row) === archiveBoundary"
        role="separator"
        data-testid="archive-divider"
      >
        <span>{{ t('messenger.archive.divider') }}</span>
      </SC_ArchiveDivider>
      <MessageItem
        v-if="row.kind === 'message'"
        data-row
        :data-message-id="row.message.id"
        :data-select-id="selection ? row.message.id : undefined"
        :data-reply-id="canReplyTo(row.message) ? row.message.id : undefined"
        :message="row.message"
        :show-name="isFirstInGroup(row.index)"
        :show-avatar="isFirstInGroup(row.index)"
        :seen="seenIds.has(row.message.id)"
        :selectable="!!selection"
        :selecting="!!selection?.active"
        :selected="!!selection?.active && selection.has(row.message.id)"
        :found="row.message.id === focusId"
        :flash="row.message.id === flashId"
        :quote-link="quoteLinks"
        @reply="emit('reply', $event)"
        @select="selection?.toggle($event.id)"
        @open-reply="emit('open-reply', $event)"
      />
      <!-- Удалённое сообщение — отметка, кто удалил: раньше оно пропадало без следа. -->
      <SC_DeletedMark v-else data-row data-testid="deleted-mark">
        {{ deletedText(row) }} ·
        <time :datetime="new Date(row.at).toISOString()">{{ formatMessageTime(row.at) }}</time>
      </SC_DeletedMark>
    </template>
    <SC_ArchiveDivider
      v-if="archiveBoundary === ARCHIVE_TAIL"
      role="separator"
      data-testid="archive-divider"
    >
      <span>{{ t('messenger.archive.dividerAll') }}</span>
    </SC_ArchiveDivider>
    <!-- Перешли по цитате — стрелка ведёт обратно к ответу, как в Telegram.
         Ленту открыли на найденном выше конца — к последним: ниже не нарисовано. -->
    <SC_ToLatest
      v-if="returnId"
      type="button"
      data-testid="jump-back"
      :aria-label="t('messenger.jump.back')"
      :title="t('messenger.jump.back')"
      @click="emit('back')"
    >
      <ArrowDownOutlined />
    </SC_ToLatest>
    <SC_ToLatest
      v-else-if="hiddenBelow > 0"
      type="button"
      data-testid="to-latest"
      :aria-label="t('messenger.search.toLatest')"
      :title="t('messenger.search.toLatest')"
      @click="toLatest"
    >
      <ArrowDownOutlined />
    </SC_ToLatest>
  </SC_MessageList>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatMessageTime } from '@/helpers/common/date-formatter'
import { ArrowDownOutlined } from '@/components/icons'
import type { Message } from '../../types'
import { chatUserName } from '../../helpers'
import { historyRows, type ChatHistory, type HistoryRow } from '../../lib/chat-history'
import { useRowWindow } from './use-row-window'
import { useSearchHighlight } from './use-search-highlight'
import type { MessageSelection } from './use-message-selection'
import { useSelectGestures } from './use-select-gestures'
import { useSwipeReply } from './use-swipe-reply'
import { canReplyTo } from '../../lib/message-selection'
import { useMessengerStore } from '../../store'
import MessageItem from '../message-item/message-item.vue'
import ChatHistoryNote from '../chat-history-note/chat-history-note.vue'
import { SC_DeletedMark } from '../chat-history-note/styled'
import {
  SC_ArchiveDivider,
  SC_HistoryLoading,
  SC_HistoryLoadingSpinner,
  SC_MessageList,
  SC_ToLatest,
} from './styled'

const props = withDefaults(
  defineProps<{
    messages?: Message[]
    /** Свои сообщения, которые уже прочитали (use-read-receipts). */
    seenIds?: ReadonlySet<string>
    /** Что известно об истории чата (lib/chat-history); у mesh-чатов нет. */
    history?: ChatHistory | null
    /** История ещё грузится, а на экране то, что уже есть. */
    loading?: boolean
    /** Выделение сообщений (use-message-selection); нет — в этой ленте не выделяют. */
    selection?: MessageSelection | null
    /** Сообщение, на котором стоит поиск по чату: рамка вокруг. */
    focusId?: string | null
    /** Слова поиска по чату (lib/message-search): подсвечиваются в тексте. */
    highlight?: readonly string[]
    /** К сообщению только что перешли (use-chat-jump): на миг подсвечено. */
    flashId?: string | null
    /** Перешли по цитате от этого ответа: стрелка внизу ведёт к нему. */
    returnId?: string | null
    /** Цитаты ответов ведут к исходным сообщениям (`open-reply`). */
    quoteLinks?: boolean
  }>(),
  {
    messages: () => [],
    seenIds: () => new Set<string>(),
    history: null,
    loading: false,
    selection: null,
    focusId: null,
    highlight: () => [],
    flashId: null,
    returnId: null,
    quoteLinks: false,
  }
)

const emit = defineEmits<{
  'load-more': []
  reply: [message: Message]
  retry: []
  /** Нажали цитату ответа. */
  'open-reply': [message: Message]
  /** Стрелка «обратно к ответу». */
  back: []
  /** Ответ, к которому вела стрелка, снова на экране. */
  returned: []
}>()

const { t } = useI18n()
const store = useMessengerStore()

const rows = computed<HistoryRow[]>(() => historyRows(props.messages))
const rowKey = (row: HistoryRow): string => (row.kind === 'message' ? row.message.id : row.id)

// Рисуются последние строки, старые — по мере прокрутки к началу (use-row-window).
const {
  shown: shownRows,
  hidden: hiddenRows,
  hiddenBelow,
  showMore,
  showNewer,
  focus,
  toBottom,
} = useRowWindow(rows, rowKey, () => props.messages[props.messages.length - 1]?.chatId ?? '')

/** Граница стёртого сервером стоит после всех сообщений: на сервере их нет совсем. */
const ARCHIVE_TAIL = 'archive-tail'

/**
 * Перед каким сообщением граница сохранённого: выше — только на устройстве,
 * ниже — с сервера. Сервер стирает с начала, так что граница одна.
 */
const archiveBoundary = computed<string | null>(() => {
  const list = props.messages
  for (let i = 1; i < list.length; i++) {
    if (list[i - 1]!.localOnly && !list[i]!.localOnly) return list[i]!.id
  }
  return list.length && list[list.length - 1]!.localOnly ? ARCHIVE_TAIL : null
})

function deletedText(row: Extract<HistoryRow, { kind: 'deleted' }>): string {
  if (row.by === store.currentUser.id) {
    return row.count === 1
      ? t('messenger.history.deletedOneByYou')
      : t('messenger.history.deletedManyByYou', { n: row.count }, row.count)
  }
  const name = chatUserName(row.by, store.userProfiles)
  return row.count === 1
    ? t('messenger.history.deletedOne', { name })
    : t('messenger.history.deletedMany', { name, n: row.count }, row.count)
}

const listRef = ref<HTMLDivElement | { $el: HTMLDivElement } | null>(null)

function getListEl(): HTMLDivElement | null {
  const v = listRef.value
  if (!v) return null
  return (v as { $el?: HTMLDivElement }).$el ?? (v as HTMLDivElement)
}

/** Сообщения, которые можно выделить, в порядке ленты (удалённые — отметки, их нет). */
const selectableIds = computed<string[]>(() =>
  props.messages.filter((m) => !m.deleted).map((m) => m.id)
)

const { pressing, dragging, onPointerDown, onClickCapture, onContextMenu, onDragStart } =
  useSelectGestures({
    list: getListEl,
    selection: () => props.selection,
    order: () => selectableIds.value,
  })

// Ответ смахиванием влево (телефон), как в Telegram; в режиме выделения — нет.
const swipeReply = useSwipeReply({
  list: getListEl,
  disabled: () => !!props.selection?.active,
  reply: (id) => {
    const message = props.messages.find((m) => m.id === id)
    if (message) emit('reply', message)
  },
})
const swiping = swipeReply.swiping

function onListPointerDown(e: PointerEvent): void {
  swipeReply.onPointerDown(e)
  onPointerDown(e)
}

function onListClickCapture(e: MouseEvent): void {
  swipeReply.onClickCapture(e)
  if (!e.defaultPrevented) onClickCapture(e)
}

// Удалили, отправленное получило id сервера, сменился поиск — выделение только из ленты.
watch(selectableIds, (ids) => {
  if (props.selection?.active) props.selection.retain(new Set(ids))
})

async function scrollToBottom(): Promise<void> {
  await nextTick()
  const el = getListEl()
  if (el) el.scrollTop = el.scrollHeight
}

/** Снова последние сообщения внизу — после перехода к найденному выше. */
function toLatest(): void {
  toBottom()
  void scrollToBottom()
}

/**
 * Где элемент в прокрутке ленты. По offsetTop, а не по getBoundingClientRect:
 * окно мессенджера раскрывается с transform: scale (см. revealOlder).
 */
function offsetIn(target: HTMLElement, container: HTMLElement): number {
  let top = 0
  let node: HTMLElement | null = target
  while (node && node !== container) {
    top += node.offsetTop
    const parent = node.offsetParent as HTMLElement | null
    // Лента не задаёт отсчёт (не positioned): оба отсчитаны от одного предка.
    if (!parent || !container.contains(parent)) return top - container.offsetTop
    node = parent
  }
  return top
}

/**
 * Прокрутить к сообщению и поставить его посередине; не нарисовано — лента
 * открывается на нём (use-row-window). false — такого сообщения в ленте нет.
 */
async function scrollToMessage(id: string): Promise<boolean> {
  if (!props.messages.some((m) => m.id === id)) return false
  if (!shownRows.value.some((row) => rowKey(row) === id)) {
    focus(id)
    await nextTick()
  }
  const el = getListEl()
  const target = messageEl(id)
  if (!el || !target) return false
  el.scrollTop = offsetIn(target, el) - (el.clientHeight - target.offsetHeight) / 2
  return true
}

defineExpose({ scrollToMessage })

/** Нарисованная строка сообщения; не нарисована — null. */
function messageEl(id: string): HTMLElement | null {
  const el = getListEl()
  // Сравнением, а не селектором: в id Matrix бывают знаки, которые пришлось бы экранировать.
  const rows = el?.querySelectorAll<HTMLElement>('[data-message-id]') ?? []
  return [...rows].find((node) => node.dataset.messageId === id) ?? null
}

/** Сообщение хоть частью на экране ленты. */
function inView(id: string): boolean {
  const el = getListEl()
  const target = messageEl(id)
  if (!el || !target) return false
  const top = offsetIn(target, el)
  return top < el.scrollTop + el.clientHeight && top + target.offsetHeight > el.scrollTop
}

/** Ответ, к которому ведёт стрелка, снова на экране — возвращаться не к чему. */
function checkReturned(): void {
  if (props.returnId && inView(props.returnId)) emit('returned')
}
// Исходное было рядом с ответом — после перехода оба на экране, стрелка не нужна.
watch(
  () => props.returnId,
  async (id) => {
    if (!id) return
    await nextTick()
    checkReturned()
  }
)

useSearchHighlight({
  list: getListEl,
  tokens: () => props.highlight,
  currentId: () => props.focusId,
  rows: () => shownRows.value,
})

/**
 * Дорисовать строки сверху так, чтобы то, что на экране, осталось на месте:
 * прокрутка сдвигается на столько, на сколько уехала верхняя нарисованная
 * строка (якорь браузера у ленты выключен). По offsetTop, а не по
 * getBoundingClientRect: окно мессенджера раскрывается с transform: scale,
 * и экранные пиксели тогда не равны пикселям прокрутки.
 */
async function revealOlder(): Promise<void> {
  const el = getListEl()
  const anchor = el?.querySelector<HTMLElement>('[data-row]') ?? null
  const before = anchor?.offsetTop ?? 0
  showMore()
  await nextTick()
  if (el && anchor?.isConnected) el.scrollTop += anchor.offsetTop - before
}

function checkAndLoadMore(): void {
  const el = getListEl()
  if (el && el.scrollHeight <= el.clientHeight + 100) {
    // Не заполнили экран нарисованным — сначала дорисовать, потом к серверу.
    if (hiddenRows.value > 0) {
      void revealOlder().then(() => setTimeout(checkAndLoadMore, 0))
      return
    }
    emit('load-more')
  }
}

onMounted(() => {
  scrollToBottom()
  setTimeout(checkAndLoadMore, 1000)
})

watch(
  () => props.messages,
  async (newVal, oldVal) => {
    const el = getListEl()
    if (!el) return

    const oldScrollHeight = el.scrollHeight
    const oldScrollTop = el.scrollTop
    const isAtBottom = oldScrollHeight - oldScrollTop - el.clientHeight < 100

    await nextTick()

    const newScrollHeight = el.scrollHeight

    if (newVal !== oldVal) {
      const isSameChat =
        newVal.length > 0 &&
        oldVal &&
        oldVal.length > 0 &&
        newVal[newVal.length - 1]?.id === oldVal[oldVal.length - 1]?.id

      if (!oldVal || oldVal.length === 0 || !isSameChat) {
        // Новый чат или начальная загрузка — прыгаем в самый низ.
        el.scrollTop = newScrollHeight
        setTimeout(checkAndLoadMore, 500)
        return
      }

      // История подгрузилась в начало (prepend) — сохраняем визуальную позицию,
      // компенсируя сдвиг от добавленных сверху сообщений.
      if (newVal.length > oldVal.length && newVal[0]?.id !== oldVal[0]?.id) {
        el.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight)
        return
      }
    }

    if (isAtBottom) {
      el.scrollTop = newScrollHeight
    }
  },
  { deep: true }
)

let lastScrollTime = 0

let revealing = false

function handleScroll(e: Event): void {
  const target = e.target as HTMLElement
  checkReturned()
  // Открыта на найденном выше конца: у низа дорисовываем следующие строки.
  if (hiddenBelow.value > 0 && target.scrollHeight - target.scrollTop - target.clientHeight < 200) {
    showNewer()
  }
  if (target.scrollTop < 200) {
    // Выше ещё есть нарисованное не всё — дорисовываем, к серверу не ходим.
    if (hiddenRows.value > 0) {
      if (revealing) return
      revealing = true
      void revealOlder().finally(() => {
        revealing = false
      })
      return
    }
    const now = Date.now()
    if (now - lastScrollTime > 500) {
      console.error('[MessageList] Load more triggered (emit load-more)')
      emit('load-more')
      lastScrollTime = now
    }
  }
}

/**
 * Сообщение — первое в подряд идущей серии от одного отправителя.
 * Используется для показа имени и аватарки только у первого в группе:
 * визуально это даёт «слипшиеся» бабблы без повторов меты на каждом сообщении.
 */
function isFirstInGroup(index: number): boolean {
  if (index === 0) return true
  const current = props.messages[index]
  const previous = props.messages[index - 1]
  // После отметки «удалено» серия начинается заново.
  return current?.senderId !== previous?.senderId || !!previous?.deleted
}
</script>
