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
