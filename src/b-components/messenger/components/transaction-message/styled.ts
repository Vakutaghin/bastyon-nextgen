import styled from 'vue3-styled-components'

export const SC_Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffd166 0%, #f3a73a 100%);
  color: #1b1f24;
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
  background: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
`

export const SC_Amount = styled.div`
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
`

export const SC_Caption = styled.div`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  opacity: 0.7;
  margin-bottom: 2px;
`

export const SC_Body = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_Note = styled.div`
  font-size: 13px;
  color: #1b1f24;
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
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  opacity: 0.75;
`

export const SC_ExplorerLink = styled.a`
  color: #1b1f24;
  text-decoration: none;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.4);
  padding: 4px 8px;
  border-radius: 6px;

  &:hover {
    background: rgba(255, 255, 255, 0.6);
  }
`
