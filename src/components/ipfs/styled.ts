import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_IpfsBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 4px;
`

export const SC_IpfsText = styled.div`
  font-size: 13px;
  line-height: 1.5;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_IpfsProgressOuter = styled.div`
  width: 100%;
  height: 6px;
  background: ${COLORS.OVERLAY_6};
  border-radius: 3px;
  overflow: hidden;
`

export const SC_IpfsProgressInner = styled.div<{ pct?: number }>`
  height: 100%;
  width: ${(p) => Math.max(0, Math.min(100, p.pct ?? 0))}%;
  background: ${COLORS.ANT_BLUE};
  transition: width 0.3s;
`
