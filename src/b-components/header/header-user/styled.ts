import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const SC_UserDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: none;
  }
`

export const SC_UserName = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_UserBalance = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_UserLoading = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  font-style: italic;
`

export const SC_UserInfoTrigger = styled(SC_UserInfo)`
  cursor: pointer;
  transition: opacity 0.2s;
  position: relative;
  z-index: 3000;

  &:hover {
    opacity: 0.8;
  }
`

export const SC_AuthSkeleton = styled(SC_UserInfo)`
  pointer-events: none;
`

export const SC_SkeletonLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: none;
  }
`
