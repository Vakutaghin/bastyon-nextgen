import styled from 'vue3-styled-components'

export const SC_Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
`

export const SC_Modal = styled.div`
  background: #fff;
  border-radius: 14px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

export const SC_Header = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #eceff1;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: #1b1f24;
`

export const SC_Body = styled.div`
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: #607d8b;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`

export const SC_Input = styled.input`
  border: 1px solid #cfd8dc;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #1b1f24;
  background: #fff;
  outline: none;

  &:focus {
    border-color: #00a4db;
  }
`

export const SC_Textarea = styled.textarea`
  border: 1px solid #cfd8dc;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #1b1f24;
  background: #fff;
  outline: none;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;

  &:focus {
    border-color: #00a4db;
  }
`

export const SC_Recipient = styled.div`
  font-size: 13px;
  color: #455a64;
  word-break: break-all;
  background: #f4f7fa;
  padding: 8px 10px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
`

export const SC_Error = styled.div`
  color: #c62828;
  font-size: 12px;
`

export const SC_Footer = styled.div`
  padding: 12px 20px;
  border-top: 1px solid #eceff1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export const SC_Button = styled('button', { primary: Boolean })`
  border: 0;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: ${(p: any) => (p.primary ? '#00A4DB' : '#eceff1')};
  color: ${(p: any) => (p.primary ? '#fff' : '#263238')};

  &:hover:not(:disabled) {
    background: ${(p: any) => (p.primary ? '#0091c2' : '#e0e6eb')};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`
