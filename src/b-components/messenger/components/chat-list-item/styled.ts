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
