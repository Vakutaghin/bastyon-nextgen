import styled from 'vue3-styled-components'
import { SC_UserStats } from '@/b-components/profile/profile-sidebar/styled'

export const SC_ChatRoomContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`

export const SC_PartnerStats = styled(SC_UserStats)`
  justify-content: center;
  gap: 16px;
`

/** Панель ввода — фон окна и линия сверху, как у промпта в чат-шаблоне Nuxt. */
export const SC_MessageInputArea = styled.div`
  padding: 12px;
  background-color: var(--ui-bg);
  border-top: 1px solid var(--ui-border);
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
`

/**
 * Панель ввода обычного чата. Кнопки прижаты к низу: поле растёт вверх, а
 * отправка остаётся у последней строки, как в Telegram. Раньше они висели
 * посередине многострочного поля.
 */
export const SC_ChatInputBar = styled.div`
  padding: 8px 12px;
  background-color: var(--ui-bg);
  border-top: 1px solid var(--ui-border);
  display: flex;
  align-items: flex-end;
  gap: 6px;
  position: relative;
`

/** Ячейка высотой с однострочное поле: маленькие кнопки стоят по его центру. */
export const SC_InputSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  flex-shrink: 0;

  /* Голосового ввода нет (не приложение для компьютера) — ячейка не занимает места. */
  &:empty {
    display: none;
  }
`

export const SC_MessageInput = styled.textarea`
  flex: 1;
  box-sizing: border-box;
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-3xl);
  padding: 8px 16px;
  font-size: 14px;
  color: var(--ui-text-highlighted);
  background: var(--ui-bg);
  outline: none;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
  resize: none;
  overflow-y: auto;
  /* Одна строка — 40px, вровень с кнопками. Окно чата на компьютере задаёт
     предел по своей высоте (messenger-window): растянули окно — поле растёт выше. */
  min-height: 40px;
  max-height: var(--chat-input-max-height, 125px);
  line-height: 22px;
  font-family: inherit;

  &::placeholder {
    color: var(--ui-text-dimmed);
  }

  &:focus {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 3px rgb(var(--ui-primary-rgb) / 25%);
  }

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--ui-border-accented);
    border-radius: var(--ui-radius-xs);
  }
`

