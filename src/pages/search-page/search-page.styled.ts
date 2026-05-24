import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

/** Контейнер всей страницы — повторяет SC_HomeWork: flex с сайдбаром слева. */
export const SC_SearchWork = styled.div`
  display: flex;
  flex: 1;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 20px);
  gap: 20px;
  padding: 58px 0 25px;
  align-items: flex-start;
  background: ${COLORS.BG_PRIMARY};

  &.is-mobile {
    gap: 0;
    padding: calc(60px + env(safe-area-inset-top, 0px)) 0 0;
  }
`

/** Контентная колонка справа от сайдбара. */
export const SC_SearchMainContent = styled.div`
  flex: 1;
  min-width: 0;
  background: ${COLORS.BG_PRIMARY};
  padding: 20px 20px 60px;
  border-radius: 8px;

  @media (max-width: 800px) {
    padding: 16px 10px 60px;
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

export const SC_QueryTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0;
  word-break: break-word;
`

export const SC_QueryHint = styled.span`
  color: ${COLORS.TEXT_HINT};
  font-size: 13px;
`

export const SC_Tabs = styled.div`
  display: flex;
  gap: 4px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHT};
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
  transition: color 0.15s, border-color 0.15s;

  &:hover {
    color: ${COLORS.PRIMARY};
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
  border-radius: 10px;
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;

  &:hover {
    background: ${COLORS.BG_HOVER_BLUE};
    border-color: ${COLORS.PRIMARY_LIGHT_30};
  }
`

export const SC_Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: ${COLORS.GRAY_E8};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${COLORS.WHITE};
  font-weight: 600;
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
  color: ${COLORS.TEXT_PRIMARY};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_ItemSubtitle = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_TagBadge = styled.span`
  display: inline-block;
  font-size: 12px;
  color: ${COLORS.TEXT_HINT};
  margin-left: 8px;
`

export const SC_LoadMoreWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 16px;
`

export const SC_LoadMore = styled.button`
  background: none;
  border: 1px solid ${COLORS.BORDER};
  border-radius: 8px;
  padding: 8px 20px;
  color: ${COLORS.PRIMARY};
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: ${COLORS.PRIMARY_LIGHT};
    border-color: ${COLORS.PRIMARY};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const SC_Empty = styled.div`
  text-align: center;
  padding: 48px 16px;
  color: ${COLORS.TEXT_HINT};
  font-size: 14px;
`

export const SC_LoadingState = styled.div`
  text-align: center;
  padding: 48px 16px;
  color: ${COLORS.TEXT_HINT};
  font-size: 14px;
`
