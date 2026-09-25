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

export const SC_MessageInput = styled.textarea`
  flex: 1;
  box-sizing: border-box;
  border: 1px solid var(--ui-border-accented);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  color: var(--ui-text-highlighted);
  background: var(--ui-bg);
  outline: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  resize: none;
  overflow-y: auto;
  min-height: 39px;
  max-height: 125px;
  line-height: 1.5;
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
    background: var(--color-gray-ccc);
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
  transition: background-color 0.2s;
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
  color: var(--color-gray-888);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    color 0.2s,
    background-color 0.2s;
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
    background-color 0.2s,
    transform 0.05s;
  flex-shrink: 0;
  z-index: 10;
  user-select: none;
  -webkit-user-select: none;

  &:hover {
    background-color: rgb(var(--ui-primary-rgb) / 75%);
    color: var(--ui-text-inverted);
  }

  &.recording,
  &.recording:hover {
    background-color: var(--ui-error);
    transform: scale(1.1);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`

export const SC_RecordingTimer = styled.div`
  font-family: var(--font-family-mono);
  color: var(--color-red-dark);
  font-size: 16px;
  font-weight: 500;
  margin-right: auto;
  padding-left: 8px;
  display: flex;
  align-items: center;
  gap: 8px;

  &::before {
    content: '';
    display: block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: var(--color-red-dark);
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

export const SC_SwipeHint = styled.div`
  color: var(--color-gray-888);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  animation: slideLeft 1.5s infinite;

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

export const SC_CancelButton = styled.button`
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

export const SC_StartChatContainer = styled.div`
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  box-sizing: border-box;
`

export const SC_StartChatButton = styled.button`
  padding: 10px 16px;
  border-radius: var(--ui-radius-lg);
  border: none;
  background-color: var(--color-brand-cyan);
  color: var(--ui-text-inverted);
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  box-shadow: var(--shadow-sm);

  &:hover {
    background-color: var(--color-brand-cyan-hover);
  }
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
  background: var(--color-gray-e0);
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
  border: 1px solid var(--color-gray-eee);
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
  color: var(--color-gray-888);
  font-size: 14px;
`

export const SC_ChatRoomSpinner = styled.span`
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-gray-e0);
  border-top-color: var(--color-text-secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_ChatRoomLoaderText = styled.span`
  margin: 0;
`

export const SC_ChatRoomEmptyHint = styled.div`
  padding: 12px 16px;
  color: var(--color-gray-888);
  font-size: 14px;
  line-height: 1.4;
  flex-shrink: 0;
`

export const SC_TypingIndicator = styled.div`
  padding: 2px 16px 6px;
  color: var(--color-gray-888);
  font-size: 12px;
  font-style: italic;
  flex-shrink: 0;
`

export const SC_SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-gray-eee);
  flex-shrink: 0;
`

export const SC_SearchIcon = styled.span`
  display: inline-flex;
  color: var(--color-gray-888);
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
    color: var(--color-gray-888);
  }
`

export const SC_SearchCount = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-gray-888);
`

export const SC_BlockBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: none;
  color: var(--color-gray-888);
  font-size: 16px;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: var(--color-danger);
  }

  &.blocked {
    color: var(--color-danger);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`

/** Баннер «отвечаем на сообщение» над полем ввода. */
export const SC_ReplyBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--color-bg-light);
  border-top: 1px solid var(--color-gray-eee);
`

export const SC_ReplyBannerBar = styled.div`
  width: 3px;
  align-self: stretch;
  border-radius: var(--ui-radius-xs);
  background: var(--color-brand-cyan);
  flex-shrink: 0;
`

export const SC_ReplyBannerBody = styled.div`
  flex: 1;
  min-width: 0;
`

export const SC_ReplyBannerTitle = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-brand-cyan);
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
  line-height: 1.35;
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
