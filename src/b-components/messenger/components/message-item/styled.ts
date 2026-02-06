import styled from 'vue3-styled-components'


export const SC_MessageItem = styled.div`
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.4;
  position: relative;
  white-space: pre-wrap;
  word-break: break-word;

  &.mine {
    background-color: #d6ecff;
    color: #1b1f24;
    border-bottom-right-radius: 4px;
  }

  &.others {
    background-color: #f1f2f4;
    color: #1b1f24;
    border-bottom-left-radius: 4px;
  }
`

export const SC_MessageTime = styled.span`
  font-size: 10px;
  opacity: 0.7;
  display: block;
  text-align: right;
  margin-top: 4px;
`

export const SC_MessageRow = styled.div`
  display: flex;
  width: 100%;

  &.mine {
    justify-content: flex-end;
  }

  &.others {
    justify-content: flex-start;
  }
`

export const SC_MessageMeta = styled.div`
  font-size: 11px;
  opacity: 0.7;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
`
