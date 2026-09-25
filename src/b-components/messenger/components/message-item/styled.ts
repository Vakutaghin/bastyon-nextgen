import styled from 'vue3-styled-components'

export const SC_MessageItem = styled.div`
  max-width: 80%;
  min-width: 0;
  padding: 8px 12px;
  border-radius: var(--ui-radius-lg);
  font-size: 14px;
  line-height: 1.4;
  position: relative;
  white-space: pre-wrap;
  word-break: break-word;
  box-sizing: border-box;
  overflow: hidden;

  &.mine {
    background-color: var(--color-ant-blue-bg);
    color: var(--color-text-primary);
    border-bottom-right-radius: 4px;
  }

  &.others {
    background-color: var(--color-gray-f1);
    color: var(--color-text-primary);
    border-bottom-left-radius: 4px;
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
  font-size: 10px;
  opacity: 0.8;
`

export const SC_MessageTime = styled.span`
  font-size: 10px;
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
`

/** Слот для аватарки слева от чужого сообщения. Сохраняет место даже когда аватарка пустая, чтобы пузыри стояли ровно. */
export const SC_AvatarSlot = styled.div`
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
`

export const SC_MessageMeta = styled.div`
  font-size: 11px;
  opacity: 0.7;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
`

export const SC_ReactionsRow = styled.div`
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
    font-size: 15px;
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

export const SC_SeenTick = styled.span`
  margin-left: 4px;
  font-size: 10px;
  line-height: 1;
  color: var(--color-primary);
  letter-spacing: -2px;
`

/** Цитата сообщения, на которое отвечают (показывается над текстом). */
export const SC_ReplyQuote = styled.div`
  display: block;
  margin-bottom: 4px;
  padding: 4px 8px;
  border-left: 3px solid var(--color-brand-cyan);
  border-radius: var(--ui-radius-sm);
  background: var(--color-overlay-6);
  max-width: 100%;
`

export const SC_ReplyQuoteName = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: var(--color-brand-cyan);
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
  font-weight: 600;
  color: var(--color-danger);
  cursor: pointer;
  text-decoration: underline;

  &:hover {
    opacity: 0.8;
  }
`
