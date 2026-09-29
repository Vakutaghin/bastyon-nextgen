import styled from 'vue3-styled-components'

/** Полоса под шапкой: сеть, как защищены сообщения, состояние радио. */
export const SC_MeshInfoBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 1.35;
  flex-shrink: 0;
`

export const SC_MeshInfoIcon = styled.span`
  display: inline-flex;
  font-size: 14px;
  color: var(--ui-primary);
  flex-shrink: 0;
`

export const SC_MeshInfoText = styled.span`
  flex: 1;
  min-width: 0;
`

export const SC_MeshOpenWarning = styled.span`
  color: var(--ui-warning);
`

export const SC_MeshRadioState = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  color: var(--ui-text-dimmed);
`

export const SC_MeshConnectButton = styled.button`
  border: 1px solid var(--ui-border-accented);
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  border-radius: var(--ui-radius-md);
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background: var(--ui-bg-elevated);
  }
`

/** Счётчик байт у поля ввода: у радио предел в байтах, а не в символах. */
export const SC_ByteCounter = styled('span', { over: Boolean, blocked: Boolean })`
  flex-shrink: 0;
  min-width: 52px;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: ${(p) =>
    p.blocked ? 'var(--ui-error)' : p.over ? 'var(--ui-warning)' : 'var(--ui-text-dimmed)'};
`
