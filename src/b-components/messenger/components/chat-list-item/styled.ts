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
  border-bottom: 1px solid var(--color-bg-hover);

  &:hover {
    background-color: var(--color-bg-tertiary);
  }

  &:hover .dots-btn {
    opacity: 1;
  }

  &.active {
    background-color: var(--color-ant-blue-bg-light);
  }

  &.active:hover {
    background-color: var(--color-ant-blue-bg);
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
  color: var(--ui-text-highlighted);
  margin-bottom: 4px;
`

export const SC_LastMessage = styled.div`
  font-size: 13px;
  color: var(--color-text-secondary);
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
  color: var(--color-gray-999);
  margin-bottom: 4px;
`

export const SC_Badge = styled.span`
  background-color: var(--color-brand-cyan);
  color: var(--ui-text-inverted);
  font-size: 11px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: var(--ui-radius-lg);
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
  color: var(--color-gray-999);
  padding: 2px 4px;
  border-radius: var(--ui-radius-sm);
  transition:
    opacity 0.2s,
    color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;

  &:hover {
    color: var(--color-text-primary);
  }
`

export const SC_Dropdown = styled.div`
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--shadow-md);
  min-width: 180px;
  padding: 4px 0;
`

export const SC_DropdownItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background-color 0.15s;
  white-space: nowrap;

  &:hover {
    background-color: var(--color-bg-tertiary);
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
  background: var(--color-overlay-40);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
`

export const SC_ConfirmDialog = styled.div`
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  padding: 24px;
  width: 95%;
  max-width: 480px;
  box-sizing: border-box;
  box-shadow: ${COLORS.SHADOW_LG};
`

export const SC_ConfirmTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin-bottom: 8px;
`

export const SC_ConfirmText = styled.div`
  font-size: 14px;
  color: var(--color-text-secondary);
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
  border: 1px solid var(--color-gray-ddd);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--color-bg-tertiary);
  }
`

export const SC_ConfirmDeleteBtn = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: var(--ui-radius-lg);
  background: var(--color-red-ant);
  color: var(--color-white);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--color-red-dark);
  }
`
