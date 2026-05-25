import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_LimitsWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 25px;
  align-items: flex-start;
  background: rgb(255, 255, 255);
`

export const SC_LimitsPage = styled.div`
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--header-height-total) var(--content-padding-x) 24px;
`

export const SC_LimitsTitle = styled.h1`
  font-size: 22px;
  font-weight: 600;
  color: rgb(33, 33, 33);
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
  background: rgb(249, 249, 249);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  min-width: 0;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 10px 14px;
  }
`

export const SC_LimitLabel = styled.span`
  font-size: 15px;
  color: rgb(33, 33, 33);
`

export const SC_LimitValue = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: rgb(33, 33, 33);
`

export const SC_LimitValueMuted = styled.span`
  font-size: 14px;
  font-weight: 400;
  color: rgb(120, 120, 120);
`

export const SC_LimitsLoading = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 15px;
  color: rgb(120, 120, 120);
`

export const SC_LimitsError = styled.div`
  padding: 24px;
  background: rgba(220, 53, 69, 0.08);
  border-radius: 10px;
  font-size: 14px;
  color: rgb(180, 50, 50);
`
