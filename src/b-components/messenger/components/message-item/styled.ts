import styled from 'vue3-styled-components'
import { noSelect } from '@/styles/chrome-styles'

export const SC_MessageItem = styled.div`
  max-width: 80%;
  min-width: 0;
  padding: 8px 12px;
  border-radius: var(--ui-radius-lg);
  font-size: 14px;
  line-height: calc(1.4 * var(--leading-scale));
  position: relative;
  white-space: pre-wrap;
  word-break: break-word;
  box-sizing: border-box;
  overflow: hidden;

  &.mine {
    background-color: rgb(var(--ui-primary-rgb) / 10%);
    color: var(--color-text-primary);
    border-bottom-right-radius: var(--ui-radius-sm);
  }

  &.others {
    background-color: var(--ui-bg-elevated);
    color: var(--color-text-primary);
    border-bottom-left-radius: var(--ui-radius-sm);
  }

  /* Найденное поиском по чату (chat-room, use-room-search). */
  &.found {
    box-shadow: 0 0 0 2px rgb(var(--ui-warning-rgb) / 80%);
  }

  /* К сообщению только что перешли — по цитате или к дате (use-chat-jump):
     подсветка гаснет сама. С «уменьшить движение» — держится и пропадает. */
  &.flash::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: rgb(var(--ui-primary-rgb) / 22%);
    pointer-events: none;
    animation: message-flash 1.6s ease-out forwards;
  }

  @keyframes message-flash {
    0%,
    40% {
      opacity: 1;
    }

    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &.flash::after {
      animation: none;
    }
  }
`

export const SC_AudioUrlMissing = styled.div`
  font-size: 0.8em;
  color: var(--color-red-ant);
`

export const SC_ReactionEmojiIcon = styled.span`
  font-size: 14px;
`

export const SC_ReactionCount = styled.span`
  font-size: 12px;
  opacity: 0.8;
`

export const SC_MessageTime = styled.span`
  ${noSelect}
  font-size: 12px;
  opacity: 0.7;
  display: block;
  text-align: right;
  margin-top: 4px;
`

export const SC_MessageRow = styled.div`
  display: flex;
  width: 100%;
  align-items: flex-end;
  gap: 8px;

  &.mine {
    justify-content: flex-end;
  }

  &.others {
    justify-content: flex-start;
  }

  /* Режим выделения: подсветка выделенного — во всю ширину ленты, поверх её
     отступов (16 px, message-list) и щелей между строками (8 px). */
  &.selecting {
    position: relative;
    isolation: isolate;
  }

  &.selecting::before {
    content: '';
    position: absolute;
    inset: -4px -16px;
    z-index: -1;
    pointer-events: none;
    background: transparent;
    transition: background-color var(--transition-fast);
  }

  &.selecting:hover::before {
    background: var(--color-overlay-6);
  }

  &.selected::before,
  &.selected:hover::before {
    background: rgb(var(--ui-primary-rgb) / 14%);
  }

  /* Ответ смахиванием (message-list/use-swipe-reply): строка едет за пальцем
     влево, справа проступает стрелка — кружок (::before) и стрелка (::after).
     В режиме выделения смахивания нет, ::before здесь свободен. */
  &.swiping {
    position: relative;
    transform: translateX(var(--swipe-x, 0));
  }

  &.swipe-settle {
    transition: transform var(--transition-fast);
  }

  &.swiping::before,
  &.swiping::after {
    content: '';
    position: absolute;
    top: 50%;
    left: calc(100% + 12px);
    width: 32px;
    height: 32px;
    margin-top: -16px;
    pointer-events: none;
    opacity: var(--swipe-progress, 0);
    transform: scale(calc(0.6 + 0.4 * var(--swipe-progress, 0)));
  }

  &.swiping::before {
    border-radius: 50%;
    background: var(--color-overlay-6);
    transition: background-color var(--transition-fast);
  }

  &.swiping::after {
    background: var(--ui-text-muted);
    /* iOS 15.0–15.3: маска только с префиксом. */
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z'/%3E%3C/svg%3E")
      center / 18px no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z'/%3E%3C/svg%3E")
      center / 18px no-repeat;
  }

  /* Дальше порога: отпустить — ответ. */
  &.swipe-armed::before {
    background: var(--ui-primary);
  }

  &.swipe-armed::after {
    background: var(--ui-bg);
  }
`

