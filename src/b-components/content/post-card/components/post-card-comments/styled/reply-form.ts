import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

/** Плашка ответа под комментарием: аватар + textarea + кнопки */
export const SC_ReplyPanel = styled.div`
  margin-top: 10px;
  padding: 10px 12px;
  background: #f5f5f5;
  border: 1px solid #eee;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;

  .reply-avatar,
  .reply-avatar-placeholder {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: rgb(222, 226, 230);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .reply-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .reply-avatar-placeholder {
    color: ${COLORS.TEXT_PRIMARY};
    font-weight: 600;
    font-size: 14px;
  }
`

/** Вложенная плашка ответа 1-го уровня (ответ на комментарий): отступ слева для визуальной ветки */
export const SC_ReplyPanelNested = styled(SC_ReplyPanel)`
  margin-left: 50px;
  width: calc(100% - 50px);
`

/** Вложенная плашка ответа 2-го уровня (ответ на ответ): без доп. отступа, т.к. уже внутри ветки с отступом */
export const SC_ReplyPanelNestedLevel2 = styled(SC_ReplyPanel)``

export const SC_ReplyInputWrap = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_ReplyTextarea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #ddd;
  border-radius: 16px;
  padding: 8px 14px;
  font-size: 14px;
  outline: none;
  resize: none;
  overflow-y: auto;
  min-height: 36px;
  max-height: 120px;
  line-height: 1.45;
  font-family: inherit;
  background: #fff;

  &:focus {
    border-color: #00a4ff;
  }

  &::placeholder {
    color: ${COLORS.TEXT_SECONDARY};
  }
`

export const SC_ReplySendBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #00a4ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  &:not(:disabled):hover {
    background: #0088d1;
  }
  svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }
`

/** Сетка эмодзи внутри popover (без абсолютного позиционирования) */
export const SC_EmojiGridPanel = styled.div`
  width: 280px;
  max-height: 240px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${COLORS.GRAY_CCC};
    border-radius: 2px;
  }
`

export const SC_EmojiCellBtn = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${COLORS.BG_HOVER};
  }
`

/** Кнопка-триггер пикера эмодзи (рядом с полем ввода) */
export const SC_EmojiTriggerBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: ${COLORS.TEXT_SECONDARY};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: ${COLORS.TEXT_PRIMARY};
  }
  svg {
    width: 20px;
    height: 20px;
  }
`

export const SC_ReplyCancelBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: ${COLORS.TEXT_SECONDARY};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: ${COLORS.TEXT_PRIMARY};
  }
  svg {
    width: 18px;
    height: 18px;
  }
`

/** Инлайн-подтверждение отмены ответа (без модалки, без скачка скролла) */
export const SC_ConfirmWrap = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

export const SC_ConfirmMessage = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  flex: 1;
`

export const SC_ConfirmActions = styled.div`
  display: flex;
  gap: 8px;
  flex-shrink: 0;
`

export const SC_ConfirmBtn = styled.button`
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: #fff;
  font-size: 13px;
  color: ${COLORS.TEXT_PRIMARY};
  cursor: pointer;

  &:hover {
    background: #f5f5f5;
    border-color: #ccc;
  }

  &.confirm-btn--primary {
    background: #00a4ff;
    border-color: #00a4ff;
    color: #fff;
  }
  &.confirm-btn--primary:hover {
    background: #0088d1;
    border-color: #0088d1;
  }
`

/** Счётчик оставшихся символов под полем ввода. Показывается только когда осталось мало. */
export const SC_LengthCounter = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  padding: 2px 14px 0;
  line-height: 1.3;

  &.length-counter--bad {
    color: #ff4d4f;
  }
`