export const SC_SendButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: var(--ui-primary);
  color: var(--ui-text-inverted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  flex-shrink: 0;

  &:disabled {
    background-color: var(--ui-bg-elevated);
    color: var(--ui-text-dimmed);
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background-color: rgb(var(--ui-primary-rgb) / 75%);
    color: var(--ui-text-inverted);
  }

  /* Иконки Lucide — контурные: заливка превратила бы их в сплошные пятна. */
  svg {
    width: 20px;
    height: 20px;
  }
`

export const SC_EmojiToggleButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background-color: transparent;
  color: var(--ui-text-dimmed);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);
  flex-shrink: 0;

  &:hover {
    color: var(--ui-text-highlighted);
    background-color: var(--ui-bg-elevated);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`

export const SC_VoiceButton = styled.button`
  /* Голосовое — на месте кнопки отправки и выглядит так же (solid-акцент);
     красной кнопка становится только во время записи. */
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: var(--ui-primary);
  color: var(--ui-text-inverted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    transform 0.05s;
  flex-shrink: 0;
  z-index: 10;
  user-select: none;
  -webkit-user-select: none;
  /* Жест целиком наш: без прокрутки, масштаба и меню долгого нажатия —
     иначе система забирала касание посреди записи. */
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background-color: rgb(var(--ui-primary-rgb) / 75%);
    color: var(--ui-text-inverted);
  }

  /* Кнопка едет за пальцем без задержки: transform без перехода. */
  &.recording,
  &.recording:hover {
    background-color: var(--ui-error);
    transform: translate(var(--voice-dx, 0), var(--voice-dy, 0)) scale(1.15);
    transition: background-color var(--transition-fast);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`

export const SC_RecordingTimer = styled.div`
  align-self: center;
  font-family: var(--font-family-mono);
  color: var(--color-red-dark);
  font-size: 16px;
  font-weight: 500;
  margin-right: auto;
  padding-left: 8px;
  display: flex;
  align-items: center;
  gap: 8px;

  /* Точка мигает, когда микрофон уже пишет; до этого — бледная. */
  &::before {
    content: '';
    display: block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: var(--color-red-dark);
    opacity: 0.35;
  }

  &.live::before {
    opacity: 1;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }

    50% {
      opacity: 0.5;
    }

    100% {
      opacity: 1;
    }
  }
`

/** «Влево — отмена»: едет за пальцем и бледнеет к порогу отмены. */
export const SC_SwipeHint = styled.div`
  align-self: center;
  color: var(--ui-text-dimmed);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
  user-select: none;
  -webkit-user-select: none;
  transform: translateX(var(--voice-dx, 0));
  opacity: calc(1 - 0.7 * var(--voice-cancel, 0));

  svg {
    width: 16px;
    height: 16px;
    animation: slideLeft 1.5s infinite;
  }

  @keyframes slideLeft {
    0% {
      transform: translateX(0);
      opacity: 1;
    }

    50% {
      transform: translateX(-5px);
      opacity: 0.8;
    }

    100% {
      transform: translateX(0);
      opacity: 1;
    }
  }
`

/**
 * Замок над кнопкой записи: вверх до него — пишется без пальца. Стоит так,
 * что кнопка, едущая за пальцем, доходит до него ровно на пороге замка
 * (LOCK_DISTANCE_PX), и ярче по мере того, как подходит.
 */
export const SC_LockHint = styled.div`
  position: absolute;
  right: 12px;
  bottom: calc(100% + 24px);
  width: 40px;
  padding: 10px 0 6px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border-radius: var(--ui-radius-3xl);
  border: 1px solid var(--ui-border);
  background-color: var(--ui-bg);
  box-shadow: var(--ui-shadow-md);
  color: var(--ui-text-muted);
  pointer-events: none;
  z-index: 11;
  opacity: calc(0.75 + 0.25 * var(--voice-lock, 0));

  svg {
    width: 18px;
    height: 18px;
  }

  svg + svg {
    width: 14px;
    height: 14px;
    animation: lockNudge 1.2s infinite;
  }

  @keyframes lockNudge {
    0%,
    100% {
      transform: translateY(0);
    }

    50% {
      transform: translateY(-3px);
    }
  }
`

/** Нажали и сразу отпустили: подсказка над кнопкой записи. */
export const SC_HoldHint = styled.div`
  position: absolute;
  right: 8px;
  bottom: calc(100% + 8px);
  max-width: calc(100% - 16px);
  padding: 6px 10px;
  border-radius: var(--ui-radius-md);
  background-color: var(--ui-bg-inverted);
  color: var(--ui-text-inverted);
  font-size: 12px;
  line-height: calc(1.35 * var(--leading-scale));
  box-shadow: var(--ui-shadow-md);
  pointer-events: none;
  z-index: 11;
`

export const SC_CancelButton = styled.button`
  align-self: center;
  color: var(--color-red-ant);
  background: none;
  border: none;
  font-weight: 500;
  cursor: pointer;
  padding: 8px;

  &:hover {
    text-decoration: underline;
  }
`

/** Новый чат: собеседник увидит его, когда уйдёт первое сообщение. */
export const SC_FirstMessageHint = styled.div`
  padding: 16px 20px;
  color: var(--ui-text-muted);
  font-size: 13px;
  line-height: calc(1.45 * var(--leading-scale));
  text-align: center;
`

export const SC_PartnerHeader = styled.div`
  padding: 16px 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
`

export const SC_PartnerAvatar = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--ui-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-fallback {
    font-size: 18px;
    font-weight: 500;
    color: var(--color-slate);
    user-select: none;
  }
`

export const SC_PartnerName = styled.div`
  font-weight: 600;
  font-size: 16px;
  color: var(--ui-text-highlighted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_PartnerInfoCard = styled.div`
  margin: 16px auto 12px;
  padding: 16px 16px 6px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  max-width: 380px;
  box-sizing: border-box;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-bg-primary);
  box-shadow: var(--shadow-sm);
`

export const SC_ChatRoomLoader = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--ui-text-dimmed);
  font-size: 14px;
`

export const SC_ChatRoomSpinner = styled.span`
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid var(--ui-border);
  border-top-color: var(--color-text-secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_ChatRoomLoaderText = styled.span`
  margin: 0;
`

export const SC_ChatRoomEmptyHint = styled.div`
  padding: 12px 16px;
  color: var(--ui-text-dimmed);
  font-size: 14px;
  line-height: calc(1.4 * var(--leading-scale));
  flex-shrink: 0;
`

export const SC_TypingIndicator = styled.div`
  padding: 2px 16px 6px;
  color: var(--ui-text-dimmed);
  font-size: 12px;
  font-style: italic;
  flex-shrink: 0;
`

export const SC_SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ui-border);
  flex-shrink: 0;
`

export const SC_SearchIcon = styled.span`
  display: inline-flex;
  color: var(--ui-text-dimmed);
  font-size: 16px;
`

export const SC_SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: none;
  font-size: 14px;
  color: var(--color-text-primary);

  &::placeholder {
    color: var(--ui-text-dimmed);
  }
`

export const SC_SearchCount = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  color: var(--ui-text-dimmed);
`

export const SC_BlockBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: none;
  color: var(--ui-text-dimmed);
  font-size: 16px;
  cursor: pointer;
  transition: color var(--transition-fast);

  &:hover {
    color: var(--color-danger);
  }

  &.blocked {
    color: var(--color-danger);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
`

/** Баннер «отвечаем на сообщение» над полем ввода. */
export const SC_ReplyBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--color-bg-light);
  border-top: 1px solid var(--ui-border);
`

export const SC_ReplyBannerBar = styled.div`
  width: 3px;
  align-self: stretch;
  border-radius: var(--ui-radius-xs);
  background: var(--ui-primary);
  flex-shrink: 0;
`

export const SC_ReplyBannerBody = styled.div`
  flex: 1;
  min-width: 0;
`

export const SC_ReplyBannerTitle = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-primary);
`

export const SC_ReplyBannerText = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_ReplyBannerClose = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  color: var(--color-text-secondary);
  padding: 0 4px;
  flex-shrink: 0;

  &:hover {
    color: var(--color-text-primary);
  }
`

// Баннер «ключи собеседника изменились» (TOFU, аудит P3-3).
export const SC_KeyChangedBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--color-danger-bg-soft);
  border-bottom: 1px solid var(--color-danger);
  flex-shrink: 0;
`

export const SC_KeyChangedText = styled.span`
  flex: 1;
  font-size: 12px;
  line-height: calc(1.35 * var(--leading-scale));
  color: var(--color-danger-deep);
`

export const SC_KeyChangedAccept = styled.button`
  flex-shrink: 0;
  background: none;
  border: 1px solid var(--color-danger);
  border-radius: var(--ui-radius-md);
  padding: 4px 10px;
  font-size: 12px;
  color: var(--color-danger-deep);
  cursor: pointer;

  &:hover {
    background: var(--color-danger);
    color: var(--ui-text-inverted);
  }
`
