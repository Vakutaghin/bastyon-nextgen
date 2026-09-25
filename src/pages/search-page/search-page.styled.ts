import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

/** Контейнер всей страницы — повторяет SC_HomeWork: flex с сайдбаром слева. */
export const SC_SearchWork = styled.div`
  display: flex;
  flex: 1;
  max-width: var(--content-max-width);
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 20px);
  gap: var(--content-gap);
  padding: calc(var(--header-height) - 2px) 0 25px;
  align-items: flex-start;
  background: var(--color-bg-primary);

  &.is-mobile {
    gap: 0;
    padding: var(--header-height-total) 0 0;
  }
`

/** Контентная колонка справа от сайдбара. */
export const SC_SearchMainContent = styled.main`
  flex: 1;
  min-width: 0;
  background: var(--color-bg-primary);
  padding: 20px 20px 60px;
  border-radius: var(--ui-radius-lg);

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    padding: 12px 8px 60px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 8px 6px 60px;
  }
`

export const SC_SearchPage = styled.div`
  width: 100%;
`

export const SC_Header = styled.div`
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
`

export const SC_QueryTitle = styled.h1`
  font-size: 20px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0;
  word-break: break-word;
`

export const SC_QueryHint = styled.span`
  color: var(--color-text-hint);
  font-size: 14px;
`

export const SC_Tabs = styled.div`
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--color-border-light);
  margin-bottom: 16px;
`

export const SC_Tab = styled.button<{ active: boolean }>`
  background: none;
  border: none;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: ${(p) => (p.active ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY)};
  cursor: pointer;
  border-bottom: 2px solid ${(p) => (p.active ? COLORS.PRIMARY : 'transparent')};
  margin-bottom: -1px;
  transition:
    color ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK};

  &:hover {
    color: var(--color-primary);
  }
`

export const SC_ResultsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SC_ResultItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-lighter);
  cursor: pointer;
  transition:
    background-color ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK};

  &:hover {
    background: var(--color-bg-hover-blue);
    border-color: var(--color-primary-light-30);
  }
`

export const SC_Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--ui-bg-elevated);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Инициал как у UAvatar: белым на светлой подложке его не было видно. */
  color: var(--ui-text-muted);
  font-weight: 500;
  font-size: 14px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

export const SC_ItemBody = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const SC_ItemTitle = styled.div`
  font-weight: 600;
  color: var(--ui-text-highlighted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_ItemSubtitle = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_TagBadge = styled.span`
  display: inline-block;
  font-size: 12px;
  color: var(--color-text-hint);
  margin-left: 8px;
`

export const SC_LoadMoreWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 16px;
`

export const SC_LoadMore = styled.button`
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--ui-radius-lg);
  padding: 8px 20px;
  color: var(--color-primary);
  font-size: 14px;
  cursor: pointer;
  transition:
    background-color ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK};

  &:hover:not(:disabled) {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
`

export const SC_Empty = styled.div`
  text-align: center;
  padding: 48px 16px;
  color: var(--color-text-hint);
  font-size: 14px;
`

export const SC_LoadingState = styled.div`
  text-align: center;
  padding: 48px 16px;
  color: var(--color-text-hint);
  font-size: 14px;
`
