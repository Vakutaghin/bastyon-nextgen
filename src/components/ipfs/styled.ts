import styled from 'vue3-styled-components'

export const SC_IpfsBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 4px;
`

export const SC_IpfsText = styled.div`
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-secondary);
`

export const SC_IpfsProgressOuter = styled.div`
  width: 100%;
  height: 6px;
  background: var(--color-overlay-6);
  border-radius: var(--ui-radius-xs);
  overflow: hidden;
`

export const SC_IpfsProgressInner = styled.div<{ pct?: number }>`
  height: 100%;
  width: ${(p) => Math.max(0, Math.min(100, p.pct ?? 0))}%;
  background: var(--ui-primary);
  transition: width var(--transition-normal);
`
