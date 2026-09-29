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

/** Бумажное сообщение LXMF: QR-код и ссылка поверх чата. */
export const SC_PaperOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(var(--color-black-rgb) / 55%);
`

export const SC_PaperCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 380px;
  max-height: 100%;
  overflow: auto;
  padding: 16px;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
  color: var(--ui-text);
`

export const SC_PaperTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_PaperHint = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-text-muted);
`

export const SC_PaperQr = styled.img`
  align-self: center;
  width: 100%;
  max-width: 320px;
  aspect-ratio: 1;
  image-rendering: pixelated;
`

export const SC_PaperLink = styled.code`
  display: block;
  max-height: 72px;
  overflow: auto;
  padding: 6px 8px;
  border-radius: var(--ui-radius-sm);
  font-size: 11px;
  word-break: break-all;
  color: var(--ui-text-muted);
  background: var(--ui-bg-muted);
`

export const SC_PaperActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`
