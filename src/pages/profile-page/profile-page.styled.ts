import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_ProfileWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  gap: var(--content-gap);
  padding: 0 0 25px;
  align-items: flex-start;
  background: rgb(255, 255, 255);
`

export const SC_ProfileMainContent = styled.div`
  flex: 1;
  min-width: 0;
  background: rgb(255, 255, 255);
  padding: 20px 0;
  border-radius: 8px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    padding: 12px 8px 16px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 8px 6px 12px;
  }
`

export const SC_ProfilePage = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  padding-top: var(--header-height-total);
`

export const SC_ProfileContentWrapper = styled.div`
  display: flex;
  width: 100%;
  margin: 0 auto;
  gap: var(--content-gap);
  max-width: var(--content-max-width);

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    flex-direction: column;
    padding: 8px;
    gap: 8px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 6px;
    gap: 6px;
  }
`

export const SC_LoadingProfile = styled.div`
  text-align: center;
  padding: 40px;
  font-size: 18px;
  color: ${COLORS.GRAY_666};
`

export const SC_ErrorProfile = styled.div`
  text-align: center;
  padding: 40px;
  font-size: 18px;
  color: ${COLORS.RED_ANT};
`

export const SC_PendingProfile = styled.div`
  text-align: center;
  padding: 40px 20px;
  font-size: 16px;
  color: ${COLORS.GRAY_666};
  line-height: 1.6;

  .pending-icon {
    font-size: 48px;
    color: ${COLORS.WARNING_ICON};
    margin-bottom: 16px;
  }

  .pending-title {
    font-size: 20px;
    font-weight: 500;
    color: ${COLORS.GRAY_333};
    margin-bottom: 8px;
  }
`
