import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_InfoPanel = styled.div`
  display: grid !important;
  grid-template-columns: 1fr 1fr 1fr !important;
  gap: 16px !important;
  margin-top: 16px !important;
  width: 100% !important;
  box-sizing: border-box !important;

  @media (max-width: ${BREAKPOINTS.DESKTOP}) {
    grid-template-columns: 1fr !important;
  }
`

export const SC_InfoSection = styled.div`
  background: ${COLORS.BG_INPUT} !important;
  border: 1px solid ${COLORS.GRAY_E8} !important;
  border-radius: 8px !important;
  padding: 16px !important;
  box-sizing: border-box !important;
`

export const SC_SectionHeader = styled.div`
  margin-bottom: 12px !important;
  padding-bottom: 12px !important;
  border-bottom: 1px solid ${COLORS.GRAY_E8} !important;
`

export const SC_SectionTitle = styled.h4`
  margin: 0 !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  color: ${COLORS.TEXT_PRIMARY} !important;
`

export const SC_InfoContent = styled.div`
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
`

export const SC_InfoRow = styled.div`
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding: 4px 0 !important;
  font-size: 16px !important;
`

export const SC_InfoLabel = styled.span`
  color: ${COLORS.TEXT_SECONDARY} !important;
  font-weight: 500 !important;
  flex-shrink: 0 !important;
  margin-right: 12px !important;
`

export const SC_InfoValue = styled.span`
  color: ${COLORS.TEXT_PRIMARY} !important;
  text-align: right !important;
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  flex-wrap: wrap !important;
  justify-content: flex-end !important;
`

export const SC_TranscoderBadge = styled.span<{ isWorker: boolean }>`
  display: inline-block !important;
  padding: 4px 8px !important;
  border-radius: 4px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  background-color: ${(p) => (p.isWorker ? COLORS.ANT_BLUE_BG : COLORS.ORANGE_BG)} !important;
  color: ${(p) => (p.isWorker ? COLORS.ANT_BLUE : COLORS.WARNING_HEX)} !important;
  border: 1px solid ${(p) => (p.isWorker ? COLORS.ANT_BLUE_LIGHT : COLORS.ORANGE_BORDER)} !important;
`
