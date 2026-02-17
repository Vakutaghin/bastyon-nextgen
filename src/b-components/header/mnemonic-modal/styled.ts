import styled from 'vue3-styled-components'

export const SC_MnemonicModalContent = styled.div`
  padding: 20px 0;
`

export const SC_WarningBox = styled.div`
  padding: 16px;
  background-color: #fff7e6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  margin-bottom: 20px;
`

export const SC_WarningTitle = styled.div`
  font-weight: 600;
  font-size: 16px;
  color: #d46b08;
  margin-bottom: 8px;
`

export const SC_WarningText = styled.div`
  font-size: 13px;
  color: #d46b08;
  line-height: 1.5;
`

export const SC_EquivalenceNote = styled.div`
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
  line-height: 1.5;
  margin-bottom: 16px;
`

export const SC_MnemonicBox = styled.div`
  position: relative;
  background-color: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  padding: 16px;
  padding-bottom: 48px;
  margin-bottom: 20px;
  text-align: center;
`

export const SC_CopyIconBtn = styled.button`
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  color: rgba(0, 0, 0, 0.65);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
  &:hover {
    color: #1890ff;
    border-color: #1890ff;
    background: #e6f7ff;
  }
`

export const SC_MnemonicText = styled.div`
  font-family: 'Courier New', monospace;
  font-size: 16px;
  line-height: 1.8;
  color: #000;
  word-break: break-word;
  user-select: all;
`

export const SC_PrivateKeyBox = styled.div`
  position: relative;
  background-color: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  padding: 16px;
  padding-bottom: 48px;
  margin-bottom: 20px;
`

export const SC_PrivateKeyLabel = styled.div`
  font-size: 14px;
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 8px;
  text-align: center;
  font-weight: 900;
`

export const SC_PrivateKeyText = styled.div`
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #000;
  word-break: break-all;
  user-select: all;
`


export const SC_DontShowAgain = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
`

export const SC_CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  font-size: 16px;
  color: rgba(0, 0, 0, 0.65);
`

export const SC_Checkbox = styled.input`
  margin-right: 8px;
  cursor: pointer;
`