/** Кружок выделения слева от сообщения; у своих — прижат к левому краю. */
export const SC_SelectCheck = styled.button`
  ${noSelect}
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-bottom: 5px;
  padding: 0;
  border: 2px solid var(--ui-border-accented);
  border-radius: 50%;
  background: var(--ui-bg);
  color: var(--ui-bg);
  font-size: 13px;
  cursor: pointer;
  animation: select-check-in var(--transition-fast);

  &.mine {
    margin-right: auto;
  }

  &.on {
    border-color: var(--ui-primary);
    background: var(--ui-primary);
  }

  @keyframes select-check-in {
    from {
      opacity: 0;
      transform: scale(0.6);
    }
  }
`

/** Слот для аватарки слева от чужого сообщения. Сохраняет место даже когда аватарка пустая, чтобы пузыри стояли ровно. */
export const SC_AvatarSlot = styled.div`
  ${noSelect}
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
`

export const SC_MessageMeta = styled.div`
  ${noSelect}
  font-size: 12px;
  opacity: 0.7;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
`

export const SC_ReactionsRow = styled.div`
  ${noSelect}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
`

export const SC_ReactionPill = styled.span`
  font-size: 12px;
  padding: 2px 6px;
  border-radius: var(--ui-radius-lg);
  background: var(--color-overlay-6);
  cursor: default;
  display: inline-flex;
  align-items: center;
  gap: 2px;

  &.mine {
    background: var(--color-primary-light-15);
  }
`

export const SC_ReactionButton = styled.button`
  padding: 2px 6px;
  margin-left: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.6;
  border-radius: var(--ui-radius-md);
  display: inline-flex;
  align-items: center;

  &:hover {
    opacity: 1;
    background: var(--color-overlay-6);
  }
`

export const SC_ReactionPicker = styled.div`
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 4px;
  padding: 6px 8px;
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--shadow-md);
  display: flex;
  gap: 4px;
  z-index: 10;
`

/** Кнопка «…» — открывает меню действий над сообщением (ответ/удаление). */
export const SC_ActionsButton = styled.button`
  padding: 2px 6px;
  margin-left: 2px;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.6;
  border-radius: var(--ui-radius-md);
  display: inline-flex;
  align-items: center;
  color: inherit;

  &:hover {
    opacity: 1;
    background: var(--color-overlay-6);
  }
`

/** Контент Popover-меню действий. */
export const SC_ActionsMenu = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 140px;
`

export const SC_ActionsItem = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: var(--color-bg-hover);
  }

  &.danger {
    color: var(--color-danger);
  }

  .anticon {
    font-size: 16px;
  }
`

export const SC_ReactionPickerEmoji = styled.button`
  padding: 4px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  border-radius: var(--ui-radius-md);

  &:hover {
    background: var(--color-overlay-6);
  }
`

/** «…» и «✓» — приглушённо, «✓✓» (прочитано, подтверждено радио) — цветом. */
export const SC_SeenTick = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  font-size: 12px;
  line-height: 1;
  vertical-align: -1px;
  color: var(--ui-text-muted);

  svg {
    display: block;
    width: auto;
    height: 0.9em;
  }

  &.done {
    color: var(--color-primary);
  }
`

/** Сообщение есть только в копии на устройстве: сервер его уже стёр. */
export const SC_LocalOnlyMark = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  font-size: 11px;
  line-height: 1;
  color: var(--ui-text-dimmed);
  cursor: help;
`

/** Цитата сообщения, на которое отвечают (показывается над текстом). */
export const SC_ReplyQuote = styled.div`
  ${noSelect}
  display: block;
  margin-bottom: 4px;
  padding: 4px 8px;
  border-left: 3px solid var(--ui-primary);
  border-radius: var(--ui-radius-sm);
  background: var(--color-overlay-6);
  max-width: 100%;

  /* Ведёт к исходному сообщению. */
  &.link {
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  &.link:hover {
    background: var(--color-overlay-10);
  }

  &.link:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`

export const SC_ReplyQuoteName = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-primary);
`

export const SC_ReplyQuoteText = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
`

/** Плашка «не отправлено» под сообщением с кнопкой повтора (S35). */
export const SC_SendFailed = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-danger);
`

export const SC_RetryButton = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-danger);
  cursor: pointer;
  text-decoration: underline;

  &:hover {
    opacity: 0.8;
  }
`

/** «Написать через Reticulum» у сообщения с адресом `lxmf@…`. */
export const SC_MeshRouteButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 4px 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-primary);
  background: var(--ui-bg);
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-elevated);
  }
`

/** Запись связки с Reticulum в сообщении: что она даёт. */
export const SC_MeshBindingNote = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: var(--ui-text-muted);
`

/** Сообщение не расшифровалось: курсивом, приглушённо — это сбой, а не текст. */
export const SC_UndecryptableNote = styled.span`
  font-style: italic;
  color: var(--ui-text-muted);
`
