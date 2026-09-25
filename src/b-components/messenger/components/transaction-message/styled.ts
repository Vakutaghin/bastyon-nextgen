import styled from 'vue3-styled-components'

// Карточка перевода PKOIN — soft-алерт Nuxt в тёплом цвете: фон warning/10,
// рамка warning/25. Раньше это был сплошной жёлтый блок с тёмным текстом —
// самый яркий элемент на экране, чужой и светлой, и тёмной теме.
export const SC_Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--ui-radius-lg);
  background: rgb(var(--ui-warning-rgb) / 10%);
  border: 1px solid rgb(var(--ui-warning-rgb) / 25%);
  color: var(--ui-text);
  width: 100%;
  max-width: min(320px, 100%);
  box-sizing: border-box;
  overflow: hidden;
`

export const SC_Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

export const SC_Icon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgb(var(--ui-warning-rgb) / 15%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
`

export const SC_Amount = styled.div`
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--ui-text-highlighted);
`

export const SC_Caption = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-warning-text);
  margin-bottom: 2px;
`

export const SC_Body = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_Note = styled.div`
  font-size: 14px;
  color: var(--ui-text);
  word-break: break-word;
  white-space: pre-wrap;
`

export const SC_Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
`

export const SC_Txid = styled.span`
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--ui-text-muted);
`

export const SC_ExplorerLink = styled.a`
  color: var(--ui-primary-text);
  text-decoration: none;
  font-weight: 500;

  &:hover {
    color: var(--ui-primary-text);
    text-decoration: underline;
  }
`
