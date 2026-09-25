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
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: var(--ui-text-highlighted);
`

export const SC_UserBalance = styled.div`
  font-size: 12px;
  line-height: 16px;
  color: var(--ui-text-muted);
`

export const SC_UserLoading = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  font-style: italic;
`

/** Как кнопка меню пользователя у Nuxt: призрачная, подложка на hover. */
export const SC_UserInfoTrigger = styled(SC_UserInfo)`
  cursor: pointer;
  padding: 4px 8px 4px 4px;
  border-radius: var(--ui-radius-md);
  transition: background-color var(--transition-quick);
  position: relative;
  z-index: 3000;

  &:hover {
    background: var(--ui-bg-elevated);
  }
`

export const SC_AuthSkeleton = styled(SC_UserInfo)`
  pointer-events: none;
`

export const SC_SkeletonLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: none;
  }
`
