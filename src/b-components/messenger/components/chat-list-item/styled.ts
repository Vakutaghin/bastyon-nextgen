import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import Avatar from '@/components/avatar/avatar.vue'

export const SC_Avatar = styled(Avatar)`
  margin-right: 12px;
`

export const SC_ListItem = styled.div`
  display: flex;
  align-items: center;
  padding: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid ${COLORS.BG_HOVER};

  &:hover {
    background-color: ${COLORS.BG_TERTIARY};
  }

  &:hover .dots-btn {
    opacity: 1;
  }

  &.active {
    background-color: ${COLORS.ANT_BLUE_BG_LIGHT};
  }

  &.active:hover {
    background-color: ${COLORS.ANT_BLUE_BG};
  }

  &.active .dots-btn {
    opacity: 1;
  }
`

export const SC_Info = styled.div`
  flex: 1;
  overflow: hidden;
`

export const SC_Name = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  margin-bottom: 4px;
`

export const SC_LastMessage = styled.div`
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_Meta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 8px;
  flex-shrink: 0;
`

export const SC_Time = styled.span`
  font-size: 11px;
  color: ${COLORS.GRAY_999};
  margin-bottom: 4px;
`

export const SC_Badge = styled.span`
  background-color: ${COLORS.BRAND_CYAN};
  color: ${COLORS.WHITE};
  font-size: 11px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
`

export const SC_MenuWrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 22px;
`

export const SC_DotsBtn = styled.button`
  opacity: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: ${COLORS.GRAY_999};
  padding: 2px 4px;
  border-radius: 4px;
  transition:
    opacity 0.2s,
    color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;

  &:hover {
    color: ${COLORS.TEXT_PRIMARY};
  }
`

export const SC_Dropdown = styled.div`
  background: ${COLORS.BG_PRIMARY};
  border-radius: 8px;
  box-shadow: ${COLORS.SHADOW_MD};
  min-width: 180px;
  padding: 4px 0;
`

export const SC_DropdownItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  cursor: pointer;
  transition: background-color 0.15s;
  white-space: nowrap;

  &:hover {
    background-color: ${COLORS.BG_TERTIARY};
  }
`

export const SC_Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
`

export const SC_ConfirmOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${COLORS.OVERLAY_40};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
`

export const SC_ConfirmDialog = styled.div`
  background: ${COLORS.BG_PRIMARY};
  border-radius: 12px;
  padding: 24px;
  width: 95%;
  max-width: 480px;
  box-sizing: border-box;
  box-shadow: ${COLORS.SHADOW_LG};
`

export const SC_ConfirmTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  margin-bottom: 8px;
`

export const SC_ConfirmText = styled.div`
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};
  margin-bottom: 20px;
  line-height: 1.4;
  overflow-wrap: anywhere;
  word-break: break-word;
`

export const SC_ConfirmButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export const SC_CancelBtn = styled.button`
  padding: 8px 16px;
  border: 1px solid ${COLORS.GRAY_DDD};
  border-radius: 8px;
  background: ${COLORS.BG_PRIMARY};
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${COLORS.BG_TERTIARY};
  }
`

export const SC_ConfirmDeleteBtn = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: ${COLORS.RED_ANT};
  color: ${COLORS.WHITE};
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${COLORS.RED_DARK};
  }
`
