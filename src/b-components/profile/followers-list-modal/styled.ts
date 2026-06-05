import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px 0;
`

export const SC_Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.BG_HOVER};
  }
`

export const SC_RowMain = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
`

export const SC_Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: ${COLORS.BG_SECONDARY};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: ${COLORS.TEXT_SECONDARY};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_RowInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_RowName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.TEXT_PRIMARY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_RowMeta = styled.span`
  font-size: 12px;
  color: ${COLORS.TEXT_MUTED};
`

export const SC_FollowBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid ${COLORS.PRIMARY};
  background: ${COLORS.PRIMARY};
  color: ${COLORS.WHITE};
  font-size: 13px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    background: ${COLORS.PRIMARY_HOVER};
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }

  &.subscribed {
    background: ${COLORS.BG_SECONDARY};
    color: ${COLORS.TEXT_PRIMARY};
    border-color: ${COLORS.BORDER_DEFAULT};
  }
`

export const SC_State = styled.div`
  padding: 28px 0;
  text-align: center;
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_LoadMore = styled.button`
  margin: 8px auto 0;
  display: block;
  padding: 8px 18px;
  border-radius: 6px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  background: ${COLORS.BG_SECONDARY};
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 13px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.BG_HOVER};
  }
`
