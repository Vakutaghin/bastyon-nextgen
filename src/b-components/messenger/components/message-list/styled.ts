import styled from 'vue3-styled-components'

export const SC_MessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  /* Сообщения прижаты к полю ввода, как в переписке: отправленное, пока
     история грузится, встаёт внизу, а не под шапкой. */
  & > :first-child {
    margin-top: auto;
  }
`

/** История ещё грузится: строка над тем, что уже на экране. */
export const SC_HistoryLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  color: var(--ui-text-dimmed);
  font-size: 12px;
  line-height: calc(1.4 * var(--leading-scale));
`

export const SC_HistoryLoadingSpinner = styled.span`
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--ui-border);
  border-top-color: var(--color-text-secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`

/** Граница сохранённого на устройстве: черта с подписью посередине. */
export const SC_ArchiveDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin: 4px 0;
  color: var(--ui-text-dimmed);
  font-size: 12px;
  line-height: calc(1.4 * var(--leading-scale));
  text-align: center;

  &::before,
  &::after {
    content: '';
    flex: 1;
    min-width: 16px;
    border-top: 1px dashed var(--ui-border-accented);
  }

  span {
    max-width: 360px;
  }
`
