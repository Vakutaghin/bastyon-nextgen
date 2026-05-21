import styled from 'vue3-styled-components'

type Variant = 'off' | 'busy' | 'ready' | 'failed'

export const SC_TorWrapper = styled.div<{ variant?: Variant }>`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s, color 0.2s;
  color: ${(p) => {
    switch (p.variant) {
      case 'ready':
        return '#52c41a'
      case 'busy':
        return '#1890ff'
      case 'failed':
        return '#ff4d4f'
      default:
        return 'var(--text-primary, #888)'
    }
  }};

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
`

export const SC_TorMenu = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.08);
  padding: 12px;
  min-width: 320px;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const SC_TorRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

export const SC_TorTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: #333;
`

export const SC_TorStatusLine = styled.div`
  font-size: 12px;
  color: #666;
`

export const SC_TorProgressOuter = styled.div`
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 2px;
  overflow: hidden;
`

export const SC_TorProgressInner = styled.div<{ pct?: number }>`
  height: 100%;
  width: ${(p) => Math.max(0, Math.min(100, p.pct ?? 0))}%;
  background: #1890ff;
  transition: width 0.3s;
`

export const SC_TorBridgeBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid #f0f0f0;
`

export const SC_TorTextarea = styled.textarea`
  width: 100%;
  min-height: 80px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  padding: 6px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  resize: vertical;
`

export const SC_TorActions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`

export const SC_TorHint = styled.div`
  font-size: 11px;
  color: #999;
`
