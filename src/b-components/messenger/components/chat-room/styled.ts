import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
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

export const SC_MessageInputArea = styled.div`
  padding: 12px;
  background-color: ${COLORS.BG_LIGHT};
  border-top: 1px solid ${COLORS.GRAY_EEE};
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
`

export const SC_MessageInput = styled.textarea`
  flex: 1;
  box-sizing: border-box;
  border: 1px solid ${COLORS.GRAY_DDD};
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  resize: none;
  overflow-y: auto;
  min-height: 39px;
  max-height: 125px;
  line-height: 1.5;
  font-family: inherit;

  &:focus {
    border-color: ${COLORS.BRAND_CYAN};
  }

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${COLORS.GRAY_CCC};
    border-radius: 2px;
  }
`

export const SC_SendButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: ${COLORS.BRAND_CYAN};
  color: ${COLORS.WHITE};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;

  &:disabled {
    background-color: ${COLORS.GRAY_CCC};
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background-color: ${COLORS.BRAND_CYAN_HOVER};
  }

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
    margin-left: 2px;
  }
`

export const SC_EmojiToggleButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background-color: transparent;
  color: ${COLORS.GRAY_888};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    color 0.2s,
    background-color 0.2s;
  flex-shrink: 0;

  &:hover {
    color: ${COLORS.BRAND_CYAN};
    background-color: ${COLORS.BG_HOVER};
  }

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
`

export const SC_VoiceButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: ${COLORS.RED_ANT};
  color: ${COLORS.WHITE};
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

  &.recording {
    background-color: ${COLORS.RED_DARK};
    transform: scale(1.1);
  }

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
`

export const SC_RecordingTimer = styled.div`
  font-family: monospace;
  color: ${COLORS.RED_DARK};
  font-size: 16px;
  font-weight: bold;
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
    background-color: ${COLORS.RED_DARK};
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
  color: ${COLORS.GRAY_888};
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
  color: ${COLORS.RED_ANT};
  background: none;
  border: none;
  font-weight: 600;
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
  border-radius: 8px;
  border: none;
  background-color: ${COLORS.BRAND_CYAN};
  color: ${COLORS.WHITE};
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  box-shadow: ${COLORS.SHADOW_SM};

  &:hover {
    background-color: ${COLORS.BRAND_CYAN_HOVER};
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
  background: ${COLORS.GRAY_E0};
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
    font-weight: 600;
    color: ${COLORS.SLATE};
    user-select: none;
  }
`

export const SC_PartnerName = styled.div`
  font-weight: 600;
  font-size: 15px;
  color: ${COLORS.TEXT_PRIMARY};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_PartnerInfoCard = styled.div`
  margin: 16px auto 12px;
  padding: 16px 16px 6px;
  border: 1px solid ${COLORS.GRAY_EEE};
  border-radius: 12px;
  max-width: 380px;
  box-sizing: border-box;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: ${COLORS.BG_PRIMARY};
  box-shadow: ${COLORS.SHADOW_SM};
`

export const SC_ChatRoomLoader = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: ${COLORS.GRAY_888};
  font-size: 14px;
`

export const SC_ChatRoomSpinner = styled.span`
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid ${COLORS.GRAY_E0};
  border-top-color: ${COLORS.TEXT_SECONDARY};
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_ChatRoomLoaderText = styled.span`
  margin: 0;
`

export const SC_ChatRoomEmptyHint = styled.div`
  padding: 12px 16px;
  color: ${COLORS.GRAY_888};
  font-size: 14px;
  line-height: 1.4;
  flex-shrink: 0;
`

export const SC_TypingIndicator = styled.div`
  padding: 2px 16px 6px;
  color: ${COLORS.GRAY_888};
  font-size: 12px;
  font-style: italic;
  flex-shrink: 0;
`

export const SC_SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid ${COLORS.GRAY_EEE};
  flex-shrink: 0;
`

export const SC_SearchIcon = styled.span`
  display: inline-flex;
  color: ${COLORS.GRAY_888};
  font-size: 15px;
`

export const SC_SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: none;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};

  &::placeholder {
    color: ${COLORS.GRAY_888};
  }
`

export const SC_SearchCount = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  color: ${COLORS.GRAY_888};
`

export const SC_BlockBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: none;
  color: ${COLORS.GRAY_888};
  font-size: 15px;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: ${COLORS.DANGER};
  }

  &.blocked {
    color: ${COLORS.DANGER};
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`
