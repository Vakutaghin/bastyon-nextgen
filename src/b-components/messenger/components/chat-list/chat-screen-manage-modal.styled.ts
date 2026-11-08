import styled from 'vue3-styled-components'

export const SC_ManageLead = styled.p`
  margin: 0 0 12px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.45;
`

export const SC_ManageList = styled.div`
  display: flex;
  flex-direction: column;
  max-height: min(60vh, 420px);
  margin: 0 -8px;
  overflow-y: auto;
`

export const SC_ManageRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--ui-radius-md);

  &:hover {
    background: var(--color-bg-tertiary);
  }
`

export const SC_ManageInfo = styled.div`
  flex: 1;
  min-width: 0;
`

export const SC_ManageName = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;

  > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const SC_ManageUnread = styled.span`
  flex-shrink: 0;
  min-width: 18px;
  padding: 0 5px;
  border-radius: var(--ui-radius-full);
  background: var(--ui-text-dimmed);
  color: var(--ui-text-inverted);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
`

/** Причина — до двух строк: в узком окне она длиннее места. */
export const SC_ManageMeta = styled.div`
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
`

export const SC_ManageActions = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: 6px;
`

export const SC_ManageButton = styled.button`
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  background: transparent;
  color: var(--color-text-primary);
  font-size: 13px;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);

  &:hover {
    background: var(--color-bg-hover);
  }

  &.primary {
    border-color: var(--ui-primary);
    color: var(--ui-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`

export const SC_ManageEmpty = styled.div`
  padding: 24px 0;
  color: var(--color-text-secondary);
  text-align: center;
`

export const SC_ManageFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-bg-hover);
`

export const SC_ManageLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ui-primary);
  font-size: 13px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`
