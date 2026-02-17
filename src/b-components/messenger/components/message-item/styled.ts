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

export const SC_ReactionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
`

export const SC_ReactionPill = styled.span`
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.06);
  cursor: default;
  display: inline-flex;
  align-items: center;
  gap: 2px;

  &.mine {
    background: rgba(0, 100, 200, 0.15);
  }
`

export const SC_ReactionButton = styled.button`
  padding: 2px 6px;
  margin-left: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.6;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;

  &:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.06);
  }
`

export const SC_ReactionPicker = styled.div`
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 4px;
  padding: 6px 8px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  gap: 4px;
  z-index: 10;
`

export const SC_ReactionPickerEmoji = styled.button`
  padding: 4px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  border-radius: 6px;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
`
