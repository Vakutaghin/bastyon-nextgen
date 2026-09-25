import styled from 'vue3-styled-components'

export const SC_TxBadge = styled.span`
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: var(--ui-radius-lg);
  font-size: 10px;
  font-weight: 500;
  vertical-align: middle;
  background: var(--color-primary-light);
  color: var(--color-primary);

  &.stake {
    background: var(--color-success-bg-tint);
    color: var(--color-success);
  }
`

export const SC_History = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const SC_HistoryHint = styled.div`
  font-size: 12px;
  color: var(--color-gray-999);
  margin-bottom: 8px;
`

export const SC_HistoryRow = styled.a`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-border-light);
  text-decoration: none;
  color: inherit;
  transition: background-color var(--transition-quick);

  &:hover {
    background-color: var(--color-brand-cyan-soft);
  }
`

export const SC_DirIcon = styled.div`
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;

  &.in {
    color: var(--color-success);
    background-color: var(--color-success-bg-12);
  }

  &.out {
    color: var(--color-red-ant);
    background-color: var(--color-danger-bg-soft);
  }
`

export const SC_HistoryMid = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_HistoryDirLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
`

export const SC_HistoryCounterparty = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_HistoryAmount = styled.div`
  flex: 0 0 auto;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;

  &.in {
    color: var(--color-success);
  }

  &.out {
    color: var(--color-text-primary);
  }
`

export const SC_HistoryTime = styled.div`
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--color-gray-999);
  min-width: 64px;
  text-align: right;
`

export const SC_HistoryEmpty = styled.div`
  padding: 24px 12px;
  text-align: center;
  color: var(--color-gray-999);
  font-size: 14px;
`

export const SC_HistoryError = styled.div`
  padding: 16px 12px;
  text-align: center;
  color: var(--color-red-ant);
  font-size: 14px;
`

export const SC_LoadMoreFooter = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 10px;
`

export const SC_LoadMoreBtn = styled.button`
  padding: 8px 18px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-border);
  background-color: transparent;
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast);

  &:hover {
    border-color: var(--color-brand-cyan);
    color: var(--color-brand-cyan);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`
