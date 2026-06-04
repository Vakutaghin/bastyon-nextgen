import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_History = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const SC_HistoryHint = styled.div`
  font-size: 12px;
  color: ${COLORS.GRAY_999};
  margin-bottom: 8px;
`

export const SC_HistoryRow = styled.a`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  text-decoration: none;
  color: inherit;
  transition: background-color 0.15s;

  &:hover {
    background-color: ${COLORS.BRAND_CYAN_SOFT};
  }
`

export const SC_DirIcon = styled.div`
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;

  &.in {
    color: ${COLORS.SUCCESS};
    background-color: ${COLORS.SUCCESS_BG_12};
  }

  &.out {
    color: ${COLORS.RED_ANT};
    background-color: ${COLORS.DANGER_BG_SOFT};
  }
`

export const SC_HistoryMid = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_HistoryDirLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_HistoryCounterparty = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_HistoryAmount = styled.div`
  flex: 0 0 auto;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;

  &.in {
    color: ${COLORS.SUCCESS};
  }

  &.out {
    color: ${COLORS.TEXT_PRIMARY};
  }
`

export const SC_HistoryTime = styled.div`
  flex: 0 0 auto;
  font-size: 12px;
  color: ${COLORS.GRAY_999};
  min-width: 64px;
  text-align: right;
`

export const SC_HistoryEmpty = styled.div`
  padding: 24px 12px;
  text-align: center;
  color: ${COLORS.GRAY_999};
  font-size: 14px;
`

export const SC_HistoryError = styled.div`
  padding: 16px 12px;
  text-align: center;
  color: ${COLORS.RED_ANT};
  font-size: 14px;
`

export const SC_LoadMoreFooter = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 10px;
`

export const SC_LoadMoreBtn = styled.button`
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid ${COLORS.BORDER};
  background-color: transparent;
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 14px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;

  &:hover {
    border-color: ${COLORS.BRAND_CYAN};
    color: ${COLORS.BRAND_CYAN};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`
