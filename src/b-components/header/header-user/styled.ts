import styled from 'vue3-styled-components'
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
  color: var(--text-primary, #000);
`

export const SC_UserBalance = styled.div`
  font-size: 12px;
  color: var(--text-secondary, #666);
`

export const SC_UserLoading = styled.div`
  font-size: 12px;
  color: var(--text-secondary, #999);
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

export const SC_HeaderDropdownZindexFix = styled.div`
  z-index: 3005 !important;
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
