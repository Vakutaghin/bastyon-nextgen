import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_LimitsWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 25px;
  align-items: flex-start;
  background: ${COLORS.BG_PRIMARY};
`

export const SC_LimitsPage = styled.main`
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--header-height-total) var(--content-padding-x) 24px;
`

export const SC_LimitsTitle = styled.h1`
  font-size: 22px;
  font-weight: 600;
  color: ${COLORS.GRAY_212};
  margin: 24px 0;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    font-size: 19px;
    margin: 16px 0;
  }
`

export const SC_LimitsList = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
`

export const SC_LimitRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: ${COLORS.BG_LIGHT};
  border-radius: 10px;
  border: 1px solid ${COLORS.OVERLAY_6};
  min-width: 0;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 10px 14px;
  }
`

export const SC_LimitLabel = styled.span`
  font-size: 15px;
  color: ${COLORS.GRAY_212};
`

export const SC_LimitValue = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: ${COLORS.GRAY_212};
`

export const SC_LimitValueMuted = styled.span`
  font-size: 14px;
  font-weight: 400;
  color: ${COLORS.GRAY_120};
`

export const SC_LimitCtaNotice = styled.div`
  margin-top: 20px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: ${COLORS.WARNING_BG_SOFT};
  border: 1px solid ${COLORS.WARNING_BORDER_LIGHT};
  border-radius: 10px;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 14px 16px;
  }
`

export const SC_LimitCtaHeading = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${COLORS.GRAY_212};
`

export const SC_LimitCtaText = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: ${COLORS.GRAY_120};
`

export const SC_LimitCtaActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`

export const SC_LimitCtaButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.WHITE};
  background: ${COLORS.PRIMARY};
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.PRIMARY_HOVER};
  }
`

export const SC_LimitsLoading = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 15px;
  color: ${COLORS.GRAY_120};
`

export const SC_LimitsError = styled.div`
  padding: 24px;
  background: ${COLORS.DANGER_BG_SOFT};
  border-radius: 10px;
  font-size: 14px;
  color: ${COLORS.DANGER_DEEP};
`
