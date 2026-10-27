import styled from 'vue3-styled-components'

/** Пометка об истории чата: по центру, мелко, как служебные строки мессенджеров. */
export const SC_HistoryNote = styled.div`
  align-self: center;
  max-width: min(100%, 420px);
  padding: 8px 12px;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: calc(1.45 * var(--leading-scale));
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;

  &.error {
    color: var(--ui-error);
  }
`

export const SC_HistoryLine = styled.span`
  overflow-wrap: anywhere;
`

export const SC_HistoryDetails = styled.span`
  color: var(--ui-text-dimmed);
  overflow-wrap: anywhere;
`

export const SC_HistoryRetry = styled.button`
  margin-top: 4px;
  padding: 2px 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-elevated);
  }
`

/** «Вы удалили сообщение · 14:30» — строка ленты вместо удалённого. */
export const SC_DeletedMark = styled.div`
  align-self: center;
  padding: 2px 10px;
  border-radius: var(--ui-radius-full);
  color: var(--ui-text-dimmed);
  font-size: 12px;
  font-style: italic;
  flex-shrink: 0;
`
