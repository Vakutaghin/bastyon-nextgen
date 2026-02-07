import styled from 'vue3-styled-components'


export const SC_MessageInputArea = styled.div`
  padding: 12px;
  background-color: #f9f9f9;
  border-top: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
`

export const SC_MessageInput = styled.textarea`
  flex: 1;
  box-sizing: border-box;
  border: 1px solid #ddd;
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
    border-color: #00A3F7;
  }

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 2px;
  }
`

export const SC_SendButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: #00A3F7;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background-color: #0088d1;
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
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s;
  flex-shrink: 0;

  &:hover {
    color: #00A3F7;
    background-color: #f0f0f0;
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
  background-color: #ef5350;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.05s;
  flex-shrink: 0;
  z-index: 10;
  user-select: none;
  -webkit-user-select: none;

  &.recording {
    background-color: #d32f2f;
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
  color: #d32f2f;
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
    background-color: #d32f2f;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
`

export const SC_SwipeHint = styled.div`
  color: #888;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  animation: slideLeft 1.5s infinite;

  @keyframes slideLeft {
    0% { transform: translateX(0); opacity: 1; }
    50% { transform: translateX(-5px); opacity: 0.8; }
    100% { transform: translateX(0); opacity: 1; }
  }
`

export const SC_CancelButton = styled.button`
  color: #ef5350;
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
  background-color: #00A3F7;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  box-shadow: 0 2px 6px rgba(0, 163, 247, 0.25);
  &:hover {
    background-color: #0088d1;
  }
`

export const SC_PartnerHeader = styled.div`
  padding: 16px 20px 0 20px;
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
  background: #e0e4e8;
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
    color: #5c6370;
    user-select: none;
  }
`

export const SC_PartnerName = styled.div`
  font-weight: 600;
  font-size: 15px;
  color: #000;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_PartnerInfoCard = styled.div`
  margin: 16px auto 12px;
  padding: 16px 16px 6px 16px;
  border: 1px solid #e9e9e9;
  border-radius: 12px;
  max-width: 380px;
  box-sizing: border-box;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
`
