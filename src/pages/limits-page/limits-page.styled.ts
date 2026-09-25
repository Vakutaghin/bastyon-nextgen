import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

export const SC_LimitsWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 25px;
  align-items: flex-start;
  background: var(--color-bg-primary);
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
  color: var(--color-gray-212);
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
  background: var(--color-bg-light);
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-overlay-6);
  min-width: 0;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 10px 14px;
  }
`

export const SC_LimitLabel = styled.span`
  font-size: 15px;
  color: var(--color-gray-212);
`

export const SC_LimitValue = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: var(--color-gray-212);
`

export const SC_LimitValueMuted = styled.span`
  font-size: 14px;
  font-weight: 400;
  color: var(--color-gray-120);
`

export const SC_LimitCtaNotice = styled.div`
  margin-top: 20px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--color-warning-bg-soft);
  border: 1px solid var(--color-warning-border-light);
  border-radius: var(--ui-radius-lg);

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 14px 16px;
  }
`

export const SC_LimitCtaHeading = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-gray-212);
`

export const SC_LimitCtaText = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--color-gray-120);
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
  border-radius: var(--ui-radius-lg);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-white);
  background: var(--color-primary);
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-primary-hover);
  }
`

export const SC_LimitsLoading = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 15px;
  color: var(--color-gray-120);
`

export const SC_LimitsError = styled.div`
  padding: 24px;
  background: var(--color-danger-bg-soft);
  border-radius: var(--ui-radius-lg);
  font-size: 14px;
  color: var(--color-danger-deep);
`
