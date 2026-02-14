import styled from 'vue3-styled-components'

export const SC_TransferWidget = styled.div`
  max-width: 560px;
  background: rgb(249, 249, 249);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  overflow: hidden;
`

export const SC_TransferSwitch = styled.div`
  display: flex;
  background: rgb(255, 255, 255);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
`

export const SC_TransferSwitchBtn = styled.button<{ $active?: boolean }>`
  flex: 1;
  padding: 14px 20px;
  font-size: 15px;
  font-weight: 600;
  color: ${(p) => (p.$active ? 'rgb(33, 33, 33)' : 'rgb(120, 120, 120)')};
  background: ${(p) => (p.$active ? 'rgb(249, 249, 249)' : 'transparent')};
  border: none;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: rgb(33, 33, 33);
    background: rgb(249, 249, 249);
  }
`

export const SC_TransferBody = styled.div`
  padding: 24px;
`

export const SC_TransferField = styled.div`
  margin-bottom: 16px;
`

export const SC_TransferLabel = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: rgb(120, 120, 120);
  margin-bottom: 6px;
`

export const SC_TransferInput = styled.input`
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: rgb(33, 33, 33);
  background: rgb(255, 255, 255);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  box-sizing: border-box;

  &::placeholder {
    color: rgb(160, 160, 160);
  }
  &:focus {
    outline: none;
    border-color: rgba(0, 0, 0, 0.25);
  }
`

export const SC_TransferTextarea = styled.textarea`
  width: 100%;
  min-height: 72px;
  padding: 10px 14px;
  font-size: 14px;
  color: rgb(33, 33, 33);
  background: rgb(255, 255, 255);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  box-sizing: border-box;
  resize: vertical;

  &::placeholder {
    color: rgb(160, 160, 160);
  }
  &:focus {
    outline: none;
    border-color: rgba(0, 0, 0, 0.25);
  }
`

export const SC_TransferSelect = styled.select`
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: rgb(33, 33, 33);
  background: rgb(255, 255, 255);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  cursor: pointer;
  box-sizing: border-box;
`

export const SC_TransferRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
`

export const SC_TransferAddress = styled.div`
  flex: 1;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  color: rgb(33, 33, 33);
  word-break: break-all;
  padding: 10px 14px;
  background: rgb(255, 255, 255);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
`

export const SC_TransferCopyBtn = styled.button`
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: rgb(33, 33, 33);
  background: rgb(255, 255, 255);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: rgb(245, 245, 245);
  }
`

export const SC_TransferSubmit = styled.button`
  width: 100%;
  margin-top: 20px;
  padding: 12px 20px;
  font-size: 15px;
  font-weight: 600;
  color: rgb(255, 255, 255);
  background: rgb(33, 33, 33);
  border: none;
  border-radius: 8px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgb(50, 50, 50);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_TransferError = styled.div`
  margin-top: 12px;
  padding: 12px;
  font-size: 13px;
  color: rgb(180, 50, 50);
  background: rgba(220, 53, 69, 0.08);
  border-radius: 8px;
`

export const SC_TransferFieldError = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: rgb(180, 50, 50);
`

export const SC_TransferSuccess = styled.div`
  margin-top: 12px;
  padding: 12px;
  font-size: 13px;
  color: rgb(34, 120, 60);
  background: rgba(40, 167, 69, 0.08);
  border-radius: 8px;
`

export const SC_TransferSearchWrap = styled.div`
  position: relative;
`

export const SC_TransferSearchDropdown = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 4px;
  max-height: 220px;
  overflow-y: auto;
  background: rgb(255, 255, 255);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
`

export const SC_TransferSearchItem = styled.button`
  display: block;
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  text-align: left;
  color: rgb(33, 33, 33);
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);

  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: rgb(249, 249, 249);
  }
`

export const SC_TransferLoginChip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: rgb(120, 120, 120);
  background: rgb(255, 255, 255);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  max-width: fit-content;
`

export const SC_TransferLoginChipText = styled.span`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_TransferLoginChipRemove = styled.button`
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  color: rgb(120, 120, 120);
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: rgb(33, 33, 33);
    background: rgba(0, 0, 0, 0.06);
  }
`
