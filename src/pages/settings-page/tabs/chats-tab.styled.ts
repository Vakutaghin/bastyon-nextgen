import styled from 'vue3-styled-components'

export const SC_ArchiveLead = styled.p`
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--ui-text-muted);
`

/** Заголовок списка чатов и сколько всего сохранено. */
export const SC_ArchiveHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
  margin-bottom: 12px;
`

export const SC_ArchiveSearch = styled.input`
  width: 100%;
  margin-bottom: 12px;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--ui-text);
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 1px;
  }
`

export const SC_ArchiveList = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0 0 20px;
  padding: 0;
  list-style: none;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
`

export const SC_ArchiveRow = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;

  & + & {
    border-top: 1px solid var(--ui-border);
  }
`

export const SC_ArchiveInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_ArchiveName = styled.span`
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
  text-overflow: ellipsis;
`

export const SC_ArchiveMeta = styled.span`
  font-size: 13px;
  color: var(--ui-text-muted);
`

/** Стереть копию чата: значок корзины, цветом ошибки при наведении. */
export const SC_ArchiveDelete = styled.button`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 16px;
  color: var(--ui-text-muted);
  background: none;
  border: 0;
  border-radius: var(--ui-radius-md);
  cursor: pointer;

  &:hover {
    color: var(--ui-error);
    background: rgb(var(--ui-error-rgb) / 10%);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
  }
`

export const SC_ArchiveFooter = styled.div`
  display: flex;
  justify-content: flex-end;
`
