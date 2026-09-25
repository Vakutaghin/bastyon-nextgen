import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_SettingsWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 25px;
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_SettingsPage = styled.div`
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding-top: var(--header-height-total);
`

export const SC_SettingsContentWrapper = styled.div`
  display: flex;
  width: 100%;
  gap: 24px;
  padding: 0 var(--content-padding-x);

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    flex-direction: column;
    padding: 8px;
    gap: 12px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 6px;
    gap: 8px;
  }
`

export const SC_SettingsMain = styled.main`
  flex: 1;
  min-width: 0;
  background: var(--color-bg-primary);
  padding: 24px;
  border-radius: var(--ui-radius-lg);

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    padding: 16px 12px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 12px 8px;
  }
`

export const SC_SettingsSectionTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0 0 16px;
`
