import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

type Variant = 'off' | 'busy' | 'ready' | 'failed'

export const SC_TorWrapper = styled.div<{ variant?: Variant }>`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--ui-radius-md);
  transition:
    background-color 0.2s,
    color 0.2s;
  color: ${(p) => {
    switch (p.variant) {
      case 'ready':
        return 'var(--ui-success)'
      case 'busy':
        return 'var(--ui-info)'
      case 'failed':
        return 'var(--ui-error)'
      default:
        return 'var(--ui-text-dimmed)'
    }
  }};

  &:hover {
    background-color: var(--ui-bg-elevated);
  }
`

export const SC_TorMenu = styled.div`
  background: var(--ui-bg);
  border-radius: var(--ui-radius-md);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
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
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_TorBridgeTitle = styled(SC_TorTitle)`
  font-size: 12px;
`

export const SC_TorStatusLine = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_TorProgressOuter = styled.div`
  width: 100%;
  height: 4px;
  background: ${COLORS.OVERLAY_6};
  border-radius: var(--ui-radius-xs);
  overflow: hidden;
`

export const SC_TorProgressInner = styled.div<{ pct?: number }>`
  height: 100%;
  width: ${(p) => Math.max(0, Math.min(100, p.pct ?? 0))}%;
  background: ${COLORS.ANT_BLUE};
  transition: width 0.3s;
`

export const SC_TorBridgeBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid ${COLORS.BG_HOVER};
`

export const SC_TorTextarea = styled.textarea`
  width: 100%;
  min-height: 80px;
  font-family: var(--font-family-mono);
  font-size: 11px;
  padding: 6px 8px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: var(--ui-radius-sm);
  resize: vertical;
  background: ${COLORS.BG_INPUT};
  color: ${COLORS.TEXT_PRIMARY};

  &::placeholder {
    color: ${COLORS.TEXT_MUTED};
  }
`

export const SC_TorActions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`

export const SC_TorHint = styled.div`
  font-size: 11px;
  color: ${COLORS.GRAY_999};
`
