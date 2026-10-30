import styled from 'vue3-styled-components'

/** Как строка вкладки «Система», но переключатель уходит вниз на узком экране. */
export const SC_ConnectionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ui-border);
`

export const SC_ConnectionHead = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`

export const SC_InfoButton = styled.button`
  display: inline-flex;
  align-items: center;
  padding: 2px;
  font-size: 16px;
  color: var(--ui-text-muted);
  background: none;
  border: 0;
  border-radius: var(--ui-radius-full);
  cursor: help;

  &:hover,
  &:focus-visible {
    color: var(--ui-primary);
  }
`

export const SC_ConnectionStatus = styled.span`
  font-size: 13px;
  color: var(--ui-text-toned);
`
