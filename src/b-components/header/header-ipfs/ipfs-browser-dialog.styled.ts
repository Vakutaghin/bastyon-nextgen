import styled from 'vue3-styled-components'

export const SC_BrowserBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

/** Адресная строка: поле и «Открыть» в ряд, как в браузере. */
export const SC_BrowserBar = styled.form`
  display: flex;
  gap: 8px;

  & > .ant-input-affix-wrapper,
  & > input {
    flex: 1;
    min-width: 0;
  }
`

export const SC_BrowserError = styled.div`
  font-size: 13px;
  color: var(--ui-error);
`

export const SC_BrowserHint = styled.div`
  font-size: 13px;
  line-height: calc(1.5 * var(--leading-scale));
  color: var(--ui-text-muted);
`

export const SC_RecentTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_RecentList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_RecentItem = styled.li`
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--ui-radius-md);

  &:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
  }
`

export const SC_RecentLink = styled.button`
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: none;
  background: none;
  color: var(--ui-text);
  font-family: var(--font-family-mono, monospace);
  font-size: 12px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: var(--ui-primary);
  }
`

export const SC_RecentForget = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--ui-text-dimmed);
  cursor: pointer;

  &:hover {
    color: var(--ui-text-highlighted);
  }
`
