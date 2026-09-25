import styled from 'vue3-styled-components'

/** Плашка ответа под комментарием: аватар + textarea + кнопки */
export const SC_ReplyPanel = styled.div`
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-gray-eee);
  border-radius: var(--ui-radius-lg);
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
    background: var(--color-border-dark);
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
    color: var(--color-text-primary);
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
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-lg);
  padding: 8px 12px;
  font-size: 14px;
  outline: none;
  resize: none;
  overflow-y: auto;
  min-height: 36px;
  max-height: 120px;
  line-height: 1.45;
  font-family: inherit;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);

  &:focus {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 3px rgb(var(--ui-primary-rgb) / 25%);
  }

  &::placeholder {
    color: var(--ui-text-dimmed);
  }
`

export const SC_ReplySendBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: var(--ui-radius-md);
  border: none;
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;

  &:disabled {
    background: var(--ui-bg-elevated);
    color: var(--ui-text-dimmed);
    cursor: not-allowed;
  }
  &:not(:disabled):hover {
    background: rgb(var(--ui-primary-rgb) / 75%);
    color: var(--ui-text-inverted);
  }
  svg {
    width: 18px;
    height: 18px;
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
    background: var(--color-gray-ccc);
    border-radius: var(--ui-radius-xs);
  }
`

export const SC_EmojiCellBtn = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--ui-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--color-bg-hover);
  }
`

/** Кнопка-триггер пикера эмодзи (рядом с полем ввода) */
export const SC_EmojiTriggerBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  &:hover {
    background: var(--color-overlay-6);
    color: var(--color-text-primary);
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
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  &:hover {
    background: var(--color-overlay-6);
    color: var(--color-text-primary);
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
  color: var(--color-text-primary);
  flex: 1;
`

export const SC_ConfirmActions = styled.div`
  display: flex;
  gap: 8px;
  flex-shrink: 0;
`

export const SC_ConfirmBtn = styled.button`
  padding: 6px 14px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-gray-ddd);
  background: var(--color-bg-primary);
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;

  &:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-gray-ccc);
  }

  &.confirm-btn--primary {
    background: var(--ui-primary);
    border-color: var(--ui-primary);
    color: var(--ui-text-inverted);
  }
  &.confirm-btn--primary:hover {
    background: rgb(var(--ui-primary-rgb) / 75%);
    border-color: transparent;
    color: var(--ui-text-inverted);
  }
`

/** Счётчик оставшихся символов под полем ввода. Показывается только когда осталось мало. */
export const SC_LengthCounter = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 2px 14px 0;
  line-height: 1.3;

  &.length-counter--bad {
    color: var(--color-red-ant);
  }
`
