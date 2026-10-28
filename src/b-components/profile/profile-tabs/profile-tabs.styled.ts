import styled from 'vue3-styled-components'

export const SC_Tabs = styled.nav`
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--ui-border);
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  a {
    flex: none;
    padding: 10px 12px;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    font-weight: 500;
    color: var(--ui-text-muted);
    text-decoration: none;
    white-space: nowrap;
  }

  a:hover {
    color: var(--ui-text);
  }

  a.active {
    color: var(--ui-text-highlighted);
    border-bottom-color: var(--ui-primary);
  }
`
