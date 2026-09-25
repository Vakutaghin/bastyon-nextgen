import styled from 'vue3-styled-components'

type Variant = 'off' | 'busy' | 'ready' | 'failed'

export const SC_IpfsWrapper = styled.div<{ variant?: Variant }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--ui-radius-md);
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
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

export const SC_IpfsDot = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-ant-blue);
  border: 1px solid var(--color-bg-primary);
`

export const SC_IpfsMenu = styled.div`
  background: var(--ui-bg);
  border-radius: var(--ui-radius-md);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  padding: 12px;
  min-width: 280px;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const SC_IpfsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

export const SC_IpfsTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: var(--ui-text-highlighted);
`

export const SC_IpfsStatusLine = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

export const SC_IpfsProgressOuter = styled.div`
  width: 100%;
  height: 4px;
  background: var(--color-overlay-6);
  border-radius: var(--ui-radius-xs);
  overflow: hidden;
`

export const SC_IpfsProgressInner = styled.div<{ pct?: number }>`
  height: 100%;
  width: ${(p) => Math.max(0, Math.min(100, p.pct ?? 0))}%;
  background: var(--color-ant-blue);
  transition: width var(--transition-normal);
`

export const SC_IpfsActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SC_IpfsHint = styled.div`
  font-size: 12px;
  color: var(--color-gray-999);
`
