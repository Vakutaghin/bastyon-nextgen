import styled from 'vue3-styled-components'

export const SC_ChainTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
`

export const SC_ChainBackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: -6px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--color-text-primary);
  }
`

/** Модалка не выше окна: прокручивается её содержимое, лента под ней стоит. */
export const SC_ChainBody = styled.div`
  max-height: calc(100dvh - 210px);
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0 -24px;
  padding: 0 24px 4px;
`

export const SC_ChainFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 16px;
`

export const SC_ChainFooterLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-link);
  font-size: 14px;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_ChainHead = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`

export const SC_ChainHeadText = styled.div`
  flex: 1;
  min-width: 0;
`

export const SC_ChainHeadName = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  word-break: break-word;
`

export const SC_ChainHeadSub = styled.div`
  margin-top: 2px;
  font-size: 13px;
  color: var(--color-text-muted);
`

export const SC_ChainBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--ui-radius-lg);

  &.warning {
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
  }
`

export const SC_ChainSection = styled.section`
  margin-bottom: 20px;
`

export const SC_ChainSectionTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_ChainMuted = styled.span`
  color: var(--color-text-muted);
`

export const SC_ChainLinkBtn = styled.button`
  background: transparent;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--color-link);
  cursor: pointer;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_ChainPeople = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

export const SC_ChainPerson = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 3px 10px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--ui-radius-full);
  background: transparent;
  color: var(--color-text-primary);
  font-size: 13px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    background: rgb(var(--ui-primary-rgb) / 6%);
  }
`

export const SC_ChainPersonValue = styled.span`
  color: var(--color-warning-text);
  font-variant-numeric: tabular-nums;
`

export const SC_ChainList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

/** Строка списка — версия поста или транзакция адреса; вся строка нажимается. */
export const SC_ChainRow = styled.button`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--ui-radius-lg);
  background: transparent;
  color: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: rgb(var(--ui-primary-rgb) / 6%);
  }
`

export const SC_ChainRowLabel = styled.span`
  font-weight: 500;
  color: var(--color-text-primary);
`

export const SC_ChainRowHash = styled.span`
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_ChainRowMeta = styled.span`
  font-size: 12px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  &.in {
    color: var(--color-success);
  }
`

export const SC_ChainQuote = styled.blockquote`
  margin: 0 0 16px;
  padding: 10px 14px;
  border-left: 3px solid var(--color-border-light);
  background: var(--ui-bg-elevated);
  border-radius: 0 var(--ui-radius-lg) var(--ui-radius-lg) 0;
  font-size: 14px;
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
`

export const SC_ChainTags = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  word-break: normal;
`
