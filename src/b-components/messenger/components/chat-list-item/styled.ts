import styled from 'vue3-styled-components'


export const SC_ListItem = styled.div`
  display: flex;
  align-items: center;
  padding: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f0f0f0;

  &:hover {
    background-color: #f5f5f5;
  }

  &:hover .dots-btn {
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
  color: #333;
  margin-bottom: 4px;
`

export const SC_LastMessage = styled.div`
  font-size: 13px;
  color: #666;
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
  color: #999;
  margin-bottom: 4px;
`

export const SC_Badge = styled.span`
  background-color: #00A3F7;
  color: white;
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
  color: #999;
  padding: 2px 4px;
  border-radius: 4px;
  transition: opacity 0.2s, color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;

  &:hover {
    color: #333;
  }
`

export const SC_Dropdown = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  min-width: 180px;
  padding: 4px 0;
`

export const SC_DropdownItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: background-color 0.15s;
  white-space: nowrap;

  &:hover {
    background-color: #f5f5f5;
  }
`

export const SC_Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
`

export const SC_ConfirmOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
`

export const SC_ConfirmDialog = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 95%;
  max-width: 480px;
  box-sizing: border-box;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
`

export const SC_ConfirmTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
`

export const SC_ConfirmText = styled.div`
  font-size: 14px;
  color: #666;
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
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f5f5;
  }
`

export const SC_ConfirmDeleteBtn = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: #e53935;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #c62828;
  }
`
