import styled from 'vue3-styled-components'
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
  background: var(--color-bg-primary);
`

export const SC_ProfileMainContent = styled.main`
  flex: 1;
  min-width: 0;
  background: var(--color-bg-primary);
  padding: 20px 0;
  border-radius: var(--ui-radius-lg);

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    padding: 12px 8px 16px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 8px 6px 12px;
  }
`

/** Панель с кнопкой «Создать пост» над лентой своего профиля (только для себя). */
export const SC_ProfileCreatePost = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    margin-bottom: 10px;
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
  color: var(--color-gray-666);
`

export const SC_ErrorProfile = styled.div`
  text-align: center;
  padding: 40px;
  font-size: 18px;
  color: var(--color-red-ant);
`

export const SC_PendingProfile = styled.div`
  text-align: center;
  padding: 40px 20px;
  font-size: 16px;
  color: var(--color-gray-666);
  line-height: 1.6;

  .pending-icon {
    font-size: 48px;
    color: var(--color-warning-icon);
    margin-bottom: 16px;
  }

  .pending-title {
    font-size: 20px;
    font-weight: 500;
    color: var(--color-gray-333);
    margin-bottom: 8px;
  }
`
