import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

type Variant = 'off' | 'busy' | 'ready' | 'failed'

export const SC_IpfsWrapper = styled.div<{ variant?: Variant }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition:
    background-color 0.2s,
    color 0.2s;
  color: ${(p) => {
    switch (p.variant) {
      case 'ready':
        return COLORS.GREEN_ANT
      case 'busy':
        return COLORS.ANT_BLUE
      case 'failed':
        return COLORS.RED_ANT
      default:
        return COLORS.GRAY_888
    }
  }};

  &:hover {
    background-color: ${COLORS.OVERLAY_4};
  }
`

export const SC_IpfsDot = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${COLORS.ANT_BLUE};
  border: 1px solid ${COLORS.BG_PRIMARY};
`

export const SC_IpfsMenu = styled.div`
  background: ${COLORS.BG_PRIMARY};
  border-radius: 8px;
  box-shadow: ${COLORS.SHADOW_MD};
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
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_IpfsStatusLine = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_IpfsProgressOuter = styled.div`
  width: 100%;
  height: 4px;
  background: ${COLORS.OVERLAY_6};
  border-radius: 2px;
  overflow: hidden;
`

export const SC_IpfsProgressInner = styled.div<{ pct?: number }>`
  height: 100%;
  width: ${(p) => Math.max(0, Math.min(100, p.pct ?? 0))}%;
  background: ${COLORS.ANT_BLUE};
  transition: width 0.3s;
`

export const SC_IpfsActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SC_IpfsHint = styled.div`
  font-size: 11px;
  color: ${COLORS.GRAY_999};
`
