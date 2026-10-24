import styled from 'vue3-styled-components'

/** Красная плашка «Ошибка синхронизации» с причиной и «Повторить». */
export const SC_SyncErrorBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--color-red-bg);
  color: var(--color-red-dark);
  font-size: 12px;
`

export const SC_SyncErrorText = styled.div`
  flex: 1;
  min-width: 0;
`

/** HTTP-код или «fetch failed…» — мелко, для поддержки. */
export const SC_SyncErrorDetail = styled.div`
  margin-top: 2px;
  opacity: 0.75;
  font-family: var(--font-family-mono);
  font-size: 11px;
  word-break: break-word;
`

export const SC_SyncRetryButton = styled.button`
  flex: 0 0 auto;
  padding: 4px 10px;
  border: 1px solid currentcolor;
  border-radius: var(--ui-radius-md);
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`
